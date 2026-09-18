"""
================================================================================
ROUTER DE DUELOS PvP: QuestFest
================================================================================
Este enrutador gestiona los enfrentamientos directos uno contra uno (PvP) entre
jugadores de un mismo grupo.

Dinámica de juego:
1. Reto (`POST /`): El retador propone un juego (ej. "Piedra, Papel o Tijera", "Pulseada")
   y una apuesta en QuestCoins. Los tokens del retador quedan bloqueados inmediatamente
   en custodia (Escrow).
2. Listado (`GET /`): Muestra los duelos del grupo con avatares de ambos contendientes
   y una marca `is_current_user_challenged` para que el frontend resalte las acciones pendientes.
3. Máquina de Estados y Acciones (`POST /{duel_id}/action`):
   - `?action=accept`: El retado acepta el desafío y se le retienen los tokens de su saldo.
   - `?action=reject`: El retado declina el duelo. Si se rechaza antes de aceptar, se cancela
     sin coste; si ya estaba en juego, se eleva al Tribunal Administrativo.
   - `?action=resolve`: Uno de los participantes declara el resultado, pasando a estado
     de validación para que el Tribunal audite o ratifique el vencedor.
================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.duelos_schemas import DuelCreateRequest, DuelResponse, ResolveDuelRequest
from app.crud import duelos_crud

router = APIRouter()

@router.post("/", status_code=status.HTTP_201_CREATED)
async def launch_duel(
    request: DuelCreateRequest, 
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lanza un desafío directo a otro participante del mismo grupo.
    
    Verificaciones ejecutadas:
    - Retador y retado deben ser personas distintas.
    - El retado debe ser miembro activo del grupo indicado.
    - El retador debe disponer de saldo suficiente para cubrir la apuesta inicial.
    """
    duel = await duelos_crud.create_duel(db, current_user.id, request)
    return {"message": "Duelo lanzado con éxito, esperando respuesta", "duel_id": duel.id}

@router.get("/", response_model=List[DuelResponse])
async def list_duels(
    group_id: Optional[int] = Query(None, description="ID del grupo para filtrar duelos"),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Obtiene la lista de duelos asociados al grupo solicitado.
    
    Incluye los nombres de usuario y avatares de retador y retado (precargados de forma eager),
    y calcula el indicador `is_current_user_challenged` que permite al cliente móvil
    mostrar los botones de acción rápida exclusivamente al jugador que fue desafiado.
    """
    duels = await duelos_crud.get_active_duels(db, group_id=group_id)
    response = []
    for d in duels:
        winner = None
        if d.ganador_id:
            winner = d.retador.username if d.ganador_id == d.retador_id else d.retado.username
            
        response.append({
            "id": d.id,
            "challenger": d.retador.username,
            "challenged": d.retado.username,
            "game": d.juego,
            "wager": d.tokens_en_juego,
            "status": d.estado,
            "group_id": d.grupo_id,
            "winner": winner,
            "is_current_user_challenged": current_user.id == d.retado_id,
            "challenger_avatar": d.retador.avatar_url,
            "challenged_avatar": d.retado.avatar_url,
            "fecha_creacion": d.fecha_creacion.isoformat() + "Z" if d.fecha_creacion else None,
            "reported_resolution": d.reported_resolution
        })
    return response

@router.post("/{duel_id}/action", status_code=status.HTTP_200_OK)
async def duel_action(
    duel_id: int,
    action: str = Query(..., description="Puede ser 'accept', 'reject', o 'resolve'"),
    resolve_data: Optional[ResolveDuelRequest] = None,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Controlador centralizado para la máquina de estados de duelos:
    - ?action=accept  -> Valida saldo del retado, deduce tokens a Escrow y pasa a 'accepted'.
    - ?action=reject  -> Cancela el reto o lo envía al Tribunal si hubo conflicto.
    - ?action=resolve -> Notifica propuesta de victoria para arbitraje por el Tribunal.
    """
    if action in ("accept", "reject"):
        duel = await duelos_crud.update_duel_status(db, duel_id, current_user.id, action)
        return {"message": f"Duelo actualizado: {action}", "status": duel.estado}
        
    elif action == "resolve":
        if not resolve_data:
            raise HTTPException(status_code=400, detail="Se requiere el body ResolveDuelRequest para resolver")
        duel = await duelos_crud.report_duel_outcome(db, duel_id, current_user.id, resolve_data.resolution)
        return {"message": "Resultado enviado al Tribunal de Administración", "status": duel.estado}
        
    else:
        raise HTTPException(status_code=400, detail="Acción no reconocida")
