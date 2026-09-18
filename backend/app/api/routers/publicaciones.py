"""
================================================================================
ROUTER DEL MURO DE COTILLEOS Y EVENTOS SSE: QuestFest
================================================================================
Este enrutador proporciona el feed social interactivo de la fiesta ("Muro de Cotilleos")
y el canal de Server-Sent Events (SSE) para actualizaciones en vivo.

Decisiones de arquitectura:
1. SSE en vez de WebSockets: Para la naturaleza del muro (emisión unidireccional de novedades
   y notificaciones desde el servidor hacia los clientes móviles), SSE sobre HTTP estándar
   es mucho más liviano, atraviesa cortafuegos corporativos sin problemas y cuenta con
   reconexión nativa en navegadores (`EventSource`).
2. Paginación por Cursor (`cursor_id`): A diferencia del tradicional `OFFSET`, el cursor
   previene la duplicación u omisión de publicaciones cuando se insertan nuevos posts
   mientras el usuario hace scroll hacia abajo.
3. Herencia de Grupo en Respuestas: Cualquier hilo de respuestas hereda estrictamente
   el `grupo_id` de la publicación raíz.
4. Heartbeat de Mantención (Ping): Cada 20 segundos de inactividad se emite un ping SSE
   para evitar que proxies intermedios (como Nginx o balanceadores) cierren el socket por timeout.
================================================================================
"""

import asyncio
import json
from fastapi import APIRouter, Depends, Query, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.usuario import Usuario
from app.crud import publicaciones_crud
from app.schemas.social_schemas import PostCreateRequest, PostResponse
from app.core.events import broadcaster

router = APIRouter()

@router.post("/", status_code=status.HTTP_201_CREATED)
async def publish_post(
    request: PostCreateRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Publica un nuevo mensaje en el muro social del grupo (o global) y emite
    un evento SSE a los clientes conectados con la etiqueta de grupo correspondiente.
    """
    post = await publicaciones_crud.create_post(
        db=db, 
        user_id=current_user.id, 
        content=request.content,
        media_url=request.media_url,
        group_id=request.group_id
    )

    # Emitir evento SSE en tiempo real con el identificador del grupo
    event_payload = {
        "id": post.id,
        "type": post.tipo,
        "author": current_user.username,
        "author_avatar_url": current_user.avatar_url,
        "time_ago": post.fecha_creacion.isoformat(),
        "content": post.contenido,
        "media_url": post.media_url,
        "is_system": False,
        "group_id": post.grupo_id,
        "replies": []
    }
    await broadcaster.broadcast("new_post", event_payload)

    return {"message": "Publicación creada con éxito", "post_id": post.id}

@router.post("/{post_id}/reply", status_code=status.HTTP_201_CREATED)
async def reply_post(
    post_id: int,
    request: PostCreateRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Añade una respuesta a un post existente en el muro social.
    Hereda de forma automática el grupo al que pertenece el post principal.
    """
    reply = await publicaciones_crud.reply_post(
        db=db,
        post_id=post_id,
        user_id=current_user.id,
        content=request.content
    )
    
    event_payload = {
        "parent_id": post_id,
        "reply": {
            "id": reply.id,
            "type": reply.tipo,
            "author": current_user.username,
            "author_avatar_url": current_user.avatar_url,
            "time_ago": reply.fecha_creacion.isoformat(),
            "content": reply.contenido,
            "media_url": reply.media_url,
            "is_system": False,
            "group_id": reply.grupo_id,
            "replies": []
        }
    }
    await broadcaster.broadcast("new_reply", event_payload)

    return {"message": "Respuesta creada con éxito", "reply_id": reply.id}

@router.get("/stream")
async def stream_feed_events(request: Request, group_id: Optional[int] = Query(None, description="ID del grupo a suscribir")):
    """
    Canal de Server-Sent Events (SSE) para transmitir publicaciones y notificaciones en vivo.
    Permite a cada cliente recibir únicamente los eventos que pertenezcan a su grupo activo o globales.
    
    Ciclo de vida de la conexión:
    1. Suscribe una cola en memoria al bus Pub/Sub del `broadcaster`.
    2. Envía un evento 'connected' de confirmación de handshake.
    3. Monitorea desconexiones del cliente (`request.is_disconnected()`).
    4. Espera eventos con timeout de 20s; si vence, emite un ping de mantenimiento (keep-alive).
    5. Al desconectarse, desuscribe la cola de forma limpia en el bloque `finally`.
    """
    async def event_generator():
        queue = await broadcaster.subscribe()
        try:
            # Enviar mensaje de ping inicial de confirmación de handshake SSE
            yield "data: {\"type\": \"connected\"}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    raw_msg = await asyncio.wait_for(queue.get(), timeout=20.0)
                    # Si se especificó un grupo en la conexión SSE, filtramos eventos ajenos
                    if group_id is not None:
                        try:
                            parsed = json.loads(raw_msg)
                            payload_data = parsed.get("payload", {})
                            msg_group = payload_data.get("group_id") if isinstance(payload_data, dict) else None
                            if msg_group is None:
                                msg_group = parsed.get("group_id")
                            # Si el evento pertenece explícitamente a otro grupo, lo descartamos
                            if msg_group is not None and msg_group != group_id:
                                continue
                        except Exception:
                            pass
                    yield f"data: {raw_msg}\n\n"
                except asyncio.TimeoutError:
                    # Enviar ping periódico para mantener viva la conexión HTTP en proxies intermedios
                    yield "data: {\"type\": \"ping\"}\n\n"
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/latest-id", response_model=int)
async def read_latest_id(
    group_id: Optional[int] = Query(None, description="ID del grupo para consultar el último ID"),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Devuelve el identificador de la última publicación del feed para el grupo solicitado.
    Permite al frontend verificar si hay nuevos contenidos sin descargar el listado completo.
    """
    latest_id = await publicaciones_crud.get_latest_post_id(db, group_id=group_id)
    return latest_id

@router.get("/", response_model=List[PostResponse])
async def read_feed(
    limit: int = Query(15, ge=1, le=100, description="Límite de publicaciones por página"),
    offset: int = Query(0, ge=0, description="Publicaciones a saltar"),
    cursor_id: Optional[int] = Query(None, description="ID del cursor para paginacion eficiente"),
    group_id: Optional[int] = Query(None, description="ID del grupo para filtrar publicaciones del feed"),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Recupera el Muro de Cotilleos del grupo solicitado en orden cronológico inverso.
    Soporta paginación por cursor (`cursor_id`) para evitar desajustes por nuevos posts concurrentes.
    """
    posts = await publicaciones_crud.get_feed(db, limit, offset, cursor_id, group_id=group_id)
    response = []
    
    for p in posts:
        author_name = p.autor.username if p.autor else "Sistema QuestFest"
        author_avatar = p.autor.avatar_url if p.autor else None
        
        replies = []
        for r in p.respuestas:
            r_author_name = r.autor.username if r.autor else "Sistema QuestFest"
            r_author_avatar = r.autor.avatar_url if r.autor else None
            replies.append({
                "id": r.id,
                "type": r.tipo,
                "author": r_author_name,
                "author_avatar_url": r_author_avatar,
                "time_ago": r.fecha_creacion.isoformat(),
                "content": r.contenido,
                "media_url": r.media_url,
                "is_system": r.es_sistema,
                "group_id": r.grupo_id,
                "replies": []
            })
        
        response.append({
            "id": p.id,
            "type": p.tipo,
            "author": author_name,
            "author_avatar_url": author_avatar,
            "time_ago": p.fecha_creacion.isoformat(),
            "content": p.contenido,
            "media_url": p.media_url,
            "is_system": p.es_sistema,
            "group_id": p.grupo_id,
            "replies": replies
        })
        
    return response
