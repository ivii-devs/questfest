import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import HTTPException, status

# ==============================================================================
# Motor Criptográfico y Gestión de Tokens JWT para QuestFest
# ==============================================================================
# En este módulo centralizamos toda la criptografía del sistema:
# 1. Hashing de contraseñas de usuarios mediante Bcrypt con sal aleatoria.
# 2. Emisión y verificación de tokens JWT (Access Token de corta duración para la API
#    y Refresh Token de larga duración almacenado en cookies seguras HttpOnly).
# 3. Emisión de tokens efímeros para reseteo de contraseñas olvidadas.
# ==============================================================================

# Clave secreta para la firma criptográfica simétrica HMAC-SHA256 (HS256).
# En producción DEBE sobreescribirse mediante la variable de entorno SECRET_KEY.
SECRET_KEY = os.getenv("SECRET_KEY", "clave_por_defecto_si_falla_env_questfest_secret_2026")
ALGORITHM = "HS256"

# Ciclos de expiración de sesiones:
# - Access Token: 24 horas. Es el que viaja en la cabecera 'Authorization: Bearer <token>' para cada petición.
# - Refresh Token: 7 días. Permite al cliente obtener un nuevo Access Token sin obligar al usuario a volver a teclear su clave.
# - Reset Token: 15 minutos. Ventana de tiempo estricta para evitar enlaces de reseteo huérfanos.
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
REFRESH_TOKEN_EXPIRE_DAYS = 7
RESET_TOKEN_EXPIRE_MINUTES = 15

# ------------------------------------------------------------------------------
# Parche de Compatibilidad Crítico: Passlib + Bcrypt >= 4.0.0
# ------------------------------------------------------------------------------
# ¿Por qué este bloque?
# Passlib 1.7.4 (la versión estándar) lee internamente el atributo `bcrypt.__about__.__version__`.
# A partir de Bcrypt 4.0.0, la biblioteca eliminó el submódulo `__about__`, lo que causa
# un AttributeError catastrófico al arrancar FastAPI.
# Además, la especificación de Bcrypt tiene una limitación algorítmica matemática inmutable:
# las contraseñas no pueden exceder los 72 bytes. Bcrypt 4+ lanza un ValueError si recibe
# un secreto > 72 bytes.
# Aquí interceptamos suavemente ambas condiciones para asegurar compatibilidad total sin fallar:
import bcrypt
import passlib.handlers.bcrypt

if not hasattr(bcrypt, "__about__"):
    class _BcryptAbout:
        __version__ = getattr(bcrypt, "__version__", "4.0.0")
    bcrypt.__about__ = _BcryptAbout()

_orig_calc_checksum = passlib.handlers.bcrypt._BcryptBackend._calc_checksum
def _safe_calc_checksum(self, secret):
    # Si la contraseña supera los 72 bytes, la truncamos de forma segura para no provocar un crash en Bcrypt
    if isinstance(secret, bytes) and len(secret) > 72:
        secret = secret[:72]
    return _orig_calc_checksum(self, secret)

passlib.handlers.bcrypt._BcryptBackend._calc_checksum = _safe_calc_checksum

# Contexto de encriptación configurado con el algoritmo bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compara la contraseña en texto plano introducida por el usuario con el hash guardado en PostgreSQL.
    Bcrypt extrae la sal embebida en el hash y valida el cálculo en tiempo constante para evitar ataques de temporización (timing attacks).
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Genera un hash seguro irreversible de la contraseña utilizando Bcrypt con un coste de cómputo adaptativo y sal aleatoria.
    """
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """
    Emite un token de acceso JWT firmado con la clave privada del servidor.
    El payload incluye la fecha de expiración y el tipo 'access' para evitar que se confunda con un refresh token.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """
    Emite un token de refresco JWT de larga duración (7 días).
    Su único propósito es intercambiarse en el endpoint '/api/auth/refresh' para generar nuevos access tokens.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_password_reset_token(username: str) -> str:
    """
    Emite un token de reseteo de contraseña efímero (15 minutos) vinculado al nombre de usuario.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": username, "exp": expire, "type": "reset"}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decodifica y valida criptográficamente la firma y la fecha de expiración de un token JWT.
    Si el token fue alterado o ha caducado, lanza una excepción HTTP 401 Unauthorized inmediatamente.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )