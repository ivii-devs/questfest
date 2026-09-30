"""
================================================================================
ROUTER DE MISIONES Y RETOS SOCIALES: QuestFest
================================================================================
Este enrutador expone los retos de fiesta que los jugadores pueden acometer
para ganar QuestCoins.

Ciclo de vida de una misión:
1. Propuesta Comunitaria (`/suggest`): Un jugador propone un reto divertido (ej. "Baila
   la Macarena con el camarero"). Nace en estado 'propuesta'.
2. Votación Popular (`/{id}/vote`): Los miembros del grupo votan si el reto mola (up)
   o es aburrido/inadecuado (down). Las más votadas pasan al radar del Tribunal.
3. Misiones Activas (`GET /`): Misiones oficiales aprobadas o de ruleta en curso.
   Cada usuario puede ver su progreso individual ('pending', 'approved', 'rejected').
4. Envío de Pruebas (`/{id}/complete`): El usuario adjunta testimonio fotográfico o texto.
   La prueba se remite al Tribunal Administrativo para su posterior validación y abono.
5. Historial de Misiones Cerradas (`GET /closed`): Archivo de misiones finalizadas.
================================================================================
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.crud import misiones_crud
from app.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.misiones_schemas import (
    CompleteMissionRequest,
    MissionResponse,
    SuggestMissionRequest,
    VoteProposalRequest,
)

router = APIRouter()


@router.post("/suggest", status_code=status.HTTP_201_CREATED)
async def suggest_mission(
    request: SuggestMissionRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Registra una sugerencia de misión creada por un jugador.
    Se publica inicialmente en estado 'propuesta' dentro de su grupo activo.
    """
    mision = await misiones_crud.suggest_mission(db, current_user.id, request)
    return {"message": "Misión sugerida con éxito", "mission_id": mision.id}


@router.get("/", response_model=List[MissionResponse])
async def list_missions(
    group_id: Optional[int] = Query(None, description="ID del grupo para filtrar misiones activas"),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Devuelve las misiones activas disponibles para el grupo solicitado.
    Excluye automáticamente las misiones ocultas de la Ruleta Diaria.
    Incluye el estado de resolución ('completed', 'pending_approval', 'none') del usuario actual.
    """
    return await misiones_crud.get_active_missions_with_status(
        db, current_user.id, group_id=group_id
    )


@router.get("/suggested", response_model=List[MissionResponse])
async def list_suggested_missions(
    group_id: Optional[int] = Query(
        None, description="ID del grupo para filtrar misiones sugeridas"
    ),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Devuelve las propuestas de misiones del grupo con el desglose de upvotes,
    downvotes y el voto emitido por el usuario que realiza la consulta.
    """
    return await misiones_crud.get_suggested_missions_with_votes(
        db, current_user.id, group_id=group_id
    )


@router.get("/closed", response_model=List[MissionResponse])
async def list_closed_missions(
    group_id: Optional[int] = Query(
        None, description="ID del grupo para filtrar misiones cerradas"
    ),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Devuelve las misiones cerradas o caducadas asociadas al grupo solicitado."""
    return await misiones_crud.get_closed_missions_with_status(
        db, current_user.id, group_id=group_id
    )


@router.post("/{mission_id}/vote", status_code=status.HTTP_200_OK)
async def vote_mission(
    mission_id: int,
    request: VoteProposalRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Emite un voto ('up' o 'down') sobre una misión en fase de sugerencia.
    Permite alternar o retirar el voto de manera idempotente.
    """
    return await misiones_crud.vote_mission(db, mission_id, current_user.id, request.vote_type)


@router.post("/{mission_id}/complete", status_code=status.HTTP_201_CREATED)
async def complete_mission(
    mission_id: int,
    request: CompleteMissionRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Envía una prueba gráfica (URL de foto en Cloudinary) o testimonio escrito
    certificando la realización del reto.

    La prueba queda en estado 'pending' a la espera de que el Tribunal Administrativo
    la revise y proceda al abono correspondiente de los tokens.
    """
    prueba = await misiones_crud.submit_mission_proof(db, mission_id, current_user.id, request)
    return {"message": "Prueba enviada al Tribunal Administrativo", "proof_id": prueba.id}
