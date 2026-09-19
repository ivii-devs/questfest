from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional, Any
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
    """
    Esquema de solicitud para incorporarse a una comunidad existente.
    
    ¿Por qué admitir tanto 'codigo_unico' como 'codigo_invitacion'?
    El backend internamente maneja 'codigo_unico' en la base de datos PostgreSQL,
    pero las interfaces y componentes PWA del frontend pueden emplear el alias 'codigo_invitacion'.
    Mediante un validador previo normalizamos ambos nombres y aseguramos que el código
    se procese en mayúsculas sin espacios en blanco superfluos.
    """
    codigo_unico: Optional[str] = Field(None, min_length=4, max_length=12, description="Código identificativo del grupo (ej: QF-XXXXX)")
    codigo_invitacion: Optional[str] = Field(None, min_length=4, max_length=12, description="Alias compatible para el frontend")
    password: Optional[str] = Field(None, description="Contraseña requerida si el grupo es privado")

    @model_validator(mode="before")
    @classmethod
    def harmonize_code(cls, data: Any) -> Any:
        if isinstance(data, dict):
            code = data.get("codigo_unico") or data.get("codigo_invitacion")
            if not code or not str(code).strip():
                raise ValueError("Debes proporcionar el código de invitación o código identificativo del grupo.")
            clean_code = str(code).strip().upper()
            data["codigo_unico"] = clean_code
            data["codigo_invitacion"] = clean_code
        return data

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
