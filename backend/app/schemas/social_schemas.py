from pydantic import BaseModel, Field, ConfigDict
from enum import Enum
from typing import Optional, List

class PostTypeEnum(str, Enum):
    social = "social"
    duel = "duel"
    mission = "mission"
    bet = "bet"

class PostCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=280)
    media_url: Optional[str] = Field(None, description="URL opcional de la imagen adjunta")
    group_id: Optional[int] = Field(None, description="ID del grupo al que pertenece la publicación. Si es None, es global.")
    # Nota de Seguridad: No se incluye 'es_sistema' aquí para evitar inyección desde el cliente

class PostResponse(BaseModel):
    id: int
    type: PostTypeEnum
    author: str
    author_avatar_url: Optional[str] = None
    time_ago: str # Puede venir como string formateado o en formato ISO
    content: str
    media_url: Optional[str] = None
    is_system: bool
    group_id: Optional[int] = None
    replies: List["PostResponse"] = []

    model_config = ConfigDict(from_attributes=True)
