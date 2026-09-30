from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.juegos import TicketApuesta
from app.models.notificaciones import NotificacionAdmin, NotificacionLeida
from app.models.push import PushSubscription
from app.models.usuario import Usuario
from app.schemas.admin_schemas import (
    DailySummaryStatsResponse,
    NotificacionResponse,
)
from app.services.boletin_service import calculate_summary_stats
from app.services.push_service import get_vapid_public_key

router = APIRouter(tags=["Notifications (Users)"], dependencies=[Depends(get_current_user)])


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: dict


@router.get("/vapid-public-key")
async def read_vapid_public_key():
    """
    Devuelve la clave publica VAPID para que el navegador del cliente pueda suscribirse a WebPush.
    """
    return {"public_key": get_vapid_public_key()}


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe_push(
    body: PushSubscribeRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Registra una suscripción WebPush de dispositivo móvil/escritorio para el usuario autenticado.
    """
    p256dh = body.keys.get("p256dh", "")
    auth = body.keys.get("auth", "")

    if not body.endpoint or not p256dh or not auth:
        raise HTTPException(status_code=400, detail="Datos de suscripcion WebPush incompletos")

    existing = await db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == body.endpoint)
    )
    if existing:
        existing.usuario_id = current_user.id
        existing.p256dh = p256dh
        existing.auth = auth
    else:
        new_sub = PushSubscription(
            usuario_id=current_user.id, endpoint=body.endpoint, p256dh=p256dh, auth=auth
        )
        db.add(new_sub)

    await db.commit()
    return {"message": "Suscripcion WebPush registrada con éxito"}


@router.post("/unsubscribe")
async def unsubscribe_push(
    body: PushSubscribeRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = delete(PushSubscription).where(
        and_(
            PushSubscription.usuario_id == current_user.id,
            PushSubscription.endpoint == body.endpoint,
        )
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": "Suscripcion eliminada con éxito"}


@router.get("/unread", response_model=Optional[NotificacionResponse])
async def get_unread_notification(
    current_user: Usuario = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """
    Recupera la siguiente notificación pendiente de lectura aplicable al usuario actual.

    Optimización contra Consultas N+1:
    El frontend ejecuta un sondeo (short-polling) cada 15 segundos contra este endpoint.
    Para evitar descargar cientos de notificaciones pasadas y consultar la tabla 'NotificacionLeida'
    en un bucle por cada una, utilizamos una subconsulta SQL indexada ('notin_(subq_leidas)').
    De este modo, PostgreSQL descarta en un solo paso todas las notificaciones que el usuario ya leyó.
    """
    from sqlalchemy import func

    # 1. Subconsulta con los IDs de las notificaciones que el usuario ya ha leído
    subq_leidas = select(NotificacionLeida.notificacion_id).where(
        NotificacionLeida.usuario_id == current_user.id
    )

    # 2. Filtrar solo notificaciones enviadas o programadas vencidas que no hayan sido leídas por el usuario
    stmt = (
        select(NotificacionAdmin)
        .where(
            (
                (NotificacionAdmin.estado == "sent")
                | (
                    (NotificacionAdmin.estado == "pending")
                    & (NotificacionAdmin.fecha_programada <= func.now())
                )
            ),
            NotificacionAdmin.id.notin_(subq_leidas),
        )
        .order_by(NotificacionAdmin.fecha_creacion.asc())
    )

    result = await db.execute(stmt)
    candidate_notifications = result.scalars().all()

    # 3. Comprobar si el usuario ha apostado hoy para la regla de segmentación 'no_bet'
    bet_stmt = select(TicketApuesta).where(
        and_(TicketApuesta.usuario_id == current_user.id, TicketApuesta.fecha == date.today())
    )
    has_bet_today = (await db.scalar(bet_stmt)) is not None

    # 4. Evaluar criterios de audiencia sobre las candidatas no leídas
    for notif in candidate_notifications:
        applies = False
        if notif.destinatario_tipo == "all":
            applies = True
        elif notif.destinatario_tipo == "specific" and notif.destinatario_id == current_user.id:
            applies = True
        elif notif.destinatario_tipo == "bankrupt" and current_user.saldo_actual <= 0:
            applies = True
        elif notif.destinatario_tipo == "no_bet" and not has_bet_today:
            applies = True

        if applies:
            # Si era una notificación programada cuya fecha venció, la marcamos como formalmente enviada
            if notif.estado == "pending":
                notif.estado = "sent"
                await db.commit()
            return notif

    return None


@router.post("/{notif_id}/read")
async def mark_notification_as_read(
    notif_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    leida = await db.scalar(
        select(NotificacionLeida).where(
            and_(
                NotificacionLeida.usuario_id == current_user.id,
                NotificacionLeida.notificacion_id == notif_id,
            )
        )
    )

    if not leida:
        nueva_leida = NotificacionLeida(usuario_id=current_user.id, notificacion_id=notif_id)
        db.add(nueva_leida)
        await db.commit()

    return {"status": "success"}


@router.get("/boletin-stats", response_model=DailySummaryStatsResponse)
async def get_boletin_stats(
    group_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Recupera las estadísticas destacadas de la jornada para el boletín informativo matutino.
    Soporta filtrado contextual por 'group_id' para aislar las métricas a la comunidad activa.
    """
    return await calculate_summary_stats(db=db, group_id=group_id)
