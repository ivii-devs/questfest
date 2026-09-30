from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RoleEnum(str, Enum):
    admin = "admin"
    player = "player"


class UserBase(BaseModel):
    username: str = Field(
        ..., min_length=3, max_length=50, description="Nombre de usuario del jugador"
    )


class UserCreate(UserBase):
    password: str = Field(
        ..., min_length=6, description="Contraseña en texto plano para el registro"
    )


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: int
    saldo_actual: int = Field(default=0, description="Saldo actual de tokens")
    rol: RoleEnum
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
