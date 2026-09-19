from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from fastapi import HTTPException

from app.models.juegos import Duelo
from app.models.misiones import PruebaMision
from app.schemas.duelos_schemas import DuelStatusEnum
from app.crud.ledger_crud import move_tokens

from typing import Optional

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
