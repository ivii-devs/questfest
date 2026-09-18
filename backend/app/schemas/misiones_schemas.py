from pydantic import BaseModel, Field, ConfigDict, HttpUrl
from enum import Enum
from typing import List, Optional

class MissionPhaseEnum(str, Enum):
    noche_1 = "noche-1"
    noche_2 = "noche-2"
    noche_3 = "noche-3"
    noche_4 = "noche-4"
    noche_5 = "noche-5"
    global_phase = "global"

class VoteTypeEnum(str, Enum):
    up = "up"
    down = "down"

class SuggestMissionRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=150)
    description: str = Field(..., min_length=10, max_length=500)
    reward: int = Field(..., gt=0)
    group_id: Optional[int] = Field(None, description="ID del grupo al que pertenece la misión")

class VoteProposalRequest(BaseModel):
    vote_type: VoteTypeEnum

class CompleteMissionRequest(BaseModel):
    proof_text: Optional[str] = Field(None, max_length=500, description="Mensaje explicativo para el Tribunal")
    proof_image_url: Optional[HttpUrl] = Field(None, description="URL de la imagen/video adjunto")

class MissionResponse(BaseModel):
    id: str
    title: str
    description: str
    reward: int
    group_id: Optional[int] = None
    
    # Datos de misiones activas/cerradas
    max_completions: Optional[int] = None
    completed_by: Optional[List[str]] = None
    user_has_completed: Optional[bool] = None
    user_is_pending: Optional[bool] = None
    phase: Optional[MissionPhaseEnum] = None
    is_roulette: Optional[bool] = False
    
    # Datos de misiones propuestas
    author: Optional[str] = None
    upvotes: Optional[int] = None
    downvotes: Optional[int] = None
    user_vote: Optional[VoteTypeEnum] = None
    
    # Para misiones cerradas
    user_completed: Optional[bool] = None
    
    createdAt: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
