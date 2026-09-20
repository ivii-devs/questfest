from pydantic import BaseModel, Field, ConfigDict, model_validator, field_validator
from typing import Optional, Any
from datetime import datetime

class GroupCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100, description="Nombre visible del grupo")
    descripcion: Optional[str] = Field(None, max_length=500, description="Descripción o temática del grupo")
    icono_url: Optional[str] = Field(None, description="URL de la foto o icono del grupo")
    password: Optional[str] = Field(None, min_length=3, max_length=50, description="Contraseña opcional de acceso")
    saldo_inicial: int = Field(default=100, ge=0, le=10000, description="Saldo inicial de QuestCoins para nuevos miembros")

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
    saldo_inicial: Optional[int] = 100
    creador_id: Optional[int] = None

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
    """
    Esquema para modificar el rol de un participante dentro del grupo.
    Admite tanto 'rol' como 'nuevo_rol' para compatibilidad total con peticiones del cliente.
    """
    rol: str = Field(..., pattern="^(admin|member)$", description="Nuevo rol dentro del grupo")

    @model_validator(mode="before")
    @classmethod
    def harmonize_rol(cls, data: Any) -> Any:
        if isinstance(data, dict):
            role_val = data.get("rol") or data.get("nuevo_rol")
            if role_val:
                data["rol"] = str(role_val).strip().lower()
        return data

class GroupMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    usuario_id: int
    username: str
    avatar_url: Optional[str] = None
    rol: str
    saldo_grupo: int
    fecha_union: Optional[datetime] = None
    es_creador: bool = False

class GroupUpdateRequest(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100, description="Nombre visible del grupo")
    descripcion: Optional[str] = Field(None, max_length=500, description="Descripción o temática del grupo")
    icono_url: Optional[str] = Field(None, description="URL de la foto o icono del grupo")
    password: Optional[str] = Field(None, description="Nueva clave secreta (mínimo 3 caracteres) o cadena vacía para eliminar la protección")
    saldo_inicial: Optional[int] = Field(None, ge=0, le=10000, description="Saldo inicial de QuestCoins para nuevos miembros")

    @field_validator("password")
    @classmethod
    def validate_password_update(cls, v: Optional[str]) -> Optional[str]:
        """
        Regla de negocio para actualización de contraseñas de grupo:
        - Si es None: el usuario no desea modificar la clave actual (se conserva el hash intacto).
        - Si es cadena vacía o solo espacios: el administrador desmarcó la protección; se normaliza
          a "" para que grupo_crud desactive 'requiere_password' y borre 'password_hash'.
        - Si contiene texto no vacío: debe tener entre 3 y 50 caracteres para ser una clave válida.
        """
        if v is None:
            return None
        clean = v.strip()
        if not clean:
            return ""
        if len(clean) < 3:
            raise ValueError("La contraseña del grupo debe tener al menos 3 caracteres.")
        if len(clean) > 50:
            raise ValueError("La contraseña del grupo no puede superar los 50 caracteres.")
        return clean

