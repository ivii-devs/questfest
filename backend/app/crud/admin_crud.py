from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from fastapi import HTTPException

from app.models.juegos import Duelo
from app.models.misiones import PruebaMision
from app.schemas.duelos_schemas import DuelStatusEnum
from app.crud.ledger_crud import move_tokens

from typing import Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, and_
from sqlalchemy.orm import selectinload

from app.models.usuario import Usuario, LedgerTransaccion
from app.models.grupo import MiembroGrupo
from app.models.misiones import Mision
from app.models.juegos import Apuesta, TicketApuesta
from app.schemas.admin_schemas import DailySummaryStatsResponse, StatUser, DuelStat

# ==============================================================================
# Operaciones CRUD para el Tribunal y Moderación Administrativa (QuestFest)
# ==============================================================================
# Este módulo agrupa las herramientas de arbitraje del Tribunal:
# 1. 'get_pending_duels': Lista de enfrentamientos en conflicto o pendientes de fallo.
# 2. 'resolve_duel': Dictamen final sobre el ganador del duelo o anulación por empate/fraude,
#    transfiriendo el bote (2x la apuesta) o devolviendo las retenciones en el grupo correspondiente.
# 3. 'get_pending_mission_proofs': Bandeja de entrada de evidencias presentadas por los jugadores.
# 4. 'resolve_mission_proof': Aprobación o descarte de pruebas de misión con abono de recompensa.
# 5. 'adjust_user_balance': Ajuste manual discrecional de saldo por multas o bonificaciones.
# ==============================================================================

async def get_pending_duels(db: AsyncSession, group_id: Optional[int] = None):
    """
    Obtiene los duelos que requieren sentencia arbitral (validación de ganador o rechazo con disputa),
    precargando las fichas completas del retador y retado para facilitar la decisión del juez.
    """
    stmt = select(Duelo).filter(
        Duelo.estado.in_([DuelStatusEnum.validation_winner.value, DuelStatusEnum.validation_rejected.value])
    ).options(joinedload(Duelo.retador), joinedload(Duelo.retado))
    
    if group_id is not None:
        stmt = stmt.filter(Duelo.grupo_id == group_id)
        
    result = await db.execute(stmt)
    return result.scalars().all()

async def resolve_duel(db: AsyncSession, duel_id: int, winner_id: int = None, is_draw: bool = False):
    """
    Dicta sentencia sobre un duelo y liquida el bote de tokens en el grupo correspondiente.
    
    Mecánica Económica del Bote:
    - Cada participante inmovilizó 'duel.tokens_en_juego' al crearse y aceptarse el reto.
    - Bote total = 2 * duel.tokens_en_juego.
    - Caso Empate/Nulo: Se devuelven 'duel.tokens_en_juego' a ambas cuentas locales del grupo.
    - Caso Victoria: El ganador recibe el bote completo (2 * tokens) en su balance del grupo.
    """
    stmt = select(Duelo).filter(Duelo.id == duel_id)
    result = await db.execute(stmt)
    duel = result.scalars().first()
    
    if not duel:
        raise HTTPException(status_code=404, detail="Duelo no encontrado")
        
    if duel.estado not in [DuelStatusEnum.validation_winner.value, DuelStatusEnum.validation_rejected.value, DuelStatusEnum.accepted.value]:
        raise HTTPException(status_code=400, detail="El duelo no está en estado de evaluación o aceptado")
        
    bote = duel.tokens_en_juego * 2
    
    try:
        if is_draw or not winner_id:
            # Empate o Nulo: Devolver el depósito original retenido a ambos contrincantes en su grupo
            await move_tokens(
                db=db,
                user_id=duel.retador_id,
                amount=duel.tokens_en_juego,
                concept=f"Devolución por Duelo Nulo/Empate: {duel.juego}",
                auto_commit=False,
                group_id=duel.grupo_id
            )
            await move_tokens(
                db=db,
                user_id=duel.retado_id,
                amount=duel.tokens_en_juego,
                concept=f"Devolución por Duelo Nulo/Empate: {duel.juego}",
                auto_commit=False,
                group_id=duel.grupo_id
            )
        else:
            # Victoria: Acreditamos el bote completo al jugador declarado ganador
            if winner_id not in (duel.retador_id, duel.retado_id):
                raise HTTPException(status_code=400, detail="El ganador especificado no forma parte del duelo")
            
            await move_tokens(
                db=db,
                user_id=winner_id,
                amount=bote,
                concept=f"Victoria en Duelo: {duel.juego}",
                auto_commit=False,
                group_id=duel.grupo_id
            )
            duel.ganador_id = winner_id
            
        duel.estado = DuelStatusEnum.completed.value
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en la transacción del duelo: {str(e)}")
        
    return duel

async def get_pending_mission_proofs(db: AsyncSession, group_id: Optional[int] = None):
    """
    Recupera la lista de pruebas de misión pendientes de validación por parte del tribunal.
    """
    stmt = select(PruebaMision).filter(
        PruebaMision.estado == "pending"
    ).options(joinedload(PruebaMision.usuario), joinedload(PruebaMision.mision))
    
    if group_id is not None:
        stmt = stmt.join(PruebaMision.mision).filter(Mision.grupo_id == group_id)
        
    result = await db.execute(stmt)
    return result.scalars().all()

async def resolve_mission_proof(db: AsyncSession, proof_id: int, approved: bool):
    """
    Dictamina la validez de una prueba de misión presentada.
    Si se aprueba, abona la recompensa estipulada en el saldo local del grupo al que pertenece la misión.
    """
    stmt = select(PruebaMision).filter(PruebaMision.id == proof_id).options(joinedload(PruebaMision.mision))
    result = await db.execute(stmt)
    prueba = result.scalars().first()
    
    if not prueba:
        raise HTTPException(status_code=404, detail="Prueba de misión no encontrada")
        
    if prueba.estado != "pending":
        raise HTTPException(status_code=400, detail="Esta prueba ya ha sido evaluada previamente")
        
    try:
        if approved:
            prueba.estado = "approved"
            recompensa = prueba.mision.recompensa
            # Abono de tokens canalizado con el group_id de la misión correspondiente
            await move_tokens(
                db=db, 
                user_id=prueba.usuario_id, 
                amount=recompensa, 
                concept=f"Misión completada: {prueba.mision.titulo}", 
                auto_commit=False,
                group_id=prueba.mision.grupo_id
            )
        else:
            prueba.estado = "rejected"
            
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error validando misión: {str(e)}")
        
    return prueba

async def adjust_user_balance(db: AsyncSession, user_id: int, amount: int, concept: str, group_id: Optional[int] = None):
    """
    Realiza un ajuste administrativo discrecional sobre el saldo del usuario.
    La verificación de saldo no negativo y el registro en el Ledger se delegan de forma segura en 'move_tokens'.
    """
    await move_tokens(db=db, user_id=user_id, amount=amount, concept=concept, group_id=group_id)
    return True

async def calculate_summary_stats(db: AsyncSession, group_id: Optional[int] = None) -> DailySummaryStatsResponse:
    """
    Calcula las estadísticas para el boletín informativo diario matutino.
    
    ¿Por qué soportamos 'group_id' opcional?
    En la arquitectura multi-grupo de QuestFest, cada comunidad posee su propio balance contable,
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
