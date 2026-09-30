"""
================================================================================
SERVICIO DE ESTADÍSTICAS Y MÉTRICAS DE JUGADOR: QuestFest
================================================================================
Este servicio concentra el cálculo analítico y desglose de desempeño de los usuarios:
1. Agregación de métricas de juego: misiones completadas, duelos ganados/perdidos,
   apuestas acertadas/falladas y capital circulante/inmovilizado en juego.
2. Contabilidad de flujo financiero: tokens ganados, tokens perdidos e impacto en Ledger.
3. Desglose pormenorizado de partidas por categoría para inspección en el perfil.
================================================================================
"""

from typing import List, Optional

from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.juegos import Apuesta, Duelo, TicketApuesta
from app.models.misiones import Mision, PruebaMision
from app.models.usuario import LedgerTransaccion, Usuario
from app.schemas.user_schemas import UserStatsResponse


async def get_user_stats(
    db: AsyncSession,
    current_user: Usuario,
    group_id: Optional[int] = None,
) -> UserStatsResponse:
    """
    Agrega el panel analítico y perfil estadístico del jugador.

    Métricas Computadas:
    1. 'missionsCompleted': Retos completados y aprobados por el tribunal.
    2. 'duelsWon' / 'duelsLost': Enfrentamientos PvP concluidos.
    3. 'betsWon' / 'betsLost': Apuestas cerradas con resultado conocido.
    4. 'betsActive' / 'tokensActive': Pronósticos y duelos en curso con capital comprometido.
    5. 'tokensWon' / 'tokensLost': Total acumulado de QuestCoins generados y cedidos.
    """
    # 1. Conteo de misiones completadas y aprobadas (con soporte de grupo)
    missions_stmt = (
        select(func.count())
        .select_from(PruebaMision)
        .where(
            PruebaMision.usuario_id == current_user.id,
            PruebaMision.estado == "approved",
        )
    )
    if group_id is not None:
        missions_stmt = missions_stmt.join(Mision, Mision.id == PruebaMision.mision_id).where(
            Mision.grupo_id == group_id
        )
    missions_count = await db.scalar(missions_stmt)

    # 2. Conteo de duelos completados con victoria para el usuario
    duels_count = await db.scalar(
        select(func.count())
        .select_from(Duelo)
        .where(
            Duelo.ganador_id == current_user.id,
            Duelo.estado == "completed",
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
                Apuesta.estado == "cerrada",
                TicketApuesta.opcion_id == Apuesta.opcion_ganadora_id,
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
                Apuesta.estado == "abierta",
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
                Apuesta.estado == "cerrada",
                TicketApuesta.opcion_id != Apuesta.opcion_ganadora_id,
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
                Apuesta.estado == "abierta",
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
                    Duelo.estado.in_(["pending", "accepted", "validation_winner"]),
                ),
                and_(
                    Duelo.retado_id == current_user.id,
                    Duelo.estado.in_(["accepted", "validation_winner"]),
                ),
            )
        )
    )

    # 8. Tokens perdidos (tokensLost)
    lost_bets_sum = (
        await db.scalar(
            select(func.sum(TicketApuesta.cantidad))
            .select_from(TicketApuesta)
            .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
            .where(
                and_(
                    TicketApuesta.usuario_id == current_user.id,
                    Apuesta.estado == "cerrada",
                    TicketApuesta.opcion_id != Apuesta.opcion_ganadora_id,
                )
            )
        )
        or 0
    )

    lost_duels_sum = (
        await db.scalar(
            select(func.sum(Duelo.tokens_en_juego))
            .select_from(Duelo)
            .where(
                and_(
                    or_(Duelo.retador_id == current_user.id, Duelo.retado_id == current_user.id),
                    Duelo.estado == "completed",
                    Duelo.ganador_id.isnot(None),
                    Duelo.ganador_id != current_user.id,
                )
            )
        )
        or 0
    )

    lost_orphaned_sum = (
        await db.scalar(
            select(func.sum(LedgerTransaccion.cantidad))
            .select_from(LedgerTransaccion)
            .where(
                and_(
                    LedgerTransaccion.usuario_id == current_user.id,
                    LedgerTransaccion.cantidad < 0,
                    not_(LedgerTransaccion.concepto.ilike("%Apuesta%")),
                    not_(LedgerTransaccion.concepto.ilike("%Retención%")),
                    not_(LedgerTransaccion.concepto.ilike("%Premio doble%")),
                )
            )
        )
        or 0
    )

    tokens_lost_sum = lost_bets_sum + lost_duels_sum + abs(lost_orphaned_sum)

    # 9. Tokens ganados (tokensWon)
    won_bets_query = (
        select(TicketApuesta)
        .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
        .options(joinedload(TicketApuesta.apuesta))
        .where(
            and_(
                TicketApuesta.usuario_id == current_user.id,
                Apuesta.estado == "cerrada",
                TicketApuesta.opcion_id == Apuesta.opcion_ganadora_id,
            )
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

    won_duels_sum = (
        await db.scalar(
            select(func.sum(Duelo.tokens_en_juego * 2))
            .select_from(Duelo)
            .where(
                and_(
                    Duelo.ganador_id == current_user.id,
                    Duelo.estado == "completed",
                )
            )
        )
        or 0
    )

    won_orphaned_sum = (
        await db.scalar(
            select(func.sum(LedgerTransaccion.cantidad))
            .select_from(LedgerTransaccion)
            .where(
                and_(
                    LedgerTransaccion.usuario_id == current_user.id,
                    LedgerTransaccion.cantidad > 0,
                    not_(LedgerTransaccion.concepto.ilike("%Apuesta%")),
                    not_(LedgerTransaccion.concepto.ilike("%Retención%")),
                    not_(LedgerTransaccion.concepto.ilike("%Premio doble%")),
                )
            )
        )
        or 0
    )

    tokens_won_sum = int(won_bets_sum) + won_duels_sum + won_orphaned_sum

    # 10. Duelos perdidos y activos
    duels_lost_count = await db.scalar(
        select(func.count())
        .select_from(Duelo)
        .where(
            and_(
                or_(Duelo.retador_id == current_user.id, Duelo.retado_id == current_user.id),
                Duelo.estado == "completed",
                Duelo.ganador_id.isnot(None),
                Duelo.ganador_id != current_user.id,
            )
        )
    )

    duels_active_count = await db.scalar(
        select(func.count())
        .select_from(Duelo)
        .where(
            and_(
                or_(Duelo.retador_id == current_user.id, Duelo.retado_id == current_user.id),
                Duelo.estado == "accepted",
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
        duelsActive=duels_active_count or 0,
    )


async def get_stat_details(
    db: AsyncSession,
    current_user: Usuario,
    stat_type: str,
    group_id: Optional[int] = None,
) -> List[dict]:
    """
    Recupera el historial pormenorizado de operaciones para un tipo estadístico específico.
    Soporta apuestas activas/ganadas/perdidas, duelos y asientos directos del Ledger.
    """
    details = []

    # 1. Desglose de Apuestas
    if stat_type in [
        "betsActive",
        "betsWon",
        "betsLost",
        "tokensActive",
        "tokensWon",
        "tokensLost",
    ]:
        users_result = await db.execute(select(Usuario))
        users_map = {u.id: u.username for u in users_result.scalars().all()}

        query = (
            select(TicketApuesta)
            .options(joinedload(TicketApuesta.apuesta))
            .where(TicketApuesta.usuario_id == current_user.id)
        )
        if group_id is not None:
            query = query.join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id).where(
                Apuesta.grupo_id == group_id
            )

        result = await db.execute(query)
        tickets = result.scalars().all()

        for ticket in tickets:
            bet = ticket.apuesta

            if stat_type in ("betsActive", "tokensActive"):
                if bet.estado != "abierta":
                    continue
            elif stat_type in ("betsWon", "tokensWon"):
                if bet.estado != "cerrada" or ticket.opcion_id != bet.opcion_ganadora_id:
                    continue
            elif stat_type in ("betsLost", "tokensLost"):
                if bet.estado != "cerrada" or ticket.opcion_id == bet.opcion_ganadora_id:
                    continue

            options_list = []
            if bet.opciones:
                for opt_id, opt_data in bet.opciones.items():
                    options_list.append(
                        {
                            "id": opt_id,
                            "text": opt_data["text"],
                            "multiplier": opt_data["multiplier"],
                        }
                    )

            user_won = None
            profit = 0
            winning_option = None
            multiplier = None

            if bet.estado == "cerrada" and bet.opcion_ganadora_id and bet.opciones:
                winning_option = bet.opciones.get(bet.opcion_ganadora_id, {}).get("text")
                multiplier = float(
                    bet.opciones.get(bet.opcion_ganadora_id, {}).get("multiplier", 0)
                )
                user_won = ticket.opcion_id == bet.opcion_ganadora_id
                if user_won:
                    profit = ticket.cantidad * float(
                        bet.opciones.get(ticket.opcion_id, {}).get("multiplier", 0)
                    )

            votos = bet.votos_sugerencia or {}
            upvotes = sum(1 for v in votos.values() if v == "up")
            downvotes = sum(1 for v in votos.values() if v == "down")
            user_vote = votos.get(str(current_user.id))

            details.append(
                {
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
                    "createdAt": (
                        bet.fecha_creacion.isoformat() + "Z" if bet.fecha_creacion else None
                    ),
                    "approvedAt": (
                        bet.fecha_aprobacion.isoformat() + "Z" if bet.fecha_aprobacion else None
                    ),
                    "item_type": "bet",
                }
            )

    # 2. Desglose de Duelos PvP
    if stat_type in [
        "duelsActive",
        "duelsWon",
        "duelsLost",
        "tokensActive",
        "tokensWon",
        "tokensLost",
    ]:
        duel_query = (
            select(Duelo)
            .options(joinedload(Duelo.retador), joinedload(Duelo.retado))
            .where(or_(Duelo.retador_id == current_user.id, Duelo.retado_id == current_user.id))
        )
        duel_result = await db.execute(duel_query)
        duels = duel_result.scalars().all()

        for d in duels:
            if stat_type in ("duelsActive", "tokensActive"):
                if d.estado in ("completed", "penalized_challenger", "penalized_challenged"):
                    continue
            elif stat_type in ("duelsWon", "tokensWon"):
                if d.estado != "completed" or d.ganador_id != current_user.id:
                    continue
            elif stat_type in ("duelsLost", "tokensLost"):
                if (
                    d.estado != "completed"
                    or d.ganador_id is None
                    or d.ganador_id == current_user.id
                ):
                    continue

            winner = None
            if d.ganador_id:
                winner = d.retador.username if d.ganador_id == d.retador_id else d.retado.username

            details.append(
                {
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
                    "fecha_creacion": (
                        d.fecha_creacion.isoformat() + "Z" if d.fecha_creacion else None
                    ),
                    "reported_resolution": d.reported_resolution,
                    "item_type": "duel",
                }
            )

    # 3. Desglose de Asientos Directos del Ledger
    if stat_type in ["tokensWon", "tokensLost"]:
        tx_query = select(LedgerTransaccion).where(
            and_(
                LedgerTransaccion.usuario_id == current_user.id,
                not_(LedgerTransaccion.concepto.ilike("%Apuesta%")),
                not_(LedgerTransaccion.concepto.ilike("%Retención%")),
                not_(LedgerTransaccion.concepto.ilike("%Premio doble%")),
            )
        )
        if stat_type == "tokensWon":
            tx_query = tx_query.where(LedgerTransaccion.cantidad > 0)
        else:
            tx_query = tx_query.where(LedgerTransaccion.cantidad < 0)

        tx_result = await db.execute(tx_query)
        transactions = tx_result.scalars().all()

        for tx in transactions:
            details.append(
                {
                    "id": str(tx.id),
                    "type": "income" if tx.cantidad > 0 else "expense",
                    "amount": abs(tx.cantidad),
                    "concept": tx.concepto,
                    "date": (
                        tx.fecha_creacion.isoformat() + "Z"
                        if tx.fecha_creacion.tzinfo is None
                        and not tx.fecha_creacion.isoformat().endswith("Z")
                        else tx.fecha_creacion.isoformat()
                    ),
                    "balance": tx.saldo_resultante,
                    "item_type": "transaction",
                }
            )

    if stat_type in ["tokensActive", "tokensWon", "tokensLost"]:
        details.sort(
            key=lambda x: x.get("createdAt") or x.get("fecha_creacion") or x.get("date") or "",
            reverse=True,
        )

    return details
