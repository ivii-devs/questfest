"""
================================================================================
OPERACIONES CRUD PARA MERCADOS DE APUESTAS Y PREDICCIONES: QuestFest
================================================================================
Gestiona el ciclo de vida de persistencia de las apuestas comunitarias:
1. Sugerencia comunitaria de propuestas con identificadores UUID de opciones.
2. Registro atómico de tickets de apuesta con deducción pesimista en el Ledger.
3. Desacoplado del protocolo HTTP mediante excepciones limpias del dominio.
================================================================================
"""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    DomainException,
    EntityNotFoundError,
    InvalidStateTransitionError,
)
from app.crud.ledger_crud import move_tokens
from app.models.grupo import MiembroGrupo
from app.models.juegos import Apuesta, TicketApuesta
from app.schemas.apuestas_schemas import SuggestBetRequest


async def create_apuesta(db: AsyncSession, user_id: int, bet_data: SuggestBetRequest) -> Apuesta:
    """
    Crea una nueva propuesta de apuesta sugerida por un jugador para su grupo activo.

    Generación de Opciones (JSONB):
    Cada opción introducida por el usuario recibe un identificador alfanumérico corto (8 caracteres UUID)
    para referenciarla inequívocamente al votar o apostar (ej. 'a3f89b12': {'text': 'Gana Juan', 'multiplier': 2.5}).
    La apuesta nace en estado 'propuesta' para pasar a votación comunitaria.
    """
    opciones_dict = {}
    for opt in bet_data.options:
        opt_id = str(uuid.uuid4())[:8]
        opciones_dict[opt_id] = {
            "id": opt_id,
            "text": opt.text,
            "multiplier": opt.multiplier,
        }

    grupo_id = bet_data.group_id
    if grupo_id is None:
        member_stmt = (
            select(MiembroGrupo.grupo_id).where(MiembroGrupo.usuario_id == user_id).limit(1)
        )
        res = await db.execute(member_stmt)
        grupo_id = res.scalar()

    db_apuesta = Apuesta(
        titulo=bet_data.title,
        creador_id=user_id,
        opciones=opciones_dict,
        fase="global",
        estado="propuesta",
        grupo_id=grupo_id,
    )
    db.add(db_apuesta)
    await db.commit()
    await db.refresh(db_apuesta)
    return db_apuesta


async def place_bet(
    db: AsyncSession, apuesta_id: int, user_id: int, option_id: str, amount: int
) -> TicketApuesta:
    """
    Registra la participación de un usuario en un mercado mediante una transacción ACID atómica.

    ¿Por qué una transacción única con 'auto_commit=False'?
    Anteriormente, el sistema debitaba tokens con commit inmediato y luego, si la inserción
    del ticket fallaba por duplicidad, realizaba una transacción inversa de reembolso.
    Ahora ejecutamos el débito en 'move_tokens(..., auto_commit=False)' y la creación de 'TicketApuesta'
    dentro de la MISMA transacción. Si la base de datos detecta que el usuario ya participó
    o no tiene saldo suficiente, un único 'rollback()' revierte ambas operaciones limpiamente
    sin necesidad de generar asientos contables de contingencia en el Ledger.
    """
    if amount <= 0:
        raise InvalidStateTransitionError("El importe a apostar debe ser mayor que cero")

    # 1. Recuperar la apuesta y validar su existencia y apertura
    result = await db.execute(select(Apuesta).filter(Apuesta.id == apuesta_id))
    apuesta = result.scalars().first()

    if not apuesta:
        raise EntityNotFoundError("Apuesta no encontrada")
    if apuesta.estado != "abierta":
        raise InvalidStateTransitionError(
            "El mercado para esta apuesta no está abierto para recibir predicciones"
        )

    # 2. Validar que la opción elegida exista en el catálogo JSONB de la apuesta
    if option_id not in apuesta.opciones:
        raise InvalidStateTransitionError("La opción seleccionada no existe en esta apuesta")

    # Resolver grupo_id para confinamiento estricto a MiembroGrupo
    target_group_id = apuesta.grupo_id
    if target_group_id is None:
        member_stmt = (
            select(MiembroGrupo.grupo_id).where(MiembroGrupo.usuario_id == user_id).limit(1)
        )
        res = await db.execute(member_stmt)
        target_group_id = res.scalar()

    # 3. Transacción atómica combinada (Débito en Ledger + Emisión de Ticket)
    try:
        # Inmovilización de tokens en el saldo del grupo correspondiente
        await move_tokens(
            db=db,
            user_id=user_id,
            amount=-amount,
            concept=f"Apuesta colocada en: {apuesta.titulo}",
            auto_commit=False,
            group_id=target_group_id,
        )

        # Creación del cupón individual
        ticket = TicketApuesta(
            usuario_id=user_id,
            apuesta_id=apuesta_id,
            opcion_id=option_id,
            cantidad=amount,
            grupo_id=target_group_id,
        )
        db.add(ticket)

        # Confirmamos ambas mutaciones en un único COMMIT
        await db.commit()
        await db.refresh(ticket)
        return ticket

    except IntegrityError:
        # Si salta violación de unicidad ('uq_usuario_apuesta') o saldo negativo, revertimos todo
        await db.rollback()
        raise ConflictError(
            "Operación cancelada. Ya has participado en esta apuesta o tu saldo de tokens es insuficiente."
        )
    except DomainException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise DomainException(f"Error al registrar la apuesta: {str(e)}")
