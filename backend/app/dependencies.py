from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from app import security
from app.core.database import get_db
from app.crud.user_crud import get_user_by_id
import app.models as models

# ==============================================================================
# Dependencias de Autenticación y Autorización (FastAPI Dependency Injection)
# ==============================================================================
# Este módulo define los guardianes de seguridad que protegen los endpoints privados.
# Utiliza el patrón de inyección de dependencias de FastAPI ('Depends') para:
# 1. Extraer el token Bearer de las cabeceras HTTP de forma transparente.
# 2. Validar criptográficamente la identidad del usuario contra PostgreSQL.
# 3. Determinar los permisos del usuario (Rol Global de Plataforma vs Rol de Grupo).
# ==============================================================================

# Esquema OAuth2 con flujo Password Bearer.
# 'tokenUrl' define el endpoint relativo donde el cliente (o la interfaz Swagger UI)
# intercambia credenciales 'username' y 'password' por el token JWT.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    """
    Guardián de Autenticación Base.
    
    Flujo de ejecución:
    1. Intercepta la cabecera 'Authorization: Bearer <token>' enviada por Axios/cliente.
    2. Decodifica el token con la clave secreta y algoritmo configurados.
    3. Extrae el 'user_id' embebido en los claims del token.
    4. Consulta a la base de datos para confirmar que el usuario existe y su cuenta sigue activa.
    5. Si el token expiró, fue manipulado o el usuario ya no existe, aborta con HTTP 401 Unauthorized.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales (Token inválido o caducado)",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decodificamos el payload validando la firma HMAC-SHA256
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Verificación en base de datos: Garantiza que un token emitido no siga siendo válido
    # si el usuario fue dado de baja de la base de datos tras la emisión del JWT
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise credentials_exception
        
    return user

async def get_admin_user(
    current_user: models.usuario.Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Guardián de Autorización de Alto Nivel (Modo Dios y Panel Administrativo).
    
    Modelo de Control de Acceso Basado en Roles (RBAC Híbrido):
    En QuestFest coexisten dos niveles de administración:
    - Superadministrador Global ('current_user.rol == "admin"'): Tiene acceso ilimitado
      a todos los grupos, auditorías globales, ajustes de sistema y balance general.
    - Administrador de Grupo ('MiembroGrupo.rol == "admin"'): Es el creador o moderador
      designado de una comunidad o evento particular. Debe poder acceder al panel para
      aprobar misiones, resolver apuestas y gestionar duelos dentro de su jurisdicción.
    
    Si el usuario no cumple ninguna de las dos condiciones, se deniega el acceso con HTTP 403 Forbidden.
    """
    # Nivel 1: Superadministrador de plataforma (Pase directo)
    if current_user.rol == "admin":
        return current_user

    # Nivel 2: Administrador delegado de al menos un grupo activo
    from sqlalchemy.future import select
    from app.models.grupo import MiembroGrupo
    stmt = select(MiembroGrupo).filter(
        MiembroGrupo.usuario_id == current_user.id,
        MiembroGrupo.rol == "admin"
    )
    res = await db.execute(stmt)
    if res.scalars().first():
        return current_user

    # Acceso denegado: El usuario es un jugador regular sin facultades arbitrales
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Acceso denegado. Se requieren privilegios de Administrador de grupo o global."
    )

async def verify_group_admin(
    db: AsyncSession, 
    user: models.usuario.Usuario, 
    group_id: Optional[int]
) -> bool:
    """
    Guardián de Jurisdicción Territorial Multi-Tenancy (QuestFest).
    
    ¿Por qué este control adicional?
    'get_admin_user' valida que el usuario sea administrador de AL MENOS una comunidad
    para permitirle cargar la interfaz del panel de control.
    Sin embargo, al momento de dictar sentencia (cerrar una apuesta, validar un duelo o
    aprobar misiones), este guardián certifica que el administrador tenga rango de 'admin'
    ESPECÍFICAMENTE en el grupo al que pertenece la entidad en litigio.
    
    Reglas de Acceso:
    1. Si 'user.rol == "admin"': Superusuario global de la plataforma (acceso omnisciente concedido).
    2. Si 'group_id is None': Entidad sin grupo; solo auditable por superadministradores.
    3. Si el usuario ostenta 'rol == "admin"' en 'miembros_grupo' para ese 'group_id': Acceso concedido.
    4. En cualquier otro caso: Aborta con HTTP 403 Forbidden para prevenir interferencias entre eventos.
    """
    if user.rol == "admin":
        return True

    if group_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación restringida: Solo un superadministrador global puede gestionar entidades sin comunidad asignada."
        )

    from sqlalchemy.future import select
    from app.models.grupo import MiembroGrupo

    stmt = select(MiembroGrupo).filter(
        MiembroGrupo.usuario_id == user.id,
        MiembroGrupo.grupo_id == group_id,
        MiembroGrupo.rol == "admin"
    )
    res = await db.execute(stmt)
    if not res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Acceso denegado. No tienes facultades de administración en el grupo {group_id}."
        )

    return True