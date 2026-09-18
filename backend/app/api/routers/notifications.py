from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from typing import Optional
from datetime import date
from pydantic import BaseModel

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.usuario import Usuario, LedgerTransaccion
from app.models.notificaciones import NotificacionAdmin, NotificacionLeida
from app.models.juegos import TicketApuesta, Duelo, Apuesta
from app.models.misiones import PruebaMision
from app.models.push import PushSubscription
from app.schemas.admin_schemas import NotificacionResponse, DailySummaryStatsResponse, StatUser, DuelStat
from app.services.push_service import get_vapid_public_key

router = APIRouter(
    tags=["Notifications (Users)"],
    dependencies=[Depends(get_current_user)]
)

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
    db: AsyncSession = Depends(get_db)
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
            usuario_id=current_user.id,
            endpoint=body.endpoint,
            p256dh=p256dh,
            auth=auth
        )
        db.add(new_sub)

    await db.commit()
    return {"message": "Suscripcion WebPush registrada con éxito"}

@router.post("/unsubscribe")
async def unsubscribe_push(
    body: PushSubscribeRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = delete(PushSubscription).where(
        and_(
            PushSubscription.usuario_id == current_user.id,
            PushSubscription.endpoint == body.endpoint
        )
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": "Suscripcion eliminada con éxito"}

@router.get("/unread", response_model=Optional[NotificacionResponse])
async def get_unread_notification(
    current_user: Usuario = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
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
    subq_leidas = select(NotificacionLeida.notificacion_id).where(NotificacionLeida.usuario_id == current_user.id)
    
    # 2. Filtrar solo notificaciones enviadas o programadas vencidas que no hayan sido leídas por el usuario
    stmt = select(NotificacionAdmin).where(
        (
            (NotificacionAdmin.estado == 'sent') | 
            ((NotificacionAdmin.estado == 'pending') & (NotificacionAdmin.fecha_programada <= func.now()))
        ),
        NotificacionAdmin.id.notin_(subq_leidas)
    ).order_by(NotificacionAdmin.fecha_creacion.asc())
    
    result = await db.execute(stmt)
    candidate_notifications = result.scalars().all()
    
    # 3. Comprobar si el usuario ha apostado hoy para la regla de segmentación 'no_bet'
    bet_stmt = select(TicketApuesta).where(
        and_(
            TicketApuesta.usuario_id == current_user.id,
            TicketApuesta.fecha == date.today()
        )
    )
    has_bet_today = (await db.scalar(bet_stmt)) is not None

    # 4. Evaluar criterios de audiencia sobre las candidatas no leídas
    for notif in candidate_notifications:
        applies = False
        if notif.destinatario_tipo == 'all':
            applies = True
        elif notif.destinatario_tipo == 'specific' and notif.destinatario_id == current_user.id:
            applies = True
        elif notif.destinatario_tipo == 'bankrupt' and current_user.saldo_actual <= 0:
            applies = True
        elif notif.destinatario_tipo == 'no_bet' and not has_bet_today:
            applies = True
            
        if applies:
            # Si era una notificación programada cuya fecha venció, la marcamos como formalmente enviada
            if notif.estado == 'pending':
                notif.estado = 'sent'
                await db.commit()
            return notif
            
    return None

@router.post("/{notif_id}/read")
async def mark_notification_as_read(
    notif_id: int, 
    current_user: Usuario = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    leida = await db.scalar(select(NotificacionLeida).where(
        and_(
            NotificacionLeida.usuario_id == current_user.id,
            NotificacionLeida.notificacion_id == notif_id
        )
    ))
    
    if not leida:
        nueva_leida = NotificacionLeida(
            usuario_id=current_user.id,
            notificacion_id=notif_id
        )
        db.add(nueva_leida)
        await db.commit()
        
    return {"status": "success"}

@router.get("/boletin-stats", response_model=DailySummaryStatsResponse)
async def get_boletin_stats(db: AsyncSession = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    from sqlalchemy import func
    from datetime import datetime, timedelta, timezone
    from sqlalchemy.orm import selectinload
    
    top1 = await db.scalar(select(Usuario).order_by(Usuario.saldo_actual.desc()).limit(1))
    last = await db.scalar(select(Usuario).order_by(Usuario.saldo_actual.asc(), Usuario.id.asc()).limit(1))
        
    stmt_miss = select(PruebaMision.usuario_id, func.count(PruebaMision.id).label('c')).where(PruebaMision.estado == 'approved').group_by(PruebaMision.usuario_id).order_by(func.count(PruebaMision.id).desc()).limit(1)
    res_miss = (await db.execute(stmt_miss)).first()
    most_miss = None
    if res_miss:
        u = await db.scalar(select(Usuario).where(Usuario.id == res_miss[0]))
        most_miss = StatUser(name=u.username, count=res_miss[1])
        
    stmt_bets = (
        select(TicketApuesta.usuario_id, func.count(TicketApuesta.id).label('c'))
        .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
        .where(
            and_(
                Apuesta.estado == 'cerrada',
                TicketApuesta.opcion_id == Apuesta.opcion_ganadora_id
            )
        )
        .group_by(TicketApuesta.usuario_id)
        .order_by(func.count(TicketApuesta.id).desc())
        .limit(1)
    )
    res_bets = (await db.execute(stmt_bets)).first()
    most_bets = None
    if res_bets:
        u = await db.scalar(select(Usuario).where(Usuario.id == res_bets[0]))
        most_bets = StatUser(name=u.username, count=res_bets[1])
        
    duel = await db.scalar(select(Duelo).where(Duelo.estado == 'completed').order_by(Duelo.tokens_en_juego.desc()).limit(1))
    duel_winner = None
    if duel:
        d_full = await db.scalar(select(Duelo).options(selectinload(Duelo.retador), selectinload(Duelo.retado)).where(Duelo.id == duel.id))
        duel_winner = DuelStat(name=d_full.retador.username, opponent=d_full.retado.username)
        
    ayer = datetime.now(timezone.utc) - timedelta(hours=24)
    stmt_win = select(LedgerTransaccion.usuario_id, func.sum(LedgerTransaccion.cantidad).label('s')).where(LedgerTransaccion.cantidad > 0, LedgerTransaccion.fecha_creacion >= ayer).group_by(LedgerTransaccion.usuario_id).order_by(func.sum(LedgerTransaccion.cantidad).desc()).limit(1)
    res_win = (await db.execute(stmt_win)).first()
    biggest_winner = None
    if res_win:
        u = await db.scalar(select(Usuario).where(Usuario.id == res_win[0]))
        biggest_winner = StatUser(name=u.username, amount=f"+{res_win[1]}")
        
    stmt_lose = select(LedgerTransaccion.usuario_id, func.sum(LedgerTransaccion.cantidad).label('s')).where(LedgerTransaccion.cantidad < 0, LedgerTransaccion.fecha_creacion >= ayer).group_by(LedgerTransaccion.usuario_id).order_by(func.sum(LedgerTransaccion.cantidad).asc()).limit(1)
    res_lose = (await db.execute(stmt_lose)).first()
    biggest_loser = None
    if res_lose:
        u = await db.scalar(select(Usuario).where(Usuario.id == res_lose[0]))
        biggest_loser = StatUser(name=u.username, amount=str(res_lose[1]))

    return DailySummaryStatsResponse(
        phase="Noche 1",
        firstPlace=StatUser(name=top1.username, points=top1.saldo_actual) if top1 else None,
        lastPlace=StatUser(name=last.username, points=last.saldo_actual) if last else None,
        mostBetsWon=most_bets,
        mostMissions=most_miss,
        duelWinner=duel_winner,
        biggestWinner=biggest_winner,
        biggestLoser=biggest_loser
    )
