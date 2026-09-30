"""
================================================================================
SERVICIO DE ADMINISTRACIÓN Y RESOLUCIÓN DE APUESTAS: QuestFest
================================================================================
Este servicio encapsula toda la lógica de dominio para la gestión del mercado
de apuestas desde la perspectiva del Tribunal y administradores de grupo:
1. Edición y curación de sugerencias de apuestas (título, opciones, multiplicadores).
2. Transición de estados de mercado: 'abierta', 'rechazada' y 'cerrada'.
3. Liquidación atómica de apuestas ganadoras con resolución del antipatrón N+1
   y bloqueo pesimista en base de datos (`with_for_update`), abonando dividendos
   en el Ledger contable de la comunidad correspondiente.
================================================================================
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import EntityNotFoundError, InvalidStateTransitionError
from app.crud.ledger_crud import move_tokens
from app.dependencies import verify_group_admin
from app.models.grupo import MiembroGrupo
from app.models.juegos import Apuesta, TicketApuesta
from app.models.usuario import Usuario
from app.schemas.admin_schemas import BetStatusUpdate
from app.schemas.apuestas_schemas import AdminEditBetRequest


async def edit_suggested_bet(
    db: AsyncSession,
    bet_id: int,
    edit_data: AdminEditBetRequest,
    current_user: Usuario,
) -> dict:
    """
    Permite al administrador corregir el enunciado o reajustar los multiplicadores
    de una apuesta propuesta por un jugador antes de abrirla a cotización pública.

    ¿Por qué esta restricción?
    Solo se permite en estado 'propuesta'. Una vez que la apuesta pasa a 'abierta',
    los jugadores ya han arriesgado QuestCoins bajo las cuotas anunciadas; alterarlas
    a posteriori violaría las garantías de equidad económica del sistema.
    """
    result = await db.execute(select(Apuesta).where(Apuesta.id == bet_id))
    bet = result.scalars().first()
    if not bet:
        raise EntityNotFoundError("Apuesta no encontrada")

    await verify_group_admin(db, current_user, bet.grupo_id)

    if bet.estado != "propuesta":
        raise InvalidStateTransitionError("Solo se pueden editar apuestas en estado propuesta")

    bet.titulo = edit_data.title

    # Reconstruimos la estructura JSONB de opciones con identificadores secuenciales (base 1)
    new_options = {}
    for index, option in enumerate(edit_data.options):
        option_id = str(index + 1)
        new_options[option_id] = {
            "text": option.text,
            "multiplier": option.multiplier,
        }

    bet.opciones = new_options
    await db.commit()
    return {"message": "Apuesta actualizada exitosamente"}


async def update_bet_status(
    db: AsyncSession,
    bet_id: int,
    update_data: BetStatusUpdate,
    current_user: Usuario,
) -> dict:
    """
    Ejecuta el ciclo de vida y liquidación de una apuesta comunitaria:

    - 'abierta': Habilita la compra de boletos y sella la marca temporal `fecha_aprobacion`.
    - 'rechazada': Descarta la propuesta sin admitir participación adicional.
    - 'cerrada': Proclama la opción vencedora y liquida las ganancias en el Ledger.

    Prevención del Antipatrón N+1 y Saturación de Conexiones:
    Tradicionalmente, iterar sobre cada ticket ganador consultando `select(Usuario)` individualmente
    provocaba N consultas secuenciales a PostgreSQL. En grupos concurridos, esto agotaba el pool
    de conexiones asyncpg. Aquí agrupamos los IDs en una sola consulta `Usuario.id.in_(user_ids)`
    con `with_for_update()` para asegurar que los saldos queden protegidos contra condiciones de carrera.
    """
    result = await db.execute(select(Apuesta).where(Apuesta.id == bet_id))
    bet = result.scalars().first()
    if not bet:
        raise EntityNotFoundError("Apuesta no encontrada")

    await verify_group_admin(db, current_user, bet.grupo_id)

    if update_data.estado == "abierta":
        bet.estado = "abierta"
        bet.fecha_aprobacion = func.now()
        await db.commit()
        return {"status": "abierta"}

    elif update_data.estado == "rechazada":
        bet.estado = "rechazada"
        await db.commit()
        return {"status": "rechazada"}

    elif update_data.estado == "cerrada":
        if not update_data.opcion_ganadora_id:
            raise InvalidStateTransitionError("Debe proveer opcion_ganadora_id")

        bet.estado = "cerrada"
        bet.opcion_ganadora_id = update_data.opcion_ganadora_id

        # Recuperar todos los boletos ganadores emitidos para la opción seleccionada
        ticket_result = await db.execute(
            select(TicketApuesta).where(
                (TicketApuesta.apuesta_id == bet.id)
                & (TicketApuesta.opcion_id == update_data.opcion_ganadora_id)
            )
        )
        winning_tickets = ticket_result.scalars().all()

        # Multiplicador pactado en las opciones de la apuesta
        multiplier = bet.opciones.get(update_data.opcion_ganadora_id, {}).get("multiplier", 1.0)

        # Carga masiva en una única consulta para eliminar el cuello de botella N+1
        winner_user_ids = list({ticket.usuario_id for ticket in winning_tickets})
        users_by_id = {}
        if winner_user_ids:
            user_stmt = select(Usuario).where(Usuario.id.in_(winner_user_ids)).with_for_update()
            user_res = await db.execute(user_stmt)
            users_by_id = {user.id: user for user in user_res.scalars().all()}

        for ticket in winning_tickets:
            user = users_by_id.get(ticket.usuario_id)
            if user:
                ganancia = int(ticket.cantidad * float(multiplier))
                target_group_id = bet.grupo_id or ticket.grupo_id
                if target_group_id is None:
                    member_stmt = (
                        select(MiembroGrupo.grupo_id)
                        .where(MiembroGrupo.usuario_id == user.id)
                        .limit(1)
                    )
                    res = await db.execute(member_stmt)
                    target_group_id = res.scalar()

                # Abonamos con auto_commit=False para preservar la atomicidad de todo el reparto
                await move_tokens(
                    db=db,
                    user_id=user.id,
                    amount=ganancia,
                    concept=f"Premio de apuesta: {bet.titulo}",
                    group_id=target_group_id,
                    auto_commit=False,
                )

        # Confirmación atómica unificada de la liquidación del mercado
        await db.commit()
        return {"status": "cerrada"}

    raise InvalidStateTransitionError("Estado no válido")
