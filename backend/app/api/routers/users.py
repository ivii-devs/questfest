from typing import List, Optional

import cloudinary.uploader
from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    File,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.database import get_db
from app.core.rate_limiter import limiter
from app.crud import user_crud
from app.dependencies import get_current_user
from app.models.usuario import LedgerTransaccion, Usuario
from app.schemas.auth_schemas import TokenResponse, UserCreate, UserResponse
from app.schemas.user_schemas import (
    RankingResponse,
    TransactionResponse,
    UserStatsResponse,
    UserUpdate,
)
from app.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.services import user_stats_service

router = APIRouter()


class PasswordResetRequest(BaseModel):
    username: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register_user(request: Request, user: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Registra un nuevo jugador en el sistema.
    Asigna el rol 'player' por defecto y hashea la contraseña de manera segura.
    """
    db_user = await user_crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está registrado")

    new_user = await user_crud.create_user(db=db, user=user, role="player")
    return new_user


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Inicia sesión intercambiando credenciales por un JWT Bearer token.
    Inyecta ademas el Refresh Token en una Cookie HTTP-Only segura.
    """
    user = await user_crud.get_user_by_username(db, username=form_data.username)

    is_valid = False
    if user:
        is_valid = await run_in_threadpool(verify_password, form_data.password, user.password_hash)

    if not user or not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"user_id": user.id})
    refresh_token = create_refresh_token(data={"user_id": user.id})

    # Inyectar cookie HTTP-Only para Refresh Token
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )
    # Cookie de acceso conveniente para Next.js Middleware
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=False,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Renueva el Access Token utilizando la cookie HTTP-Only de Refresh Token.
    """
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh Token no encontrado en cookies",
        )

    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Tipo de token invalido"
        )

    user_id = payload.get("user_id")
    user = await user_crud.get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    new_access_token = create_access_token(data={"user_id": user.id})
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=False,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )
    return {"access_token": new_access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(response: Response):
    """
    Cierra la sesión limpiando las cookies del cliente.
    """
    response.delete_cookie("refresh_token")
    response.delete_cookie("access_token")
    return {"message": "Sesión cerrada correctamente"}


@router.post("/request-password-reset", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def request_password_reset(
    request: Request, body: PasswordResetRequest, db: AsyncSession = Depends(get_db)
):
    """
    Genera un token firmado para la recuperación de contraseña.
    """
    user = await user_crud.get_user_by_username(db, username=body.username)
    if not user:
        # Respuesta generica para evitar enumeracion de usuarios
        return {"message": "Si el usuario existe, se ha generado el enlace de recuperación."}

    reset_token = create_password_reset_token(user.username)
    return {"message": "Token de recuperación generado con éxito.", "reset_token": reset_token}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def reset_password(
    request: Request, body: PasswordResetConfirm, db: AsyncSession = Depends(get_db)
):
    """
    Restablece la contraseña utilizando el token firmado.
    """
    payload = decode_token(body.token)
    if payload.get("type") != "reset":
        raise HTTPException(status_code=400, detail="Token invalido para recuperacion")

    username = payload.get("sub")
    user = await user_crud.get_user_by_username(db, username=username)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    new_hash = await run_in_threadpool(get_password_hash, body.new_password)
    user.password_hash = new_hash
    await db.commit()
    return {"message": "Contraseña actualizada con éxito."}


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: Usuario = Depends(get_current_user)):
    """
    Devuelve los datos del perfil y el saldo del usuario actualmente logueado.
    Ruta protegida, requiere token válido en el header Authorization.
    """
    return current_user


@router.get("/users", response_model=List[UserResponse])
async def list_public_users(db: AsyncSession = Depends(get_db)):
    """
    Devuelve la lista de usuarios para que puedan ser retados.
    """
    result = await db.execute(select(Usuario).order_by(Usuario.username))
    return result.scalars().all()


@router.get("/me/stats", response_model=UserStatsResponse)
async def read_user_stats(
    group_id: Optional[int] = None,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Agrega el panel analítico y perfil estadístico del jugador.
    Delega el cómputo y agregación contable en user_stats_service.
    """
    return await user_stats_service.get_user_stats(
        db=db, current_user=current_user, group_id=group_id
    )


@router.get("/me/ranking", response_model=RankingResponse)
async def read_user_ranking(
    group_id: Optional[int] = None,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if group_id is not None:
        from app.models.grupo import MiembroGrupo

        my_member = await db.scalar(
            select(MiembroGrupo).where(
                MiembroGrupo.usuario_id == current_user.id, MiembroGrupo.grupo_id == group_id
            )
        )
        if not my_member:
            return RankingResponse(rankingPosition=1)
        higher_count = await db.scalar(
            select(func.count(MiembroGrupo.id)).where(
                MiembroGrupo.grupo_id == group_id, MiembroGrupo.saldo_grupo > my_member.saldo_grupo
            )
        )
        return RankingResponse(rankingPosition=(higher_count or 0) + 1)

    higher_balance_count = await db.scalar(
        select(func.count())
        .select_from(Usuario)
        .where(Usuario.saldo_actual > current_user.saldo_actual)
    )
    return RankingResponse(rankingPosition=(higher_balance_count or 0) + 1)


@router.get("/me/transactions", response_model=List[TransactionResponse])
async def read_user_transactions(
    group_id: Optional[int] = None,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LedgerTransaccion).where(LedgerTransaccion.usuario_id == current_user.id)
    if group_id is not None:
        stmt = stmt.where(LedgerTransaccion.grupo_id == group_id)
    stmt = stmt.order_by(LedgerTransaccion.fecha_creacion.desc()).limit(20)
    result = await db.execute(stmt)
    transactions = result.scalars().all()
    response = []
    for tx in transactions:
        response.append(
            TransactionResponse(
                id=tx.id,
                type="income" if tx.cantidad > 0 else "expense",
                amount=tx.cantidad,
                concept=tx.concepto,
                date=tx.fecha_creacion.isoformat(),
                balance=tx.saldo_resultante,
            )
        )
    return response


@router.patch("/me", response_model=UserResponse)
async def update_user_me(
    user_update: UserUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_update.username is not None:
        # Verificar que no exista otro
        existing = await db.scalar(
            select(Usuario).where(
                Usuario.username == user_update.username, Usuario.id != current_user.id
            )
        )
        if existing:
            raise HTTPException(status_code=400, detail="Nombre de usuario en uso")
        current_user.username = user_update.username
    if user_update.bio is not None:
        current_user.bio = user_update.bio

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.put("/me/avatar", response_model=UserResponse)
async def update_user_avatar(
    file: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        # Subir a Cloudinary
        result = await run_in_threadpool(cloudinary.uploader.upload, file.file)
        current_user.avatar_url = result.get("secure_url")
        await db.commit()
        await db.refresh(current_user)
        return current_user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me/stats/{stat_type}/details")
async def read_stat_details(
    stat_type: str,
    group_id: Optional[int] = None,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Recupera el historial pormenorizado de operaciones para un tipo estadístico específico.
    Delega en user_stats_service.
    """
    return await user_stats_service.get_stat_details(
        db=db, current_user=current_user, stat_type=stat_type, group_id=group_id
    )
