from typing import Optional

from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload

from app.models.publicaciones import Publicacion

# ==============================================================================
# Operaciones CRUD para el Muro Social y Feed de Actividad (QuestFest)
# ==============================================================================
# Este módulo articula el timeline de la comunidad:
# 1. 'create_post': Publicación manual de mensajes multimedia por parte de los jugadores.
# 2. 'create_system_post': Anuncios automáticos generados por el motor del juego.
# 3. 'get_feed': Paginación por cursor descendente con precarga de autores y respuestas.
# 4. 'reply_post': Respuestas anidadas con herencia automática de la comunidad de origen.
# ==============================================================================


async def create_post(
    db: AsyncSession,
    user_id: int,
    content: str,
    media_url: str = None,
    group_id: Optional[int] = None,
):
    """
    Crea un nuevo post social redactado por un jugador.
    Si se suministra 'group_id', el mensaje queda confinado exclusivamente al muro de dicho grupo.
    """
    post = Publicacion(
        tipo="social",
        autor_id=user_id,
        contenido=content,
        media_url=media_url,
        es_sistema=False,
        grupo_id=group_id,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


async def create_system_post(
    db: AsyncSession, tipo: str, content: str, group_id: Optional[int] = None
):
    """
    Función de utilidad para el sistema. Emite anuncios de juego automáticos
    (ej. victoria en duelo, apertura de apuestas o felicitaciones por completar una misión).
    El 'autor_id' queda en NULL y 'es_sistema = True'.
    """
    post = Publicacion(
        tipo=tipo,
        autor_id=None,
        contenido=content,
        media_url=None,
        es_sistema=True,
        grupo_id=group_id,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


async def get_feed(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
    cursor_id: Optional[int] = None,
    group_id: Optional[int] = None,
):
    """
    Recupera el feed de publicaciones principales con soporte de paginación por cursor.

    ¿Por qué Paginación por Cursor ('cursor_id') en vez de 'offset'?
    En muros sociales en tiempo real donde los usuarios publican continuamente, la paginación tradicional
    por offset sufre el problema de 'desplazamiento de elementos' (drift): si entra un nuevo post mientras
    el usuario hace scroll, la página 2 mostrará duplicado el último elemento de la página 1.
    Filtrar por 'Publicacion.id < cursor_id' garantiza páginas estables y consultas ultrarrápidas mediante índices.

    ¿Por qué 'unique()'?
    Al utilizar 'joinedload' sobre la colección 'respuestas', SQLAlchemy puede recibir múltiples filas
    de la base de datos para un mismo post. 'result.unique()' deduplica las instancias del modelo en memoria.
    """
    query = (
        select(Publicacion)
        .options(
            joinedload(Publicacion.autor),
            joinedload(Publicacion.respuestas).joinedload(Publicacion.autor),
        )
        .filter(Publicacion.parent_id.is_(None))  # Solo publicaciones raíz (no respuestas sueltas)
    )

    if group_id is not None:
        query = query.filter(Publicacion.grupo_id == group_id)

    if cursor_id is not None and cursor_id > 0:
        query = query.filter(Publicacion.id < cursor_id)

    query = query.order_by(desc(Publicacion.id)).limit(limit)

    if cursor_id is None and offset > 0:
        query = query.offset(offset)

    result = await db.execute(query)
    return result.unique().scalars().all()


async def get_latest_post_id(db: AsyncSession, group_id: Optional[int] = None) -> int:
    """
    Devuelve el identificador de la última publicación para sondeo o inicialización,
    filtrando opcionalmente por el grupo activo.
    """
    stmt = select(Publicacion.id)
    if group_id is not None:
        stmt = stmt.filter(Publicacion.grupo_id == group_id)
    stmt = stmt.order_by(desc(Publicacion.id)).limit(1)
    result = await db.execute(stmt)
    latest_id = result.scalar()
    return latest_id or 0


async def reply_post(db: AsyncSession, post_id: int, user_id: int, content: str):
    """
    Crea una respuesta a un post existente, heredando automáticamente el grupo del post principal.
    """
    parent_res = await db.execute(select(Publicacion).filter(Publicacion.id == post_id))
    parent_post = parent_res.scalars().first()
    target_group_id = parent_post.grupo_id if parent_post else None

    reply = Publicacion(
        tipo="social",
        autor_id=user_id,
        contenido=content,
        media_url=None,
        es_sistema=False,
        parent_id=post_id,
        grupo_id=target_group_id,
    )
    db.add(reply)
    await db.commit()
    await db.refresh(reply)
    return reply
