from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class GroupCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100, description="Nombre visible del grupo")
    descripcion: Optional[str] = Field(None, max_length=500, description="Descripción o temática del grupo")
    icono_url: Optional[str] = Field(None, description="URL de la foto o icono del grupo")
    password: Optional[str] = Field(None, min_length=3, max_length=50, description="Contraseña opcional de acceso")

class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo_unico: str
    nombre: str
    descripcion: Optional[str] = None
    icono_url: Optional[str] = None
    requiere_password: bool
    saldo_inicial: int
    creador_id: Optional[int] = None
    fecha_creacion: datetime


class UserGroupCardResponse(BaseModel):
    id: int
    codigo_unico: str
    codigo_invitacion: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    icono_url: Optional[str] = None
    avatar_url: Optional[str] = None
    rol: str
    saldo_grupo: int
    ranking_posicion: int
    miembros_totales: int
    requiere_password: bool = False

class GroupJoinRequest(BaseModel):
    codigo_unico: str = Field(..., min_length=4, max_length=12, description="Código identificativo del grupo")
    password: Optional[str] = Field(None, description="Contraseña requerida si el grupo es privado")

class GroupInviteResponse(BaseModel):
    codigo_unico: str
    codigo_invitacion: Optional[str] = None
    nombre: str
    enlace_invitacion: str
    qr_payload: str

class UpdateMemberRoleRequest(BaseModel):
    rol: str = Field(..., pattern="^(admin|member)$", description="Nuevo rol dentro del grupo")

class GroupMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    usuario_id: int
    username: str
    avatar_url: Optional[str] = None
    rol: str
    saldo_grupo: int
    fecha_union: Optional[datetime] = None

class GroupUpdateRequest(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100, description="Nombre visible del grupo")
    descripcion: Optional[str] = Field(None, max_length=500, description="Descripción o temática del grupo")
    icono_url: Optional[str] = Field(None, description="URL de la foto o icono del grupo")
    password: Optional[str] = Field(None, min_length=3, max_length=50, description="Contraseña opcional de acceso")
