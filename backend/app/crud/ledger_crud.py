from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from typing import Optional
from app.models.usuario import Usuario, LedgerTransaccion
from app.models.grupo import MiembroGrupo

# ==============================================================================
# Motor Transaccional y Ledger Inmutable (QuestFest Financial Engine)
# ==============================================================================
# Este módulo es el núcleo financiero de la aplicación.
# Cada operación que involucra QuestCoins (abono de premios, cobro de apuestas,
# retención de duelos, recompensas de misiones o multas arbitrales) DEBE canalizarse
# a través de 'move_tokens'.
#
# Principios ACID Garantizados:
# 1. Atomicidad: El balance del usuario (o del miembro del grupo) se actualiza y el asiento
#    contable en 'ledger_transacciones' se registra dentro de la misma transacción de BD.
# 2. Consistencia: La base de datos (PostgreSQL) valida las restricciones 'saldo_actual >= 0'
#    y 'saldo_grupo >= 0'. Si un usuario no tiene fondos suficientes, el motor de la BD
#    aborta la operación con un IntegrityError.
# 3. Aislamiento: El uso de 'UPDATE ... RETURNING' previene lecturas sucias (dirty reads)
#    y condiciones de carrera bajo concurrencia elevada.
# ==============================================================================

async def move_tokens(
    db: AsyncSession,
    user_id: int,
    amount: int,
    concept: str,
    auto_commit: bool = True,
    group_id: Optional[int] = None
) -> None:
    """
    Transfiere o deduce QuestCoins de un usuario de forma atómica y segura.
    
    Parámetros:
    - db: Sesión asíncrona activa de SQLAlchemy.
    - user_id: ID del jugador titular de la cuenta.
    - amount: Cantidad de tokens (+X para abonos, -X para cobros/débitos).
    - concept: Motivo legible en español para la auditoría (ej. 'Premio Apuesta: Quién ganará el futbolín').
    - auto_commit: Si es True, confirma la transacción inmediatamente. Si es False, permite
      encadenar múltiples operaciones en la misma transacción (ej. crear duelo + retención preventiva).
    - group_id: Si se proporciona, altera el saldo local del grupo ('MiembroGrupo.saldo_grupo').
      Si es None, actúa sobre la cuenta global ('Usuario.saldo_actual').
    """
    # Si el importe es 0, no hay movimiento económico ni necesidad de ensuciar el Ledger
    if amount == 0:
        return
        
    try:
        nuevo_saldo = None

        if group_id is not None:
            # ------------------------------------------------------------------
            # Caso 1: Economía Confinada a un Grupo (Multi-Tenancy)
            # ------------------------------------------------------------------
            # Utilizamos una cláusula 'RETURNING saldo_grupo' directa en el UPDATE.
            # Esto nos devuelve el saldo final exacto calculado por la base de datos
            # sin necesidad de hacer un 'SELECT' previo propenso a condiciones de carrera.
            stmt = (
                update(MiembroGrupo)
                .where(MiembroGrupo.usuario_id == user_id, MiembroGrupo.grupo_id == group_id)
                .values(saldo_grupo=MiembroGrupo.saldo_grupo + amount)
                .returning(MiembroGrupo.saldo_grupo)
                .execution_options(synchronize_session=False)
            )
            result = await db.execute(stmt)
            nuevo_saldo = result.scalar()

            if nuevo_saldo is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="El usuario no pertenece a este grupo para la transacción económica."
                )
        else:
            # ------------------------------------------------------------------
            # Caso 2: Cuenta Global de Plataforma (Fallback)
            # ------------------------------------------------------------------
            stmt = (
                update(Usuario)
                .where(Usuario.id == user_id)
                .values(saldo_actual=Usuario.saldo_actual + amount)
                .returning(Usuario.saldo_actual)
                .execution_options(synchronize_session=False)
            )
            result = await db.execute(stmt)
            nuevo_saldo = result.scalar()
            
            if nuevo_saldo is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuario no encontrado para la transacción económica."
                )

        # Asiento contable en el Ledger con la instantánea del saldo resultante
        transaccion = LedgerTransaccion(
            usuario_id=user_id,
            grupo_id=group_id,
            cantidad=amount,
            concepto=concept,
            saldo_resultante=nuevo_saldo
        )
        db.add(transaccion)

        # Si 'auto_commit' está activo, confirmamos de forma atómica
        if auto_commit:
            await db.commit()

    except IntegrityError:
        # PostgreSQL disparó la violación de CheckConstraint (saldo_actual < 0 o saldo_grupo < 0).
        # Hacemos rollback defensivo para liberar bloqueos y devolver un error semántico limpio.
        if auto_commit:
            await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transacción denegada. Saldo insuficiente para realizar la operación."
        )
    except Exception as e:
        # Captura de contingencia ante fallos de conexión o caídas inesperadas
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error crítico en el motor económico: {str(e)}"
        )
