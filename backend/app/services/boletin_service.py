"""
================================================================================
SERVICIO DE CÁLCULO ESTADÍSTICO DEL BOLETÍN DIARIO: QuestFest
================================================================================
Este módulo implementa el motor analítico que compila las métricas de la jornada
para el boletín informativo matutino.

¿Por qué reside en la capa de servicios (Services) y no en CRUD?
1. Separación de Responsabilidades (SRP): No gestiona la persistencia de una entidad concreta,
   sino que consolida y transforma datos agregados de múltiples dominios del juego
   (miembros, apuestas, misiones, duelos y auditoría contable).
2. Desacoplamiento de Roles: El boletín es consumido tanto por el tribunal administrativo
   (vista previa en /admin) como por los participantes del evento (/notifications/boletin-stats).
   Centralizarlo en un servicio neutral evita que controladores de usuarios dependan de admin_crud.
================================================================================
"""

from typing import Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.models.usuario import Usuario, LedgerTransaccion
from app.models.grupo import MiembroGrupo
from app.models.misiones import Mision, PruebaMision
from app.models.juegos import Apuesta, TicketApuesta, Duelo
from app.schemas.admin_schemas import DailySummaryStatsResponse, StatUser, DuelStat


async def calculate_summary_stats(db: AsyncSession, group_id: Optional[int] = None) -> DailySummaryStatsResponse:
    """
    Calcula las estadísticas para el boletín informativo diario matutino.
    
    ¿Por qué soportamos 'group_id' opcional?
    En la arquitectura multi-tenancy de QuestFest, cada comunidad posee su propio balance contable,
    sus retos específicos y sus propios mercados de apuestas. Cuando se proporciona 'group_id',
    las consultas aíslan rigurosamente las métricas al ámbito del grupo activo, evitando que
    jugadores de otras comunidades distorsionen las clasificaciones del evento local.
    Si 'group_id' es None, se proporciona la vista global de plataforma como fallback.
    """
    if group_id is not None:
        # 1. Primer puesto: miembro con mayor saldo_grupo dentro del grupo
        stmt_top = (
            select(Usuario, MiembroGrupo.saldo_grupo)
            .join(MiembroGrupo, MiembroGrupo.usuario_id == Usuario.id)
            .where(MiembroGrupo.grupo_id == group_id)
            .order_by(MiembroGrupo.saldo_grupo.desc(), Usuario.id.asc())
            .limit(1)
        )
        res_top = (await db.execute(stmt_top)).first()
        top1_user = res_top[0] if res_top else None
        top1_points = res_top[1] if res_top else 0

        # 2. Último puesto: priorizamos jugadores activos con saldo > 0 antes del 0 absoluto
        stmt_last = (
            select(Usuario, MiembroGrupo.saldo_grupo)
            .join(MiembroGrupo, MiembroGrupo.usuario_id == Usuario.id)
            .where(and_(MiembroGrupo.grupo_id == group_id, MiembroGrupo.saldo_grupo > 0))
            .order_by(MiembroGrupo.saldo_grupo.asc(), Usuario.id.asc())
            .limit(1)
        )
        res_last = (await db.execute(stmt_last)).first()
        if not res_last:
            stmt_last_all = (
                select(Usuario, MiembroGrupo.saldo_grupo)
                .join(MiembroGrupo, MiembroGrupo.usuario_id == Usuario.id)
                .where(MiembroGrupo.grupo_id == group_id)
                .order_by(MiembroGrupo.saldo_grupo.asc(), Usuario.id.asc())
                .limit(1)
            )
            res_last = (await db.execute(stmt_last_all)).first()
        last_user = res_last[0] if res_last else None
        last_points = res_last[1] if res_last else 0

        # 3. Usuario con más misiones aprobadas en este grupo
        stmt_miss = (
            select(PruebaMision.usuario_id, func.count(PruebaMision.id).label('c'))
            .join(Mision, Mision.id == PruebaMision.mision_id)
            .where(and_(Mision.grupo_id == group_id, PruebaMision.estado == 'approved'))
            .group_by(PruebaMision.usuario_id)
            .order_by(func.count(PruebaMision.id).desc())
            .limit(1)
        )
        res_miss = (await db.execute(stmt_miss)).first()
        most_miss = None
        if res_miss:
            u = await db.scalar(select(Usuario).where(Usuario.id == res_miss[0]))
            if u:
                most_miss = StatUser(name=u.username, count=res_miss[1])

        # 4. Usuario con más apuestas acertadas en este grupo
        stmt_bets = (
            select(TicketApuesta.usuario_id, func.count(TicketApuesta.id).label('c'))
            .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
            .where(
                and_(
                    Apuesta.grupo_id == group_id,
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
            if u:
                most_bets = StatUser(name=u.username, count=res_bets[1])

        # 5. Duelo más importante resuelto en el grupo
        duel = await db.scalar(
            select(Duelo)
            .where(and_(Duelo.grupo_id == group_id, Duelo.estado == 'completed'))
            .order_by(Duelo.tokens_en_juego.desc())
            .limit(1)
        )
        duel_winner = None
        if duel:
            d_full = await db.scalar(
                select(Duelo)
                .options(selectinload(Duelo.retador), selectinload(Duelo.retado))
                .where(Duelo.id == duel.id)
            )
            if d_full and d_full.retador and d_full.retado:
                winner_name = d_full.retador.username
                opponent_name = d_full.retado.username
                if d_full.ganador_id == d_full.retado_id:
                    winner_name = d_full.retado.username
                    opponent_name = d_full.retador.username
                duel_winner = DuelStat(name=winner_name, opponent=opponent_name)

        # 6. Mayores variaciones económicas en las últimas 24 horas en el grupo (Ledger)
        ayer = datetime.now(timezone.utc) - timedelta(hours=24)
        stmt_win = (
            select(LedgerTransaccion.usuario_id, func.sum(LedgerTransaccion.cantidad).label('s'))
            .where(
                and_(
                    LedgerTransaccion.grupo_id == group_id,
                    LedgerTransaccion.cantidad > 0,
                    LedgerTransaccion.fecha_creacion >= ayer
                )
            )
            .group_by(LedgerTransaccion.usuario_id)
            .order_by(func.sum(LedgerTransaccion.cantidad).desc())
            .limit(1)
        )
        res_win = (await db.execute(stmt_win)).first()
        biggest_winner = None
        if res_win:
            u = await db.scalar(select(Usuario).where(Usuario.id == res_win[0]))
            if u:
                biggest_winner = StatUser(name=u.username, amount=f"+{res_win[1]}")

        stmt_lose = (
            select(LedgerTransaccion.usuario_id, func.sum(LedgerTransaccion.cantidad).label('s'))
            .where(
                and_(
                    LedgerTransaccion.grupo_id == group_id,
                    LedgerTransaccion.cantidad < 0,
                    LedgerTransaccion.fecha_creacion >= ayer
                )
            )
            .group_by(LedgerTransaccion.usuario_id)
            .order_by(func.sum(LedgerTransaccion.cantidad).asc())
            .limit(1)
        )
        res_lose = (await db.execute(stmt_lose)).first()
        biggest_loser = None
        if res_lose:
            u = await db.scalar(select(Usuario).where(Usuario.id == res_lose[0]))
            if u:
                biggest_loser = StatUser(name=u.username, amount=str(res_lose[1]))

        return DailySummaryStatsResponse(
            phase="Noche 1",
            firstPlace=StatUser(name=top1_user.username, points=top1_points) if top1_user else None,
            lastPlace=StatUser(name=last_user.username, points=last_points) if last_user else None,
            mostBetsWon=most_bets,
            mostMissions=most_miss,
            duelWinner=duel_winner,
            biggestWinner=biggest_winner,
            biggestLoser=biggest_loser
        )

    # Fallback global de plataforma cuando no se especifica group_id
    top1 = await db.scalar(select(Usuario).order_by(Usuario.saldo_actual.desc()).limit(1))
    last = await db.scalar(select(Usuario).where(Usuario.saldo_actual > 0).order_by(Usuario.saldo_actual.asc()).limit(1))
    if not last:
        last = await db.scalar(select(Usuario).order_by(Usuario.saldo_actual.asc()).limit(1))

    stmt_miss = select(PruebaMision.usuario_id, func.count(PruebaMision.id).label('c')).where(PruebaMision.estado == 'approved').group_by(PruebaMision.usuario_id).order_by(func.count(PruebaMision.id).desc()).limit(1)
    res_miss = (await db.execute(stmt_miss)).first()
    most_miss = None
    if res_miss:
        u = await db.scalar(select(Usuario).where(Usuario.id == res_miss[0]))
        if u:
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
        if u:
            most_bets = StatUser(name=u.username, count=res_bets[1])

    duel = await db.scalar(select(Duelo).where(Duelo.estado == 'completed').order_by(Duelo.tokens_en_juego.desc()).limit(1))
    duel_winner = None
    if duel:
        d_full = await db.scalar(select(Duelo).options(selectinload(Duelo.retador), selectinload(Duelo.retado)).where(Duelo.id == duel.id))
        if d_full and d_full.retador and d_full.retado:
            winner_name = d_full.retador.username
            opponent_name = d_full.retado.username
            if d_full.ganador_id == d_full.retado_id:
                winner_name = d_full.retado.username
                opponent_name = d_full.retador.username
            duel_winner = DuelStat(name=winner_name, opponent=opponent_name)

    ayer = datetime.now(timezone.utc) - timedelta(hours=24)
    stmt_win = select(LedgerTransaccion.usuario_id, func.sum(LedgerTransaccion.cantidad).label('s')).where(LedgerTransaccion.cantidad > 0, LedgerTransaccion.fecha_creacion >= ayer).group_by(LedgerTransaccion.usuario_id).order_by(func.sum(LedgerTransaccion.cantidad).desc()).limit(1)
    res_win = (await db.execute(stmt_win)).first()
    biggest_winner = None
    if res_win:
        u = await db.scalar(select(Usuario).where(Usuario.id == res_win[0]))
        if u:
            biggest_winner = StatUser(name=u.username, amount=f"+{res_win[1]}")

    stmt_lose = select(LedgerTransaccion.usuario_id, func.sum(LedgerTransaccion.cantidad).label('s')).where(LedgerTransaccion.cantidad < 0, LedgerTransaccion.fecha_creacion >= ayer).group_by(LedgerTransaccion.usuario_id).order_by(func.sum(LedgerTransaccion.cantidad).asc()).limit(1)
    res_lose = (await db.execute(stmt_lose)).first()
    biggest_loser = None
    if res_lose:
        u = await db.scalar(select(Usuario).where(Usuario.id == res_lose[0]))
        if u:
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
