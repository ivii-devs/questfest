"""
==============================================================================
OPERACIONES CRUD PARA DUELOS Y DESAFÍOS 1VS1: QuestFest
==============================================================================
Implementa la lógica de duelos directos con depósito en garantía (Escrow):
1. 'create_duel': El retador propone un juego y congela preventivamente su apuesta.
2. 'update_duel_status': El retado acepta (congelando sus tokens) o rechaza (devolviendo el depósito).
3. 'report_duel_outcome': Uno de los contrincantes declara el vencedor y el duelo pasa a validación arbitral.
4. Desacoplado del protocolo HTTP mediante excepciones de dominio limpias.
==============================================================================
"""

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload

from app.core.exceptions import (
    EntityNotFoundError,
    InsufficientBalanceError,
    InvalidStateTransitionError,
    PermissionDeniedError,
)
from app.crud.ledger_crud import move_tokens
from app.models.grupo import MiembroGrupo
from app.models.juegos import Duelo
from app.models.notificaciones import NotificacionAdmin
from app.models.usuario import Usuario
from app.schemas.duelos_schemas import DuelCreateRequest, DuelResolutionEnum, DuelStatusEnum


async def create_duel(db: AsyncSession, challenger_id: int, request: DuelCreateRequest) -> Duelo:
    """
    Crea un nuevo desafío 1vs1 y retiene preventivamente los tokens del retador.
    """
    # 1. Validar que el usuario retado existe
    result = await db.execute(
        select(Usuario).filter(Usuario.username == request.challenged_username)
    )
    challenged_user = result.scalars().first()

    if not challenged_user:
        raise EntityNotFoundError("El jugador retado no existe")
    if challenged_user.id == challenger_id:
        raise InvalidStateTransitionError("No puedes retarte a ti mismo")

    # 2. Validar que el retado pertenece a la misma comunidad
    if request.group_id is not None:
        stmt_member = select(MiembroGrupo).filter(
            MiembroGrupo.usuario_id == challenged_user.id,
            MiembroGrupo.grupo_id == request.group_id,
        )
        res_member = await db.execute(stmt_member)
        if not res_member.scalars().first():
            raise InvalidStateTransitionError(
                f"@{challenged_user.username} no forma parte de este grupo y no puede ser retado aquí."
            )

    try:
        # Retención de tokens en el balance del grupo especificado (modo Escrow preventivo)
        await move_tokens(
            db=db,
            user_id=challenger_id,
            amount=-request.wager,
            concept=f"Retención propuesta duelo: {request.game}",
            group_id=request.group_id,
            auto_commit=False,
        )
    except Exception:
        await db.rollback()
        raise InsufficientBalanceError(
            "No tienes fondos suficientes en este grupo para proponer el duelo."
        )

    duelo = Duelo(
        retador_id=challenger_id,
        retado_id=challenged_user.id,
        juego=request.game,
        tokens_en_juego=request.wager,
        estado=DuelStatusEnum.pending.value,
        grupo_id=request.group_id,
    )
    db.add(duelo)
    await db.commit()
    await db.refresh(duelo)

    # Notificación interactiva al jugador desafiado
    res_challenger = await db.execute(select(Usuario).filter(Usuario.id == challenger_id))
    challenger_user = res_challenger.scalars().first()
    if challenger_user:
        notif = NotificacionAdmin(
            titulo="⚔️ ¡Has sido retado!",
            mensaje=f"@{challenger_user.username} te ha retado a '{request.game}' por {request.wager} tokens. Ve a la pestaña de Duelos para aceptarlo o rechazarlo.",
            destinatario_tipo="specific",
            destinatario_id=challenged_user.id,
            estado="sent",
        )
        db.add(notif)
        await db.commit()

    return duelo


async def get_active_duels(db: AsyncSession, group_id: Optional[int] = None) -> list[Duelo]:
    """
    Obtiene la lista de duelos asociados a un grupo específico o globales,
    precargando (Eager Loading con joinedload) la información del retador y retado.
    """
    stmt = select(Duelo).options(joinedload(Duelo.retador), joinedload(Duelo.retado))
    if group_id is not None:
        stmt = stmt.filter(Duelo.grupo_id == group_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_duel_status(db: AsyncSession, duel_id: int, user_id: int, action: str) -> Duelo:
    """
    Gestiona la aceptación o rechazo de un desafío por parte del jugador retado.
    """
    stmt = select(Duelo).filter(Duelo.id == duel_id)
    result = await db.execute(stmt)
    duel = result.scalars().first()

    if not duel:
        raise EntityNotFoundError("Duelo no encontrado")

    if duel.retado_id != user_id:
        raise PermissionDeniedError("Solo el jugador retado puede aceptar o rechazar el duelo")

    if duel.estado != DuelStatusEnum.pending.value:
        raise InvalidStateTransitionError("El duelo ya no está pendiente")

    if action == "accept":
        try:
            await move_tokens(
                db=db,
                user_id=duel.retado_id,
                amount=-duel.tokens_en_juego,
                concept=f"Retención Duelo: {duel.juego}",
                group_id=duel.grupo_id,
                auto_commit=False,
            )
        except Exception:
            await db.rollback()
            raise InsufficientBalanceError(
                "Transacción abortada. No tienes fondos suficientes en este grupo."
            )

        duel.estado = DuelStatusEnum.accepted.value
        await db.commit()

    elif action == "reject":
        await move_tokens(
            db=db,
            user_id=duel.retador_id,
            amount=duel.tokens_en_juego,
            concept=f"Devolución rechazo duelo: {duel.juego}",
            group_id=duel.grupo_id,
            auto_commit=False,
        )
        duel.estado = DuelStatusEnum.validation_rejected.value
        await db.commit()
    else:
        raise InvalidStateTransitionError("Acción no válida")

    return duel


async def report_duel_outcome(
    db: AsyncSession, duel_id: int, user_id: int, resolution: DuelResolutionEnum
) -> Duelo:
    """
    Registra la proclamación del resultado por parte de uno de los participantes.
    """
    stmt = select(Duelo).filter(Duelo.id == duel_id)
    result = await db.execute(stmt)
    duel = result.scalars().first()

    if not duel:
        raise EntityNotFoundError("Duelo no encontrado")

    if user_id not in (duel.retador_id, duel.retado_id):
        raise PermissionDeniedError("No participas en este duelo")

    if duel.estado != DuelStatusEnum.accepted.value:
        raise InvalidStateTransitionError("El duelo no está en curso")

    reporter_str = "challenger" if user_id == duel.retador_id else "challenged"
    duel.reported_resolution = f"{reporter_str}:{resolution.value}"
    duel.estado = DuelStatusEnum.validation_winner.value
    await db.commit()
    return duel
