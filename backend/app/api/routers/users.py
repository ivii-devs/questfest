from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Cookie
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.auth_schemas import UserCreate, UserResponse, TokenResponse
from app.crud import user_crud
from app.security import verify_password, create_access_token, create_refresh_token, create_password_reset_token, decode_token, get_password_hash
from app.dependencies import get_current_user
from app.models.usuario import Usuario
from starlette.concurrency import run_in_threadpool
from sqlalchemy import select, func, or_, and_
from typing import List, Optional
from fastapi import UploadFile, File
import cloudinary.uploader
from app.models.misiones import PruebaMision
from app.models.juegos import TicketApuesta, Duelo, Apuesta
from app.models.usuario import LedgerTransaccion
from app.schemas.user_schemas import UserUpdate, UserStatsResponse, RankingResponse, TransactionResponse
from app.core.rate_limiter import limiter
from pydantic import BaseModel, Field

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
    db: AsyncSession = Depends(get_db)
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
        max_age=7 * 24 * 3600
    )
    # Cookie de acceso conveniente para Next.js Middleware
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=False,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 3600
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Renueva el Access Token utilizando la cookie HTTP-Only de Refresh Token.
    """
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh Token no encontrado en cookies")
    
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tipo de token invalido")
    
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
        max_age=7 * 24 * 3600
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
    request: Request,
    body: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Genera un token firmado para la recuperación de contraseña.
    """
    user = await user_crud.get_user_by_username(db, username=body.username)
    if not user:
        # Respuesta generica para evitar enumeracion de usuarios
        return {"message": "Si el usuario existe, se ha generado el enlace de recuperación."}
    
    reset_token = create_password_reset_token(user.username)
    return {
        "message": "Token de recuperación generado con éxito.",
        "reset_token": reset_token
    }

@router.post("/reset-password", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def reset_password(
    request: Request,
    body: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db)
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
async def read_user_stats(group_id: Optional[int] = None, current_user: Usuario = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Agrega el panel analítico y perfil estadístico del jugador.
    
    Métricas Computadas:
    1. 'missions_count': Retos completados y aprobados por el tribunal.
    2. 'duels_count': Enfrentamientos 1vs1 ganados formalmente.
    3. 'bets_count': Apuestas cerradas donde la opción del usuario resultó victoriosa.
    4. 'bets_active_count' / 'tokens_active_sum': Pronósticos en curso pendientes de resolución.
    5. 'duels_tokens_active': Capital inmovilizado en duelos:
       - Para el retador: cuenta duelos 'pending', 'accepted' y 'validation_winner' (sus tokens ya salieron de su saldo).
       - Para el retado: solo cuenta 'accepted' y 'validation_winner' (sus tokens solo se inmovilizan tras aceptar).
    6. 'lost_bets_sum' / 'lost_duels_sum': Total acumulado de tokens perdidos para el cálculo de ROI.
    """
    # 1. Conteo de misiones completadas y aprobadas (con soporte de grupo)
    missions_stmt = select(func.count()).select_from(PruebaMision).where(PruebaMision.usuario_id == current_user.id, PruebaMision.estado == 'approved')
    if group_id is not None:
        from app.models.misiones import Mision
        missions_stmt = missions_stmt.join(Mision, Mision.id == PruebaMision.mision_id).where(Mision.grupo_id == group_id)
    missions_count = await db.scalar(missions_stmt)

    # 2. Conteo de duelos completados con victoria para el usuario
    duels_count = await db.scalar(
        select(func.count()).select_from(Duelo).where(
            Duelo.ganador_id == current_user.id,
            Duelo.estado == 'completed'
        )
    )

    # 3. Conteo de apuestas ganadas en mercados cerrados
    bets_count = await db.scalar(
        select(func.count())
        .select_from(TicketApuesta)
        .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
        .where(
            and_(
                TicketApuesta.usuario_id == current_user.id,
                Apuesta.estado == 'cerrada',
                TicketApuesta.opcion_id == Apuesta.opcion_ganadora_id
            )
        )
    )

    # 4. Apuestas en juego activas actualmente (mercado aún abierto)
    bets_active_count = await db.scalar(
        select(func.count())
        .select_from(TicketApuesta)
        .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
        .where(
            and_(
                TicketApuesta.usuario_id == current_user.id,
                Apuesta.estado == 'abierta'
            )
        )
    )

    # 5. Apuestas falladas en mercados cerrados
    bets_lost_count = await db.scalar(
        select(func.count())
        .select_from(TicketApuesta)
        .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
        .where(
            and_(
                TicketApuesta.usuario_id == current_user.id,
                Apuesta.estado == 'cerrada',
                TicketApuesta.opcion_id != Apuesta.opcion_ganadora_id
            )
        )
    )

    # 6. Suma de tokens invertidos en apuestas aún abiertas
    tokens_active_sum = await db.scalar(
        select(func.sum(TicketApuesta.cantidad))
        .select_from(TicketApuesta)
        .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
        .where(
            and_(
                TicketApuesta.usuario_id == current_user.id,
                Apuesta.estado == 'abierta'
            )
        )
    )

    # 7. Suma de tokens inmovilizados en duelos pendientes o en curso
    duels_tokens_active = await db.scalar(
        select(func.sum(Duelo.tokens_en_juego))
        .select_from(Duelo)
        .where(
            or_(
                and_(
                    Duelo.retador_id == current_user.id,
                    Duelo.estado.in_(['pending', 'accepted', 'validation_winner'])
                ),
                and_(
                    Duelo.retado_id == current_user.id,
                    Duelo.estado.in_(['accepted', 'validation_winner'])
                )
            )
        )
    )

    from sqlalchemy import not_
    from sqlalchemy.orm import joinedload

    # Tokens perdidos (tokensLost)
    lost_bets_sum = await db.scalar(
        select(func.sum(TicketApuesta.cantidad))
        .select_from(TicketApuesta)
        .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
        .where(
            and_(
                TicketApuesta.usuario_id == current_user.id,
                Apuesta.estado == 'cerrada',
                TicketApuesta.opcion_id != Apuesta.opcion_ganadora_id
            )
        )
    ) or 0

    lost_duels_sum = await db.scalar(
        select(func.sum(Duelo.tokens_en_juego))
        .select_from(Duelo)
        .where(
            and_(
                or_(Duelo.retador_id == current_user.id, Duelo.retado_id == current_user.id),
                Duelo.estado == 'completed',
                Duelo.ganador_id.isnot(None),
                Duelo.ganador_id != current_user.id
            )
        )
    ) or 0

    lost_orphaned_sum = await db.scalar(
        select(func.sum(LedgerTransaccion.cantidad))
        .select_from(LedgerTransaccion)
        .where(
            and_(
                LedgerTransaccion.usuario_id == current_user.id,
                LedgerTransaccion.cantidad < 0,
                not_(LedgerTransaccion.concepto.ilike('%Apuesta%')),
                not_(LedgerTransaccion.concepto.ilike('%Retención%')),
                not_(LedgerTransaccion.concepto.ilike('%Premio doble%'))
            )
        )
    ) or 0

    tokens_lost_sum = lost_bets_sum + lost_duels_sum + abs(lost_orphaned_sum)

    # Tokens ganados (tokensWon)
    won_bets_query = select(TicketApuesta).join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id).options(joinedload(TicketApuesta.apuesta)).where(
        and_(
            TicketApuesta.usuario_id == current_user.id,
            Apuesta.estado == 'cerrada',
            TicketApuesta.opcion_id == Apuesta.opcion_ganadora_id
        )
    )
    won_bets_result = await db.execute(won_bets_query)
    won_bets_tickets = won_bets_result.scalars().all()
    
    won_bets_sum = 0
    for ticket in won_bets_tickets:
        bet = ticket.apuesta
        if bet.opciones and ticket.opcion_id in bet.opciones:
            mult = float(bet.opciones[ticket.opcion_id].get("multiplier", 0))
            won_bets_sum += ticket.cantidad * mult

    won_duels_sum = await db.scalar(
        select(func.sum(Duelo.tokens_en_juego * 2))
        .select_from(Duelo)
        .where(
            and_(
                Duelo.ganador_id == current_user.id,
                Duelo.estado == 'completed'
            )
        )
    ) or 0

    won_orphaned_sum = await db.scalar(
        select(func.sum(LedgerTransaccion.cantidad))
        .select_from(LedgerTransaccion)
        .where(
            and_(
                LedgerTransaccion.usuario_id == current_user.id,
                LedgerTransaccion.cantidad > 0,
                not_(LedgerTransaccion.concepto.ilike('%Apuesta%')),
                not_(LedgerTransaccion.concepto.ilike('%Retención%')),
                not_(LedgerTransaccion.concepto.ilike('%Premio doble%'))
            )
        )
    ) or 0

    tokens_won_sum = int(won_bets_sum) + won_duels_sum + won_orphaned_sum

    # Duelos perdidos (duelsLost)
    duels_lost_count = await db.scalar(
        select(func.count())
        .select_from(Duelo)
        .where(
            and_(
                or_(Duelo.retador_id == current_user.id, Duelo.retado_id == current_user.id),
                Duelo.estado == 'completed',
                Duelo.ganador_id.isnot(None),
                Duelo.ganador_id != current_user.id
            )
        )
    )

    # Duelos activos (duelsActive)
    duels_active_count = await db.scalar(
        select(func.count())
        .select_from(Duelo)
        .where(
            and_(
                or_(Duelo.retador_id == current_user.id, Duelo.retado_id == current_user.id),
                Duelo.estado == 'accepted'
            )
        )
    )

    return UserStatsResponse(
        missionsCompleted=missions_count or 0,
        betsWon=bets_count or 0,
        duelsWon=duels_count or 0,
        betsActive=bets_active_count or 0,
        betsLost=bets_lost_count or 0,
        tokensActive=(tokens_active_sum or 0) + (duels_tokens_active or 0),
        tokensWon=tokens_won_sum or 0,
        tokensLost=tokens_lost_sum,
        duelsLost=duels_lost_count or 0,
        duelsActive=duels_active_count or 0
    )

@router.get("/me/ranking", response_model=RankingResponse)
async def read_user_ranking(group_id: Optional[int] = None, current_user: Usuario = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if group_id is not None:
        from app.models.grupo import MiembroGrupo
        my_member = await db.scalar(select(MiembroGrupo).where(MiembroGrupo.usuario_id == current_user.id, MiembroGrupo.grupo_id == group_id))
        if not my_member:
            return RankingResponse(rankingPosition=1)
        higher_count = await db.scalar(select(func.count(MiembroGrupo.id)).where(MiembroGrupo.grupo_id == group_id, MiembroGrupo.saldo_grupo > my_member.saldo_grupo))
        return RankingResponse(rankingPosition=(higher_count or 0) + 1)

    higher_balance_count = await db.scalar(select(func.count()).select_from(Usuario).where(Usuario.saldo_actual > current_user.saldo_actual))
    return RankingResponse(rankingPosition=(higher_balance_count or 0) + 1)

@router.get("/me/transactions", response_model=List[TransactionResponse])
async def read_user_transactions(group_id: Optional[int] = None, current_user: Usuario = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(LedgerTransaccion).where(LedgerTransaccion.usuario_id == current_user.id)
    if group_id is not None:
        stmt = stmt.where(LedgerTransaccion.grupo_id == group_id)
    stmt = stmt.order_by(LedgerTransaccion.fecha_creacion.desc()).limit(20)
    result = await db.execute(stmt)
    transactions = result.scalars().all()
    response = []
    for tx in transactions:
        response.append(TransactionResponse(
            id=tx.id,
            type='income' if tx.cantidad > 0 else 'expense',
            amount=tx.cantidad,
            concept=tx.concepto,
            date=tx.fecha_creacion.isoformat(),
            balance=tx.saldo_resultante
        ))
    return response


@router.patch("/me", response_model=UserResponse)
async def update_user_me(user_update: UserUpdate, current_user: Usuario = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user_update.username is not None:
        # Verificar que no exista otro
        existing = await db.scalar(select(Usuario).where(Usuario.username == user_update.username, Usuario.id != current_user.id))
        if existing:
            raise HTTPException(status_code=400, detail="Nombre de usuario en uso")
        current_user.username = user_update.username
    if user_update.bio is not None:
        current_user.bio = user_update.bio
    
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.put("/me/avatar", response_model=UserResponse)
async def update_user_avatar(file: UploadFile = File(...), current_user: Usuario = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
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
async def read_stat_details(stat_type: str, group_id: Optional[int] = None, current_user: Usuario = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    from sqlalchemy import not_
    details = []

    if stat_type in ['betsActive', 'betsWon', 'betsLost', 'tokensActive', 'tokensWon', 'tokensLost']:
        # Fetch creator users for mapped names
        users_result = await db.execute(select(Usuario))
        users_map = {u.id: u.username for u in users_result.scalars().all()}
        
        # Bets logic
        query = select(TicketApuesta).options(joinedload(TicketApuesta.apuesta)).where(TicketApuesta.usuario_id == current_user.id)
        if group_id is not None:
            query = query.join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id).where(Apuesta.grupo_id == group_id)

        
        result = await db.execute(query)
        tickets = result.scalars().all()
        
        for ticket in tickets:
            bet = ticket.apuesta
            
            # Filter condition
            if stat_type in ('betsActive', 'tokensActive'):
                if bet.estado != 'abierta':
                    continue
            elif stat_type in ('betsWon', 'tokensWon'):
                if bet.estado != 'cerrada' or ticket.opcion_id != bet.opcion_ganadora_id:
                    continue
            elif stat_type in ('betsLost', 'tokensLost'):
                if bet.estado != 'cerrada' or ticket.opcion_id == bet.opcion_ganadora_id:
                    continue
                    
            options_list = []
            if bet.opciones:
                for opt_id, opt_data in bet.opciones.items():
                    options_list.append({
                        "id": opt_id, 
                        "text": opt_data["text"], 
                        "multiplier": opt_data["multiplier"]
                    })
                    
            user_won = None
            profit = 0
            winning_option = None
            multiplier = None
            
            if bet.estado == "cerrada" and bet.opcion_ganadora_id and bet.opciones:
                winning_option = bet.opciones.get(bet.opcion_ganadora_id, {}).get("text")
                multiplier = float(bet.opciones.get(bet.opcion_ganadora_id, {}).get("multiplier", 0))
                user_won = (ticket.opcion_id == bet.opcion_ganadora_id)
                if user_won:
                    profit = ticket.cantidad * float(bet.opciones.get(ticket.opcion_id, {}).get("multiplier", 0))
            
            votos = bet.votos_sugerencia or {}
            upvotes = sum(1 for v in votos.values() if v == "up")
            downvotes = sum(1 for v in votos.values() if v == "down")
            user_vote = votos.get(str(current_user.id))
            
            details.append({
                "id": str(bet.id),
                "title": bet.titulo,
                "creator": users_map.get(bet.creador_id, "Admin"),
                "phase": bet.fase,
                "estado": bet.estado,
                "opcion_ganadora_id": bet.opcion_ganadora_id,
                "options": options_list,
                "userVotedOptionId": ticket.opcion_id,
                "userBetAmount": ticket.cantidad,
                "userWon": user_won,
                "profit": int(profit),
                "winningOption": winning_option,
                "multiplier": multiplier,
                "upvotes": upvotes,
                "downvotes": downvotes,
                "user_vote": user_vote,
                "createdAt": bet.fecha_creacion.isoformat() + 'Z' if bet.fecha_creacion else None,
                "approvedAt": bet.fecha_aprobacion.isoformat() + 'Z' if bet.fecha_aprobacion else None,
                "item_type": "bet"
            })

    # Duels logic
    if stat_type in ['duelsActive', 'duelsWon', 'duelsLost', 'tokensActive', 'tokensWon', 'tokensLost']:
        query = select(Duelo).options(joinedload(Duelo.retador), joinedload(Duelo.retado)).where(or_(Duelo.retador_id == current_user.id, Duelo.retado_id == current_user.id))
        
        result = await db.execute(query)
        duels = result.scalars().all()
        
        for d in duels:
            # Filter condition
            if stat_type in ('duelsActive', 'tokensActive'):
                if d.estado in ('completed', 'penalized_challenger', 'penalized_challenged'):
                    continue
            elif stat_type in ('duelsWon', 'tokensWon'):
                if d.estado != 'completed' or d.ganador_id != current_user.id:
                    continue
            elif stat_type in ('duelsLost', 'tokensLost'):
                if d.estado != 'completed' or d.ganador_id is None or d.ganador_id == current_user.id:
                    continue
                    
            winner = None
            if d.ganador_id:
                winner = d.retador.username if d.ganador_id == d.retador_id else d.retado.username
                
            details.append({
                "id": d.id,
                "challenger": d.retador.username,
                "challenged": d.retado.username,
                "game": d.juego,
                "wager": d.tokens_en_juego,
                "status": d.estado,
                "winner": winner,
                "is_current_user_challenged": current_user.id == d.retado_id,
                "challenger_avatar": d.retador.avatar_url,
                "challenged_avatar": d.retado.avatar_url,
                "fecha_creacion": d.fecha_creacion.isoformat() + "Z" if d.fecha_creacion else None,
                "reported_resolution": d.reported_resolution,
                "item_type": "duel"
            })

    if stat_type in ['tokensWon', 'tokensLost']:
        query = select(LedgerTransaccion).where(
            and_(
                LedgerTransaccion.usuario_id == current_user.id,
                not_(LedgerTransaccion.concepto.ilike('%Apuesta%')),
                not_(LedgerTransaccion.concepto.ilike('%Retención%')),
                not_(LedgerTransaccion.concepto.ilike('%Premio doble%'))
            )
        )
        if stat_type == 'tokensWon':
            query = query.where(LedgerTransaccion.cantidad > 0)
        else:
            query = query.where(LedgerTransaccion.cantidad < 0)
            
        tx_result = await db.execute(query)
        transactions = tx_result.scalars().all()
        
        for tx in transactions:
            details.append({
                "id": str(tx.id),
                "type": 'income' if tx.cantidad > 0 else 'expense',
                "amount": abs(tx.cantidad),
                "concept": tx.concepto,
                "date": tx.fecha_creacion.isoformat() + 'Z' if tx.fecha_creacion.tzinfo is None and not tx.fecha_creacion.isoformat().endswith('Z') else tx.fecha_creacion.isoformat(),
                "balance": tx.saldo_resultante,
                "item_type": "transaction"
            })

    if stat_type in ['tokensActive', 'tokensWon', 'tokensLost']:
        # Sort by date descending for combined active list
        details.sort(key=lambda x: x.get('createdAt') or x.get('fecha_creacion') or x.get('date') or '', reverse=True)

    return details

from datetime import datetime, timezone

@router.get("/{username}/profile")
async def get_user_profile(username: str, db: AsyncSession = Depends(get_db)):
    from app.models.publicaciones import Publicacion
    
    user = await db.scalar(select(Usuario).where(Usuario.username == username))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    posts_result = await db.execute(
        select(Publicacion)
        .where(Publicacion.autor_id == user.id)
        .order_by(Publicacion.fecha_creacion.desc())
    )
    posts = posts_result.scalars().all()
    
    formatted_posts = []
    for p in posts:
        diff = datetime.now(timezone.utc) - p.fecha_creacion
        if diff.days > 0:
            time_ago = f"hace {diff.days} d"
        elif diff.seconds // 3600 > 0:
            time_ago = f"hace {diff.seconds // 3600} h"
        elif diff.seconds // 60 > 0:
            time_ago = f"hace {diff.seconds // 60} min"
        else:
            time_ago = "ahora"

        formatted_posts.append({
            "id": p.id,
            "type": p.tipo,
            "author": user.username,
            "author_avatar_url": user.avatar_url,
            "time_ago": time_ago,
            "content": p.contenido,
            "media_url": p.media_url,
            "is_system": p.es_sistema
        })
        
    return {
        "avatar_url": user.avatar_url,
        "bio": user.bio,
        "posts": formatted_posts
    }

@router.get("/{username}/activity/apuestas")
async def get_user_activity_apuestas(username: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    
    user = await db.scalar(select(Usuario).where(Usuario.username == username))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    users_result = await db.execute(select(Usuario))
    users_map = {u.id: u.username for u in users_result.scalars().all()}
    
    query = select(TicketApuesta).options(joinedload(TicketApuesta.apuesta)).where(TicketApuesta.usuario_id == user.id)
    result = await db.execute(query)
    tickets = result.scalars().all()
    
    details = []
    for ticket in tickets:
        bet = ticket.apuesta
        options_list = []
        if bet.opciones:
            for opt_id, opt_data in bet.opciones.items():
                options_list.append({
                    "id": opt_id, 
                    "text": opt_data["text"], 
                    "multiplier": opt_data["multiplier"]
                })
                
        user_won = None
        profit = 0
        winning_option = None
        multiplier = None
        
        if bet.estado == "cerrada" and bet.opcion_ganadora_id and bet.opciones:
            winning_option = bet.opciones.get(bet.opcion_ganadora_id, {}).get("text")
            multiplier = float(bet.opciones.get(bet.opcion_ganadora_id, {}).get("multiplier", 0))
            user_won = (ticket.opcion_id == bet.opcion_ganadora_id)
            if user_won:
                profit = ticket.cantidad * float(bet.opciones.get(ticket.opcion_id, {}).get("multiplier", 0))
        
        votos = bet.votos_sugerencia or {}
        upvotes = sum(1 for v in votos.values() if v == "up")
        downvotes = sum(1 for v in votos.values() if v == "down")
        user_vote = votos.get(str(user.id))
        
        details.append({
            "id": str(bet.id),
            "title": bet.titulo,
            "creator": users_map.get(bet.creador_id, "Admin"),
            "phase": bet.fase,
            "estado": bet.estado,
            "opcion_ganadora_id": bet.opcion_ganadora_id,
            "options": options_list,
            "userVotedOptionId": ticket.opcion_id,
            "userBetAmount": ticket.cantidad,
            "userWon": user_won,
            "profit": int(profit),
            "winningOption": winning_option,
            "multiplier": multiplier,
            "upvotes": upvotes,
            "downvotes": downvotes,
            "user_vote": user_vote,
            "createdAt": bet.fecha_creacion.isoformat() + 'Z' if bet.fecha_creacion else None,
            "approvedAt": bet.fecha_aprobacion.isoformat() + 'Z' if bet.fecha_aprobacion else None,
            "item_type": "bet"
        })
        
    details.sort(key=lambda x: x.get('createdAt') or '', reverse=True)
    return details

@router.get("/{username}/activity/duelos")
async def get_user_activity_duelos(username: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    
    user = await db.scalar(select(Usuario).where(Usuario.username == username))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    query = select(Duelo).options(joinedload(Duelo.retador), joinedload(Duelo.retado)).where(or_(Duelo.retador_id == user.id, Duelo.retado_id == user.id))
    result = await db.execute(query)
    duels = result.scalars().all()
    
    details = []
    for d in duels:
        winner = None
        if d.ganador_id:
            winner = d.retador.username if d.ganador_id == d.retador_id else d.retado.username
            
        details.append({
            "id": d.id,
            "challenger": d.retador.username,
            "challenged": d.retado.username,
            "game": d.juego,
            "wager": d.tokens_en_juego,
            "status": d.estado,
            "winner": winner,
            "is_current_user_challenged": user.id == d.retado_id,
            "challenger_avatar": d.retador.avatar_url,
            "challenged_avatar": d.retado.avatar_url,
            "fecha_creacion": d.fecha_creacion.isoformat() + "Z" if d.fecha_creacion else None,
            "reported_resolution": d.reported_resolution,
            "item_type": "duel"
        })
        
    details.sort(key=lambda x: x.get('fecha_creacion') or '', reverse=True)
    return details

@router.get("/{username}/activity/misiones")
async def get_user_activity_misiones(username: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    
    user = await db.scalar(select(Usuario).where(Usuario.username == username))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    query = select(PruebaMision).options(joinedload(PruebaMision.mision)).where(
        and_(
            PruebaMision.usuario_id == user.id,
            PruebaMision.estado == 'approved'
        )
    )
    result = await db.execute(query)
    pruebas = result.scalars().all()
    
    details = []
    for p in pruebas:
        details.append({
            "id": p.id,
            "mision_id": p.mision_id,
            "titulo": p.mision.titulo,
            "recompensa": p.mision.recompensa,
            "fecha_completada": p.fecha_creacion.isoformat() + 'Z' if p.fecha_creacion else None
        })
        
    details.sort(key=lambda x: x.get('fecha_completada') or '', reverse=True)
    return details
