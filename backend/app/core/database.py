import os
from typing import Any, AsyncGenerator, Dict

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Cargamos preventivamente las variables del archivo .env local si la variable DATABASE_URL
# no se encuentra preconfigurada en el entorno del sistema operativo (evitando fallbacks a localhost).
load_dotenv()


def normalize_database_url(url: str) -> str:
    """
    Normaliza la URL de conexión a la base de datos para garantizar la compatibilidad
    con el driver asíncrono 'asyncpg' requerido por SQLAlchemy en QuestFest.

    En muchos proveedores de infraestructura en la nube (como Heroku, Render, AWS RDS
    o Supabase), la variable DATABASE_URL se inyecta utilizando esquemas heredados o
    estándar como 'postgres://' o 'postgresql://'. Si intentamos arrancar el motor asíncrono
    con dichos esquemas, SQLAlchemy intentará cargar el driver síncrono (psycopg2) y
    fallará al inicio. Esta función reescribe de forma transparente el prefijo necesario.
    """
    if not url:
        return url

    # Reemplazo seguro del prefijo preservando credenciales, host, puerto y parámetros de consulta
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)

    return url


# Obtener URL desde las variables de entorno y normalizarla automáticamente
RAW_DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://usuario:contraseña@localhost:5432/mibase"
)
DATABASE_URL = normalize_database_url(RAW_DATABASE_URL)

# Configuramos los parámetros del motor asíncrono para maximizar la resiliencia en producción.
# Cuando la aplicación opera detrás de proxies de red, balanceadores o cortafuegos con estado,
# las conexiones TCP inactivas pueden ser terminadas silenciosamente. Las siguientes directivas
# protegen la aplicación contra excepciones del tipo ConnectionDoesNotExistError o caídas HTTP 500:
engine_kwargs: Dict[str, Any] = {
    "echo": False,
    "future": True,
    # pool_pre_ping valida la salud de la conexión emitiendo un 'SELECT 1' pesimista antes de
    # entregarla a la aplicación. Si el socket remoto murió o fue cerrado por el proxy, SQLAlchemy
    # lo descarta inmediatamente y abre una conexión nueva y limpia sin afectar la petición del usuario.
    "pool_pre_ping": True,
    # pool_recycle recicla preventivamente las conexiones que han estado abiertas más de 1800 segundos
    # (30 minutos), adelantándose a los timeouts típicos de proxies inversos y balanceadores.
    "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "1800")),
}

# Detección de entornos Serverless (Vercel Functions o AWS Lambda) y Transaction Pooler de Supabase
is_serverless = bool(os.getenv("VERCEL") or os.getenv("SERVERLESS") or os.getenv("DB_USE_NULLPOOL"))
is_supabase_pooler = (
    "pooler.supabase.com" in DATABASE_URL
    or ":6543" in DATABASE_URL
    or os.getenv("SUPABASE_POOLER", "").lower() in ("true", "1")
)

# Configuramos el pool según la infraestructura de ejecución:
# - En Serverless (Vercel): Usamos 'NullPool' para no retener conexiones inactivas en contenedores
#   efímeros y evitar saturar el límite de conexiones de PostgreSQL en Supabase.
# - En Servidor Continuo (Docker / Local): Mantenemos un pool persistente optimizado con reciclaje preventivo.
if not DATABASE_URL.startswith("sqlite"):
    if is_serverless:
        engine_kwargs["poolclass"] = NullPool
        # NullPool no requiere reciclaje programado ya que las conexiones se abren y cierran por petición
        engine_kwargs.pop("pool_recycle", None)
    else:
        # pool_size: número de conexiones permanentes que se mantienen abiertas en el pool.
        engine_kwargs["pool_size"] = int(os.getenv("DB_POOL_SIZE", "10"))
        # max_overflow: número máximo de conexiones adicionales temporales que pueden crearse
        # durante picos repentinos de tráfico concurrente.
        engine_kwargs["max_overflow"] = int(os.getenv("DB_MAX_OVERFLOW", "20"))

    # Cuando nos conectamos al Transaction/Session Pooler de Supabase, asyncpg debe
    # desactivar la caché de sentencias preparadas ('statement_cache_size: 0') para prevenir
    # colisiones cruzadas y exigir cifrado TLS/SSL estricto ('ssl: require').
    if is_supabase_pooler or is_serverless:
        engine_kwargs["connect_args"] = {"statement_cache_size": 0, "ssl": "require"}

# Creación del motor asíncrono con la configuración endurecida
engine = create_async_engine(DATABASE_URL, **engine_kwargs)

# Fábrica de sesiones asíncronas para el ciclo de vida de las peticiones.
# expire_on_commit=False evita que SQLAlchemy expire los objetos del modelo tras un commit,
# permitiendo acceder a sus atributos de forma asíncrona sin disparar consultas de recarga bloqueantes.
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


# Inyección de dependencias para FastAPI: provee una sesión de base de datos aislada
# por cada petición HTTP y garantiza su cierre ordenado al finalizar.
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
