"""
================================================================================
ROUTER DE MERCADO DE APUESTAS: QuestFest
================================================================================
Este módulo expone las rutas públicas y de jugadores para el sistema de predicciones
y apuestas sociales de QuestFest.

Mecánicas clave de la economía de juego:
1. Sugerencias Comunitarias (`/suggest`): Cualquier jugador puede proponer una apuesta
   (ej. "¿Quién se dormirá primero esta noche?"). Las propuestas se someten a votación
   popular (up/down) antes de que un administrador las apruebe y fije las cuotas.
2. Formato de Opciones Dinámico: Las opciones y multiplicadores se almacenan como JSONB
   en PostgreSQL, pero la API las transforma al vuelo a listas estructuradas para el frontend.
3. Colocación Atómica (`/place`): Las apuestas descuentan saldo de forma inmediata y
   crean el ticket en una única transacción ACID, impidiendo el doble gasto.
4. Cancelación con Reembolso Seguro (`DELETE /{id}`): Si un evento se suspende, los
   fondos apostados se devuelven automáticamente a todos los participantes en su saldo de grupo.
================================================================================
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.crud import apuestas_crud
from app.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.apuestas_schemas import BetResponse, PlaceBetRequest, SuggestBetRequest

router = APIRouter()


@router.post("/suggest", status_code=status.HTTP_201_CREATED)
async def suggest_bet(
    bet_data: SuggestBetRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Propone una nueva apuesta al mercado colectivo.

    Nace en estado 'propuesta' y con fase 'abierta'. No permite apuestas reales
    hasta que un administrador (global o del grupo) valide las opciones y multiplicadores.
    """
    apuesta = await apuestas_crud.create_apuesta(db, current_user.id, bet_data)
    return {"message": "Apuesta creada con éxito", "apuesta_id": apuesta.id}


@router.get("/", response_model=List[BetResponse])
async def list_active_bets(
    group_id: Optional[int] = Query(None, description="ID del grupo para filtrar apuestas"),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lista todas las apuestas (propuestas, abiertas y cerradas) disponibles para el grupo.

    Optimización de rendimiento:
    Para evitar el antipatrón N+1 al resolver creadores y tickets del usuario autenticado,
    se realizan solo 3 consultas independientes y se cruzan en memoria mediante diccionarios O(1).
    """
    from sqlalchemy.future import select

    from app.models.juegos import Apuesta, TicketApuesta

    # Obtener todas las apuestas (abiertas, cerradas, propuestas) del grupo
    stmt = select(Apuesta)
    if group_id is not None:
        stmt = stmt.filter(Apuesta.grupo_id == group_id)
    result = await db.execute(stmt)
    bets = result.scalars().all()

    # Obtener los usernames de los creadores
    creator_ids = list(set([b.creador_id for b in bets]))
    if creator_ids:
        users_result = await db.execute(select(Usuario).filter(Usuario.id.in_(creator_ids)))
        users_map = {u.id: u.username for u in users_result.scalars().all()}
    else:
        users_map = {}

    # Obtener los tickets del usuario actual
    ticket_result = await db.execute(
        select(TicketApuesta).filter(TicketApuesta.usuario_id == current_user.id)
    )
    tickets = ticket_result.scalars().all()
    user_tickets_map = {ticket.apuesta_id: ticket for ticket in tickets}

    response = []

    for bet in bets:
        options_list = []
        if bet.opciones:
            for opt_id, opt_data in bet.opciones.items():
                options_list.append(
                    {"id": opt_id, "text": opt_data["text"], "multiplier": opt_data["multiplier"]}
                )

        ticket = user_tickets_map.get(bet.id)

        user_won = None
        profit = 0
        winning_option = None
        multiplier = None

        if bet.estado == "cerrada" and bet.opcion_ganadora_id and bet.opciones:
            winning_option = bet.opciones.get(bet.opcion_ganadora_id, {}).get("text")
            multiplier = float(bet.opciones.get(bet.opcion_ganadora_id, {}).get("multiplier", 0))
            if ticket:
                user_won = ticket.opcion_id == bet.opcion_ganadora_id
                if user_won:
                    profit = ticket.cantidad * float(
                        bet.opciones.get(ticket.opcion_id, {}).get("multiplier", 0)
                    )

        votos = bet.votos_sugerencia or {}
        upvotes = sum(1 for v in votos.values() if v == "up")
        downvotes = sum(1 for v in votos.values() if v == "down")
        user_vote = votos.get(str(current_user.id))

        response.append(
            {
                "id": str(bet.id),
                "title": bet.titulo,
                "creator": users_map.get(bet.creador_id, "Admin"),
                "phase": bet.fase,
                "estado": bet.estado,
                "group_id": bet.grupo_id,
                "opcion_ganadora_id": bet.opcion_ganadora_id,
                "options": options_list,
                "userVotedOptionId": ticket.opcion_id if ticket else None,
                "userBetAmount": ticket.cantidad if ticket else 0,
                "userWon": user_won,
                "profit": int(profit),
                "winningOption": winning_option,
                "multiplier": multiplier,
                "upvotes": upvotes,
                "downvotes": downvotes,
                "user_vote": user_vote,
                "createdAt": bet.fecha_creacion,
                "approvedAt": bet.fecha_aprobacion,
            }
        )

    return response


@router.post("/{apuesta_id}/place", status_code=status.HTTP_200_OK)
async def place_bet(
    apuesta_id: int,
    bet_request: PlaceBetRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Un jugador coloca una apuesta con tokens en una opción determinada.

    Flujo económico atómico:
    1. Comprueba que la apuesta esté 'abierta'.
    2. Valida que el jugador disponga de saldo suficiente en el grupo de la apuesta.
    3. Deduce los tokens y registra el ticket en una ÚNICA transacción atómica (`auto_commit=False`),
       evitando condiciones de carrera y la necesidad de reembolsos manuales compensatorios.
    """
    ticket = await apuestas_crud.place_bet(
        db=db,
        apuesta_id=apuesta_id,
        user_id=current_user.id,
        option_id=bet_request.option_id,
        amount=bet_request.amount,
    )
    return {
        "message": "Apuesta colocada exitosamente",
        "ticket_id": ticket.id,
        "tokens_deducted": ticket.cantidad,
    }


@router.post("/{apuesta_id}/vote", status_code=status.HTTP_200_OK)
async def vote_proposal(
    apuesta_id: int,
    vote_data: dict,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Emite un voto a favor ("up") o en contra ("down") sobre una propuesta comunitaria.

    Comportamiento toggle:
    Si el jugador vuelve a pulsar sobre el mismo voto que ya tenía registrado,
    este se retira (se desmarca su voto). Si vota lo opuesto, se sobrescribe.

    ¿Por qué `flag_modified`?
    SQLAlchemy rastrea las mutaciones de columnas ordinarias, pero cuando se modifica
    una clave interna de un diccionario JSON o JSONB sin reasignar la variable raíz,
    el ORM no detecta el cambio automáticamente. `flag_modified` fuerza a que la columna
    se incluya en la sentencia SQL UPDATE.
    """
    from sqlalchemy.future import select
    from sqlalchemy.orm.attributes import flag_modified

    from app.models.juegos import Apuesta

    result = await db.execute(select(Apuesta).where(Apuesta.id == apuesta_id))
    apuesta = result.scalars().first()

    if not apuesta:
        raise HTTPException(status_code=404, detail="Apuesta no encontrada")

    if apuesta.estado != "propuesta":
        raise HTTPException(status_code=400, detail="Solo se pueden votar sugerencias")

    vote_type = vote_data.get("vote_type")
    if vote_type not in ["up", "down"]:
        raise HTTPException(status_code=400, detail="Voto inválido")

    votos = dict(apuesta.votos_sugerencia) if apuesta.votos_sugerencia else {}

    current_vote = votos.get(str(current_user.id))
    if current_vote == vote_type:
        # Si vota lo mismo, retiramos el voto (toggle)
        del votos[str(current_user.id)]
    else:
        votos[str(current_user.id)] = vote_type

    apuesta.votos_sugerencia = votos
    flag_modified(apuesta, "votos_sugerencia")

    await db.commit()
    return {"message": "Voto registrado"}


@router.delete("/{apuesta_id}")
async def delete_bet(
    apuesta_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cancela y elimina una apuesta del sistema, reembolsando de forma automática
    la totalidad de los tokens apostados a cada uno de los participantes.

    Seguridad y Gobernanza:
    - Solo permitida para Administradores Globales (`rol='admin'`) o Administradores
      del grupo local donde se creó la apuesta (`MiembroGrupo.rol='admin'`).
    - El reembolso se abona directamente en el saldo local del grupo al que correspondía la apuesta.
    - Las devoluciones se realizan con `auto_commit=False` y se persisten en bloque al final.
    """
    from sqlalchemy.future import select

    from app.crud.ledger_crud import move_tokens
    from app.models.juegos import Apuesta, TicketApuesta
    from app.models.notificaciones import NotificacionAdmin
    from app.models.usuario import Usuario as ModelUsuario

    result = await db.execute(select(Apuesta).where(Apuesta.id == apuesta_id))
    bet = result.scalars().first()

    if not bet:
        raise HTTPException(status_code=404, detail="Apuesta no encontrada")

    # Verificamos si es administrador global o administrador del grupo correspondiente
    is_authorized = getattr(current_user, "rol", "") == "admin" or getattr(
        current_user, "is_superuser", False
    )
    if not is_authorized and bet.grupo_id:
        from app.models.grupo import MiembroGrupo

        res_m = await db.execute(
            select(MiembroGrupo).filter(
                MiembroGrupo.grupo_id == bet.grupo_id,
                MiembroGrupo.usuario_id == current_user.id,
                MiembroGrupo.rol == "admin",
            )
        )
        if res_m.scalars().first():
            is_authorized = True

    if not is_authorized:
        raise HTTPException(
            status_code=403, detail="No tienes permisos para realizar esta acción en este grupo"
        )

    # Recuperamos todos los tickets apostados en este evento
    ticket_res = await db.execute(
        select(TicketApuesta).where(TicketApuesta.apuesta_id == apuesta_id)
    )
    tickets = ticket_res.scalars().all()

    for ticket in tickets:
        user_res = await db.execute(
            select(ModelUsuario).where(ModelUsuario.id == ticket.usuario_id)
        )
        user = user_res.scalars().first()
        if user:
            # Reembolsar en el saldo correspondiente del grupo con auto_commit=False
            await move_tokens(
                db=db,
                user_id=user.id,
                amount=ticket.cantidad,
                concept=f"Reembolso por apuesta cancelada: {bet.titulo}",
                group_id=bet.grupo_id,
                auto_commit=False,
            )

            # Notificación de cortesía al usuario informándole del reembolso
            notif = NotificacionAdmin(
                titulo="Apuesta Cancelada",
                mensaje=f"La apuesta '{bet.titulo}' ha sido cancelada por el administrador y se te han devuelto {ticket.cantidad} tokens.",
                destinatario_tipo="specific",
                destinatario_id=user.id,
                estado="sent",
            )
            db.add(notif)

        await db.delete(ticket)

    await db.delete(bet)
    await db.commit()
    return {"message": "Apuesta eliminada y reembolsos emitidos correctamente"}
