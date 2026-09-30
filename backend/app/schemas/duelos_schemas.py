from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DuelStatusEnum(str, Enum):
    pending = "pending"
    accepted = "accepted"
    validation_winner = "validation_winner"
    validation_rejected = "validation_rejected"
    completed = "completed"
    penalized_challenger = "penalized_challenger"


class DuelResolutionEnum(str, Enum):
    challenger = "challenger"
    challenged = "challenged"
    draw = "draw"


class DuelCreateRequest(BaseModel):
    challenged_username: str = Field(..., min_length=3)
    game: str = Field(..., min_length=3, max_length=150)
    wager: int = Field(..., gt=0, description="Tokens en juego")
    group_id: Optional[int] = Field(None, description="ID del grupo al que pertenece el duelo")


class ResolveDuelRequest(BaseModel):
    resolution: DuelResolutionEnum


class DuelResponse(BaseModel):
    id: int
    challenger: str
    challenged: str
    game: str
    wager: int
    status: DuelStatusEnum
    group_id: Optional[int] = None
    is_current_user_challenged: bool = False
    winner: Optional[str] = None
    challenger_avatar: Optional[str] = None
    challenged_avatar: Optional[str] = None
    fecha_creacion: Optional[str] = None
    reported_resolution: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
