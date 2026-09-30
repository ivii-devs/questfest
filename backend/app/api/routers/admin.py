"""
================================================================================
ROUTER DE ADMINISTRACIÓN Y TRIBUNAL: QuestFest
================================================================================
Este enrutador centraliza todas las operaciones de control, supervisión y arbitraje
del juego. Está protegido a nivel de router por la dependencia `get_admin_user`,
lo que garantiza que ninguna ruta pueda ser invocada por un jugador raso.

Siguiendo Clean Architecture y el principio de Responsabilidad Única (SRP),
el router actúa como un controlador REST delgado, delegando la lógica de negocio
a los servicios de dominio especializados:
- app.services.bet_admin_service (apuestas y cuotas)
- app.services.duel_tribunal_service (tribunal y sentencias PvP)
- app.services.mission_tribunal_service (sugerencias y validación de pruebas)
- app.services.boletin_service (estadísticas macro y resúmenes diarios)
================================================================================
"""

from datetime import date
from typing import List, Optional

import cloudinary.uploader
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.database import get_db
from app.crud.audit_crud import log_admin_action
from app.crud.ledger_crud import move_tokens
from app.dependencies import get_admin_user, verify_group_admin
from app.models.grupo import MiembroGrupo
from app.models.juegos import TicketApuesta
from app.models.misiones import Mision
from app.models.notificaciones import NotificacionAdmin
from app.models.publicaciones import Publicacion
from app.models.usuario import LedgerTransaccion, Usuario
from app.schemas.admin_schemas import (
    AdminAprobarSugerencia,
    AdminRechazarPrueba,
    AdminResolveDuelRequest,
    AnuncioCreate,
    AudiencePreviewRequest,
    BetStatusUpdate,
    DailySummaryStatsResponse,
    GlobalStats,
    NotificacionCreate,
    NotificacionResponse,
    RuletaMisionCreate,
    UserBalanceUpdate,
)
from app.schemas.apuestas_schemas import AdminEditBetRequest
from app.schemas.auth_schemas import UserResponse
from app.schemas.user_schemas import TransactionResponse
from app.services import (
    bet_admin_service,
    duel_tribunal_service,
    mission_tribunal_service,
)
from app.services.boletin_service import calculate_summary_stats

router = APIRouter(
    tags=["Admin Panel"],
    dependencies=[Depends(get_admin_user)],
)

# --------------------------------------------------------------------------
# 1. GESTIÓN DE CONTENIDO Y MEDIOS
# --------------------------------------------------------------------------


@router.post("/upload-media")
async def upload_media(file: UploadFile = File(...)):
    """
    Sube un archivo multimedia (imagen o vídeo) directamente a Cloudinary.

    ¿Por qué usamos `run_in_threadpool`?
    El SDK de Cloudinary es síncrono y bloqueante. Si se ejecutara directamente en el
    hilo principal de asyncio, paralizaría el procesamiento de peticiones concurrentes.
    """
    try:
        result = await run_in_threadpool(cloudinary.uploader.upload, file.file)
        return {"url": result.get("secure_url")}
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Error subiendo archivo a Cloudinary: {str(exc)}"
        )


@router.post("/announcements")
async def create_announcement(
    anuncio: AnuncioCreate,
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Publica un anuncio institucional en el Muro Social.
    Si se indica group_id, verifica la jurisdicción del administrador para ese grupo.
    """
    if anuncio.group_id is not None:
        await verify_group_admin(db, current_user, anuncio.group_id)

    pub = Publicacion(
        tipo="social",
        es_sistema=True,
        contenido=anuncio.contenido,
        media_url=anuncio.media_url,
        grupo_id=anuncio.group_id,
    )
    db.add(pub)
    await db.commit()
    return {"message": "Anuncio creado"}


# --------------------------------------------------------------------------
# 2. SISTEMA DE NOTIFICACIONES ADMINISTRATIVAS
# --------------------------------------------------------------------------


@router.post("/notifications", response_model=NotificacionResponse)
async def create_notification(
    notif: NotificacionCreate,
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Emite o programa una notificación dirigida a una audiencia determinada.
    Si se especifica group_id, certifica que el administrador tenga jurisdicción territorial.
    """
    if notif.group_id is not None:
        await verify_group_admin(db, current_user, notif.group_id)

    nueva = NotificacionAdmin(
        titulo=notif.titulo,
        mensaje=notif.mensaje,
        media_url=notif.media_url,
        fecha_programada=notif.fecha_programada,
        destinatario_tipo=notif.destinatario_tipo,
        destinatario_id=notif.destinatario_id,
        config_boletin=notif.config_boletin,
        estado="pending" if notif.fecha_programada else "sent",
    )
    db.add(nueva)
    await db.commit()
    await db.refresh(nueva)
    return nueva


@router.post("/notifications/preview-audience", response_model=List[UserResponse])
async def preview_audience(request: AudiencePreviewRequest, db: AsyncSession = Depends(get_db)):
    """
    Permite al administrador ver qué usuarios recibirán el aviso antes de lanzarlo.
    Soporta segmentaciones: 'all', 'bankrupt', 'specific', 'no_bet'.
    """
    if request.destinatario_tipo == "all":
        result = await db.execute(select(Usuario))
        return result.scalars().all()
    elif request.destinatario_tipo == "bankrupt":
        result = await db.execute(select(Usuario).where(Usuario.saldo_actual <= 0))
        return result.scalars().all()
    elif request.destinatario_tipo == "specific":
        if not request.destinatario_id:
            return []
        result = await db.execute(select(Usuario).where(Usuario.id == request.destinatario_id))
        return result.scalars().all()
    elif request.destinatario_tipo == "no_bet":
        subq = (
            select(TicketApuesta.usuario_id).where(TicketApuesta.fecha == date.today()).subquery()
        )
        result = await db.execute(select(Usuario).where(Usuario.id.notin_(select(subq))))
        return result.scalars().all()
    return []


@router.get("/notifications", response_model=List[NotificacionResponse])
async def list_notifications(db: AsyncSession = Depends(get_db)):
    """Lista el historial de notificaciones administrativas ordenadas cronológicamente."""
    result = await db.execute(
        select(NotificacionAdmin).order_by(NotificacionAdmin.fecha_creacion.desc())
    )
    return result.scalars().all()


# --------------------------------------------------------------------------
# 3. SUPERVISIÓN Y CONTROL DE USUARIOS Y FONDOS
# --------------------------------------------------------------------------


@router.get("/users/stats", response_model=GlobalStats)
async def get_global_stats(
    group_id: Optional[int] = Query(None),
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Devuelve métricas macroeconómicas del juego:
    - Número total de participantes registrados.
    - Masa monetaria global en circulación.
    Si se especifica group_id, devuelve las métricas confinadas a dicha comunidad.
    """
    if group_id is not None:
        await verify_group_admin(db, current_user, group_id)
        total_users = await db.scalar(
            select(func.count(MiembroGrupo.id)).where(MiembroGrupo.grupo_id == group_id)
        )
        total_tokens = await db.scalar(
            select(func.sum(MiembroGrupo.saldo_grupo)).where(MiembroGrupo.grupo_id == group_id)
        )
        return GlobalStats(total_users=total_users or 0, total_tokens=total_tokens or 0)

    if current_user.rol != "admin":
        admin_groups_subq = select(MiembroGrupo.grupo_id).where(
            MiembroGrupo.usuario_id == current_user.id,
            MiembroGrupo.rol == "admin",
        )
        total_users = await db.scalar(
            select(func.count(func.distinct(MiembroGrupo.usuario_id))).where(
                MiembroGrupo.grupo_id.in_(admin_groups_subq)
            )
        )
        total_tokens = await db.scalar(
            select(func.sum(MiembroGrupo.saldo_grupo)).where(
                MiembroGrupo.grupo_id.in_(admin_groups_subq)
            )
        )
        return GlobalStats(total_users=total_users or 0, total_tokens=total_tokens or 0)

    total_users = await db.scalar(select(func.count(Usuario.id)))
    total_tokens = await db.scalar(select(func.sum(Usuario.saldo_actual)))
    return GlobalStats(total_users=total_users or 0, total_tokens=total_tokens or 0)


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    group_id: Optional[int] = Query(None),
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lista de usuarios para el panel de administración.
    Si se especifica group_id, confina los usuarios a los miembros de ese grupo
    y refleja el saldo específico de grupo ('saldo_grupo').
    """
    if group_id is not None:
        await verify_group_admin(db, current_user, group_id)
        stmt = (
            select(Usuario, MiembroGrupo.saldo_grupo)
            .join(MiembroGrupo, MiembroGrupo.usuario_id == Usuario.id)
            .where(MiembroGrupo.grupo_id == group_id)
            .order_by(Usuario.username)
        )
        res = await db.execute(stmt)
        users = []
        for user_obj, saldo_grupo in res.all():
            users.append(
                UserResponse(
                    id=user_obj.id,
                    username=user_obj.username,
                    saldo_actual=saldo_grupo if saldo_grupo is not None else 0,
                    rol=user_obj.rol,
                    bio=user_obj.bio,
                    avatar_url=user_obj.avatar_url,
                )
            )
        return users

    if current_user.rol == "admin":
        result = await db.execute(select(Usuario).order_by(Usuario.username))
        return result.scalars().all()

    admin_groups_subq = select(MiembroGrupo.grupo_id).where(
        MiembroGrupo.usuario_id == current_user.id,
        MiembroGrupo.rol == "admin",
    )
    stmt = (
        select(Usuario)
        .join(MiembroGrupo, MiembroGrupo.usuario_id == Usuario.id)
        .where(MiembroGrupo.grupo_id.in_(admin_groups_subq))
        .distinct()
        .order_by(Usuario.username)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/users/{user_id}/balance", response_model=UserResponse)
async def update_user_balance(
    user_id: int,
    update_data: UserBalanceUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: Usuario = Depends(get_admin_user),
):
    """
    Ajuste manual de saldo ejecutado por un administrador con registro en Ledger y auditoría.
    """
    user = await db.scalar(select(Usuario).where(Usuario.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    target_group_id = update_data.group_id
    if target_group_id is not None:
        await verify_group_admin(db, admin_user, target_group_id)
        await move_tokens(
            db=db,
            user_id=user.id,
            amount=update_data.cantidad,
            concept=update_data.concepto,
            group_id=target_group_id,
            auto_commit=False,
        )

        notif = NotificacionAdmin(
            titulo="Actualización de Saldo",
            mensaje=update_data.concepto,
            destinatario_tipo="specific",
            destinatario_id=user.id,
            estado="sent",
        )
        db.add(notif)

        await log_admin_action(
            db=db,
            admin_id=admin_user.id,
            action="update_user_balance",
            entity="usuario",
            entity_id=user_id,
            details={
                "cantidad": update_data.cantidad,
                "concepto": update_data.concepto,
                "grupo_id": target_group_id,
            },
        )
        await db.commit()

        res_miembro = await db.scalar(
            select(MiembroGrupo.saldo_grupo).where(
                MiembroGrupo.usuario_id == user.id,
                MiembroGrupo.grupo_id == target_group_id,
            )
        )
        return UserResponse(
            id=user.id,
            username=user.username,
            saldo_actual=res_miembro if res_miembro is not None else 0,
            rol=user.rol,
            bio=user.bio,
            avatar_url=user.avatar_url,
        )
    else:
        if admin_user.rol != "admin":
            raise HTTPException(
                status_code=403,
                detail="Se requiere especificar el grupo para actualizar el saldo del usuario.",
            )
        user.saldo_actual += update_data.cantidad
        if user.saldo_actual < 0:
            user.saldo_actual = 0

        tx = LedgerTransaccion(
            usuario_id=user.id,
            cantidad=update_data.cantidad,
            concepto=update_data.concepto,
            saldo_resultante=user.saldo_actual,
        )
        db.add(tx)

        notif = NotificacionAdmin(
            titulo="Actualización de Saldo",
            mensaje=update_data.concepto,
            destinatario_tipo="specific",
            destinatario_id=user.id,
            estado="sent",
        )
        db.add(notif)

        await log_admin_action(
            db=db,
            admin_id=admin_user.id,
            action="update_user_balance",
            entity="usuario",
            entity_id=user_id,
            details={
                "cantidad": update_data.cantidad,
                "concepto": update_data.concepto,
                "saldo_nuevo": user.saldo_actual,
            },
        )

        await db.commit()
        await db.refresh(user)
        return user


@router.get("/users/{user_id}/transactions", response_model=List[TransactionResponse])
async def get_user_transactions(
    user_id: int,
    group_id: Optional[int] = Query(None),
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Historial completo de movimientos contables de un usuario concreto."""
    if group_id is not None:
        await verify_group_admin(db, current_user, group_id)
        stmt = (
            select(LedgerTransaccion)
            .where(
                (LedgerTransaccion.usuario_id == user_id) & (LedgerTransaccion.grupo_id == group_id)
            )
            .order_by(LedgerTransaccion.fecha_creacion.desc())
        )
    else:
        stmt = (
            select(LedgerTransaccion)
            .where(LedgerTransaccion.usuario_id == user_id)
            .order_by(LedgerTransaccion.fecha_creacion.desc())
        )
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


# --------------------------------------------------------------------------
# 4. RULETA Y RESÚMENES DIARIOS
# --------------------------------------------------------------------------


@router.post("/roulette", response_model=dict)
async def create_roulette_mission(
    mision: RuletaMisionCreate,
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Crea una misión exclusiva para el bombo de la Ruleta Diaria.
    Nace con `es_ruleta=True` y en fase 'activa'.
    """
    if mision.group_id is not None:
        await verify_group_admin(db, current_user, mision.group_id)

    nueva_mision = Mision(
        titulo=mision.titulo,
        descripcion=mision.descripcion,
        recompensa=mision.recompensa,
        creador_id=current_user.id,
        grupo_id=mision.group_id,
        fase="global",
        estado="activa",
        es_ruleta=True,
        media_url=mision.media_url,
    )
    db.add(nueva_mision)
    await db.commit()
    return {"message": "Misión de ruleta añadida al bombo"}


@router.get("/summary-stats", response_model=DailySummaryStatsResponse)
async def get_summary_stats(
    group_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Genera el resumen estadístico diario para el boletín matutino de la fiesta."""
    return await calculate_summary_stats(db=db, group_id=group_id)


# --------------------------------------------------------------------------
# 5. GESTIÓN Y RESOLUCIÓN DE APUESTAS (DELEGADO EN BET_ADMIN_SERVICE)
# --------------------------------------------------------------------------


@router.put("/bets/{bet_id}")
async def edit_suggested_bet(
    bet_id: int,
    edit_data: AdminEditBetRequest,
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Permite al administrador corregir el texto o cuotas de una apuesta sugerida."""
    return await bet_admin_service.edit_suggested_bet(
        db=db, bet_id=bet_id, edit_data=edit_data, current_user=current_user
    )


@router.patch("/bets/{bet_id}/status")
async def update_bet_status(
    bet_id: int,
    update_data: BetStatusUpdate,
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Transición de estados y liquidación atómica de apuestas."""
    return await bet_admin_service.update_bet_status(
        db=db, bet_id=bet_id, update_data=update_data, current_user=current_user
    )


# --------------------------------------------------------------------------
# 6. TRIBUNAL ADMINISTRATIVO DE DUELOS (DELEGADO EN DUEL_TRIBUNAL_SERVICE)
# --------------------------------------------------------------------------


@router.get("/duels")
async def get_admin_duels(
    group_id: Optional[int] = Query(None),
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene los duelos para el panel del Tribunal Administrativo."""
    return await duel_tribunal_service.get_admin_duels(
        db=db, current_user=current_user, group_id=group_id
    )


@router.patch("/duels/{duel_id}/resolve")
async def resolve_duel_admin(
    duel_id: int,
    resolve_data: AdminResolveDuelRequest,
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Dicta sentencia sobre un duelo en conflicto o arbitraje disciplinario."""
    return await duel_tribunal_service.resolve_duel_admin(
        db=db, duel_id=duel_id, resolve_data=resolve_data, current_user=current_user
    )


# --------------------------------------------------------------------------
# 7. TRIBUNAL DE MISIONES Y PRUEBAS (DELEGADO EN MISSION_TRIBUNAL_SERVICE)
# --------------------------------------------------------------------------


@router.get("/misiones/sugerencias")
async def get_admin_sugerencias(
    group_id: Optional[int] = Query(None),
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene las sugerencias de misiones pendientes de evaluación."""
    return await mission_tribunal_service.get_admin_sugerencias(
        db=db, current_user=current_user, group_id=group_id
    )


@router.patch("/misiones/{mision_id}/sugerencia/aprobar")
async def aprobar_sugerencia(
    mision_id: int,
    data: AdminAprobarSugerencia,
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Aprueba una sugerencia de misión asignando recompensa y publicándola."""
    return await mission_tribunal_service.aprobar_sugerencia(
        db=db, mision_id=mision_id, data=data, current_user=current_user
    )


@router.patch("/misiones/{mision_id}/sugerencia/rechazar")
async def rechazar_sugerencia(
    mision_id: int,
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Descarta y elimina una propuesta de misión no apta."""
    return await mission_tribunal_service.rechazar_sugerencia(
        db=db, mision_id=mision_id, current_user=current_user
    )


@router.get("/misiones/pruebas")
async def get_admin_pruebas(
    group_id: Optional[int] = Query(None),
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene las pruebas gráficas o escritas pendientes de homologación."""
    return await mission_tribunal_service.get_admin_pruebas(
        db=db, current_user=current_user, group_id=group_id
    )


@router.patch("/misiones/pruebas/{prueba_id}/validar")
async def validar_prueba(
    prueba_id: int,
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Valida la prueba de una misión y acredita recompensa en Ledger."""
    return await mission_tribunal_service.validar_prueba(
        db=db, prueba_id=prueba_id, current_user=current_user
    )


@router.patch("/misiones/pruebas/{prueba_id}/rechazar")
async def rechazar_prueba(
    prueba_id: int,
    data: AdminRechazarPrueba,
    current_user: Usuario = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Rechaza una prueba con explicación pedagógica razonada."""
    return await mission_tribunal_service.rechazar_prueba(
        db=db, prueba_id=prueba_id, data=data, current_user=current_user
    )
