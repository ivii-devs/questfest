from pydantic import BaseModel, Field, ConfigDict
from enum import Enum
from typing import List, Optional
from datetime import datetime
class VoteTypeEnum(str, Enum):
    up = "up"
    down = "down"

class BetPhaseEnum(str, Enum):
    noche_1 = "noche-1"
    noche_2 = "noche-2"
    noche_3 = "noche-3"
    global_phase = "global"

class BetOptionBase(BaseModel):
    text: str = Field(..., min_length=1, max_length=100)
    multiplier: float = Field(..., gt=1.0)

class BetOptionResponse(BetOptionBase):
    id: str

class SuggestBetOption(BaseModel):
    text: str = Field(..., min_length=1, max_length=100)
    multiplier: float = Field(..., gt=1.0)

# Para proponer una apuesta
class SuggestBetRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    options: List[SuggestBetOption] = Field(..., min_length=2)
    group_id: Optional[int] = Field(None, description="ID del grupo al que pertenece la sugerencia de apuesta")

# Para editar una apuesta propuesta por un administrador
class AdminEditBetRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    options: List[SuggestBetOption] = Field(..., min_length=2)

# Para votar una apuesta propuesta
class VoteProposalRequest(BaseModel):
    vote_type: VoteTypeEnum

# Para apostar en una apuesta activa
class PlaceBetRequest(BaseModel):
    option_id: str
    amount: int = Field(..., gt=0)

# Respuesta de Apuesta General
class BetResponse(BaseModel):
    id: str
    title: str
    creator: str
    phase: BetPhaseEnum
    estado: str = "abierta"
    group_id: Optional[int] = None
    opcion_ganadora_id: Optional[str] = None
    createdAt: Optional[datetime] = None
    approvedAt: Optional[datetime] = None
    # Opciones de la apuesta
    options: Optional[List[BetOptionResponse]] = None
    suggested_options: Optional[List[SuggestBetOption]] = None
    
    # Estado del usuario actual
    userVotedOptionId: Optional[str] = None
    userBetAmount: Optional[int] = None
    user_vote: Optional[VoteTypeEnum] = None
    userWon: Optional[bool] = None
    profit: Optional[int] = None
    
    # Votos para propuestas
    upvotes: Optional[int] = None
    downvotes: Optional[int] = None
    
    # Datos si está cerrada
    winningOption: Optional[str] = None
    multiplier: Optional[float] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
