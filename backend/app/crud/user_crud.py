from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.usuario import Usuario
from app.schemas.auth_schemas import UserCreate
from app.security import get_password_hash
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from starlette.concurrency import run_in_threadpool

# ==============================================================================
# Operaciones CRUD para Gestión de Usuarios y Perfiles (QuestFest)
# ==============================================================================
# Este módulo centraliza las operaciones sobre la tabla 'usuarios':
# 1. Búsquedas indexadas por 'username' y clave primaria 'id'.
# 2. Creación segura de jugadores con hashing de contraseñas fuera del bucle de eventos.
# ==============================================================================

async def get_user_by_username(db: AsyncSession, username: str):
    """
    Recupera un usuario por su nombre de usuario único ('username').
    Aprovecha el índice B-Tree creado en PostgreSQL para resolver la búsqueda en O(log N).
    """
    result = await db.execute(select(Usuario).filter(Usuario.username == username))
    return result.scalars().first()

async def get_user_by_id(db: AsyncSession, user_id: int):
    """
    Recupera un usuario por su identificador numérico de clave primaria.
    """
    result = await db.execute(select(Usuario).filter(Usuario.id == user_id))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: UserCreate, role: str = "player"):
    """
    Registra a un nuevo usuario en la base de datos.
    
    ¿Por qué 'run_in_threadpool(get_password_hash)'?
    El algoritmo Bcrypt es intensivo en consumo de CPU (CPU-bound) y síncrono.
    Si se ejecutara directamente en la función asíncrona, congelaría el bucle de eventos
    (Event Loop) de Python durante cientos de milisegundos, bloqueando a todos los demás
    usuarios concurrentes de la API. Al delegarlo a un hilo del pool secundario ('threadpool'),
    FastAPI mantiene intacta su capacidad de respuesta no bloqueante.
    """
    hashed_password = await run_in_threadpool(get_password_hash, user.password)
    db_user = Usuario(
        username=user.username,
        password_hash=hashed_password,
        rol=role
    )
    db.add(db_user)
    try:
        await db.commit()
        await db.refresh(db_user)
        return db_user
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error de integridad: El nombre de usuario ya está registrado en la plataforma."
        )
