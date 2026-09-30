"""
================================================================================
SERVICIO DEL TRIBUNAL DE DUELOS: QuestFest
================================================================================
Este servicio centraliza el arbitraje administrativo de enfrentamientos PvP:
1. Inspección de duelos activos y disputados con carga de relaciones (`selectinload`).
2. Sentencia inapelable del Tribunal sobre duelos en conflicto (victoria, empate limpio,
   cancelación sin coste o sanción punitiva con multa disciplinaria).
3. Transacciones atómicas en el Ledger (`move_tokens`) garantizando que los fondos
   retenidos en Escrow se liberen o reembolsen con total integridad contable.
================================================================================
"""

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import EntityNotFoundError, InvalidStateTransitionError
from app.crud.ledger_crud import move_tokens
from app.dependencies import verify_group_admin
from app.models.grupo import MiembroGrupo
from app.models.juegos import Duelo
from app.models.notificaciones import NotificacionAdmin
from app.models.usuario import Usuario
from app.schemas.admin_schemas import AdminResolveDuelRequest


async def get_admin_duels(
    db: AsyncSession,
    current_user: Usuario,
    group_id: Optional[int] = None,
) -> List[dict]:
    """
    Obtiene los duelos para el panel del Tribunal Administrativo.

    Carga de forma eager los perfiles de retador y retado (`selectinload`)
    para eliminar consultas N+1 y asegurar aislamiento territorial por grupo.
    """
    stmt = select(Duelo).options(selectinload(Duelo.retador), selectinload(Duelo.retado))
    if group_id is not None:
        await verify_group_admin(db, current_user, group_id)
        stmt = stmt.where(Duelo.grupo_id == group_id)
    elif current_user.rol != "admin":
        admin_groups_subq = select(MiembroGrupo.grupo_id).where(
            MiembroGrupo.usuario_id == current_user.id,
            MiembroGrupo.rol == "admin",
        )
        stmt = stmt.where(Duelo.grupo_id.in_(admin_groups_subq))
    stmt = stmt.order_by(Duelo.id.desc())
    result = await db.execute(stmt)
    duels = result.scalars().all()

    return [
        {
            "id": d.id,
            "challenger": d.retador.username,
            "challenged": d.retado.username,
            "game": d.juego,
            "wager": d.tokens_en_juego,
            "status": d.estado,
            "winner": (
                d.retador.username
                if d.ganador_id == d.retador_id
                else (d.retado.username if d.ganador_id == d.retado_id else None)
            ),
            "challenger_avatar": d.retador.avatar_url,
            "challenged_avatar": d.retado.avatar_url,
            "fecha_creacion": d.fecha_creacion.isoformat() + "Z" if d.fecha_creacion else None,
            "reported_resolution": d.reported_resolution,
        }
        for d in duels
    ]


async def resolve_duel_admin(
    db: AsyncSession,
    duel_id: int,
    resolve_data: AdminResolveDuelRequest,
    current_user: Usuario,
) -> dict:
    """
    Dicta sentencia inapelable sobre un duelo en conflicto o pendiente de arbitraje.

    Garantías Económicas y Reglas de Negocio:
    1. Soberanía Territorial: Certifica la jurisdicción del administrador sobre la comunidad.
    2. Victoria ("challenger" o "challenged"):
       El ganador recibe la bolsa acumulada (2 * tokens_en_juego) en su saldo de grupo.
    3. Empate sin sanción ("draw" con penalize="none"):
       Si los tokens estaban retenidos en Escrow (estados 'accepted' o 'validation_winner'),
       se reembolsa íntegramente la apuesta a ambos participantes.
       Si fue rechazado antes de la aceptación formal, se cancela sin movimientos de fondos.
    4. Empate disciplinario ("draw" con penalize="challenger" o "challenged"):
       Se devuelven las apuestas retenidas y se aplica una multa punitiva (retirada de tokens)
       al contendiente culpable, emitiendo las cédulas de notificación oficiales del Tribunal.
    """
    duel = await db.scalar(
        select(Duelo)
        .options(selectinload(Duelo.retador), selectinload(Duelo.retado))
        .where(Duelo.id == duel_id)
    )
    if not duel:
        raise EntityNotFoundError("Duelo no encontrado")

    await verify_group_admin(db, current_user, duel.grupo_id)

    if duel.estado in ("completed", "penalized_challenger"):
        raise InvalidStateTransitionError("El duelo ya está resuelto")

    # Determinamos si los tokens fueron efectivamente descontados en la fase de aceptación
    tokens_bloqueados = duel.estado in ("accepted", "validation_winner")

    if resolve_data.resolution in ("challenger", "challenged"):
        winner = duel.retador if resolve_data.resolution == "challenger" else duel.retado
        loser = duel.retado if resolve_data.resolution == "challenger" else duel.retador
        ganancia = 2 * duel.tokens_en_juego
        duel.ganador_id = winner.id
        duel.estado = "completed"

        # Abonamos el bote acumulado al vencedor dentro del saldo de grupo correspondiente
        await move_tokens(
            db=db,
            user_id=winner.id,
            amount=ganancia,
            concept=f"Premio doble por duelo: {duel.juego}",
            group_id=duel.grupo_id,
            auto_commit=False,
        )

        msg_base = (
            f"El Tribunal ha dictado sentencia. @{winner.username} ha vencido a @{loser.username} "
            f"en el duelo '{duel.juego}' y se lleva un premio de {ganancia} tokens."
        )
        msg_retador = msg_base
        msg_retado = msg_base

    elif resolve_data.resolution == "draw":
        if resolve_data.penalize == "challenger":
            duel.estado = "penalized_challenger"
        elif resolve_data.penalize == "challenged":
            duel.estado = "completed"
            duel.reported_resolution = "penalized_challenged"
        else:
            duel.estado = "completed"

        if resolve_data.penalize == "none":
            # Sin sanción: reembolso limpio o cancelación
            if not tokens_bloqueados:
                msg_retador = (
                    "La solicitud de rechazo ha sido aceptada. El duelo se ha cancelado "
                    "sin movimientos de tokens."
                )
                msg_retado = (
                    "La solicitud de rechazo ha sido aceptada. El duelo se ha cancelado "
                    "sin movimientos de tokens."
                )
            else:
                await move_tokens(
                    db,
                    duel.retador.id,
                    duel.tokens_en_juego,
                    f"Devolución empate duelo: {duel.juego}",
                    group_id=duel.grupo_id,
                    auto_commit=False,
                )
                await move_tokens(
                    db,
                    duel.retado.id,
                    duel.tokens_en_juego,
                    f"Devolución empate duelo: {duel.juego}",
                    group_id=duel.grupo_id,
                    auto_commit=False,
                )
                msg_retador = (
                    f"El Tribunal ha dictado un Empate en el duelo '{duel.juego}' contra "
                    f"{duel.retado.username}. Los {duel.tokens_en_juego} tokens han sido devueltos a vuestras cuentas."
                )
                msg_retado = (
                    f"El Tribunal ha dictado un Empate en el duelo '{duel.juego}' contra "
                    f"{duel.retador.username}. Los {duel.tokens_en_juego} tokens han sido devueltos a vuestras cuentas."
                )
        else:
            # Sanción punitiva con multa disciplinaria
            if not resolve_data.motivo_multa:
                raise InvalidStateTransitionError("Debes indicar un motivo de multa")
            if resolve_data.penalize_amount <= 0:
                raise InvalidStateTransitionError("La multa debe ser mayor que 0")

            if tokens_bloqueados:
                await move_tokens(
                    db,
                    duel.retador.id,
                    duel.tokens_en_juego,
                    f"Devolución duelo cancelado: {duel.juego}",
                    group_id=duel.grupo_id,
                    auto_commit=False,
                )
                await move_tokens(
                    db,
                    duel.retado.id,
                    duel.tokens_en_juego,
                    f"Devolución duelo cancelado: {duel.juego}",
                    group_id=duel.grupo_id,
                    auto_commit=False,
                )

            fined_user = duel.retador if resolve_data.penalize == "challenger" else duel.retado
            # Descuento disciplinario (importe negativo)
            await move_tokens(
                db,
                fined_user.id,
                -resolve_data.penalize_amount,
                f"Multa Tribunal por duelo: {duel.juego}",
                group_id=duel.grupo_id,
                auto_commit=False,
            )

            multa_msg = (
                f"El Tribunal te ha multado con {resolve_data.penalize_amount} tokens por: "
                f"{resolve_data.motivo_multa}"
            )
            msg_innocent = (
                f"El duelo '{duel.juego}' ha sido cancelado porque tu oponente ha sido multado con "
                f"{resolve_data.penalize_amount} tokens por: {resolve_data.motivo_multa}"
            )

            if resolve_data.penalize == "challenger":
                msg_retador = multa_msg
                msg_retado = msg_innocent
            else:
                msg_retador = msg_innocent
                msg_retado = multa_msg
    else:
        raise InvalidStateTransitionError("Resolución inválida")

    # Notificaciones oficiales del Tribunal a ambos combatientes
    notif1 = NotificacionAdmin(
        titulo="⚖️ Veredicto del Tribunal",
        mensaje=msg_retador,
        destinatario_tipo="specific",
        destinatario_id=duel.retador_id,
        estado="sent",
    )
    notif2 = NotificacionAdmin(
        titulo="⚖️ Veredicto del Tribunal",
        mensaje=msg_retado,
        destinatario_tipo="specific",
        destinatario_id=duel.retado_id,
        estado="sent",
    )
    db.add(notif1)
    db.add(notif2)

    await db.commit()
    return {"message": "Duelo resuelto"}
