"""
================================================================================
ROUTER DE PERFILES PÚBLICOS DE JUGADORES: QuestFest
================================================================================
Este enrutador expone la información pública de cualquier jugador:
- Perfil general con biografía, avatar y métricas de juego (apuestas, misiones, duelos).
- Feed de publicaciones creadas por el usuario.
- Historial público de apuestas resueltas.
- Misiones completadas y aprobadas.
- Historial de duelos PvP disputados con sus rivales.
================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import List

from app.core.database import get_db
from app.models.usuario import Usuario
from app.models.publicaciones import Publicacion
from app.models.juegos import TicketApuesta, Apuesta, Duelo
from app.models.misiones import PruebaMision, Mision
from app.schemas.social_schemas import PostResponse
from app.schemas.user_schemas import (
    PublicProfileResponse,
    PublicApuestaResponse,
    PublicMisionResponse,
    PublicDueloResponse
)

router = APIRouter()

@router.get("/public/{username}", response_model=PublicProfileResponse)
async def get_public_profile(username: str, db: AsyncSession = Depends(get_db)):
    """
    Obtiene la ficha pública de un jugador mediante su nombre de usuario.
    Calcula dinámicamente sus aciertos en apuestas, misiones validadas y victorias en duelos.
    """
    user_query = select(Usuario).where(Usuario.username == username)
    result = await db.execute(user_query)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    subq_apuestas = (
        select(func.count(TicketApuesta.id))
        .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
        .where(
            and_(
                TicketApuesta.usuario_id == user.id,
                Apuesta.estado == 'cerrada',
                TicketApuesta.opcion_id == Apuesta.opcion_ganadora_id
            )
        )
        .scalar_subquery()
    )

    subq_misiones = (
        select(func.count(PruebaMision.id))
        .where(
            and_(
                PruebaMision.usuario_id == user.id,
                PruebaMision.estado == 'approved'
            )
        )
        .scalar_subquery()
    )

    subq_duelos = (
        select(func.count(Duelo.id))
        .where(
            and_(
                Duelo.ganador_id == user.id,
                Duelo.estado == 'completed'
            )
        )
        .scalar_subquery()
    )

    stats_query = select(
        subq_apuestas.label('apuestas_acertadas'),
        subq_misiones.label('misiones_completadas'),
        subq_duelos.label('duelos_ganados')
    )
    
    stats_result = await db.execute(stats_query)
    stats_row = stats_result.one()

    return PublicProfileResponse(
        username=user.username,
        avatar_url=user.avatar_url,
        bio=user.bio,
        saldo_actual=user.saldo_actual,
        apuestas_acertadas=stats_row.apuestas_acertadas or 0,
        misiones_completadas=stats_row.misiones_completadas or 0,
        duelos_ganados=stats_row.duelos_ganados or 0
    )

@router.get("/public/{username}/feed", response_model=List[PostResponse])
async def get_public_feed(username: str, db: AsyncSession = Depends(get_db)):
    user_query = select(Usuario).where(Usuario.username == username)
    result = await db.execute(user_query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    query = (
        select(Publicacion)
        .where(Publicacion.autor_id == user.id, Publicacion.parent_id == None)
        .order_by(Publicacion.fecha_creacion.desc())
    )
    feed_result = await db.execute(query)
    posts = feed_result.scalars().all()
    
    response = []
    for post in posts:
        response.append(PostResponse(
            id=post.id,
            type=post.tipo,
            author=user.username,
            author_avatar_url=user.avatar_url,
            time_ago=post.fecha_creacion.isoformat(),
            content=post.contenido,
            media_url=post.media_url,
            is_system=post.es_sistema,
            replies=[]
        ))
    return response

@router.get("/public/{username}/apuestas", response_model=List[PublicApuestaResponse])
async def get_public_apuestas(username: str, db: AsyncSession = Depends(get_db)):
    user_query = select(Usuario).where(Usuario.username == username)
    result = await db.execute(user_query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    query = (
        select(TicketApuesta, Apuesta)
        .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
        .where(
            and_(
                TicketApuesta.usuario_id == user.id,
                Apuesta.estado == 'cerrada'
            )
        )
        .order_by(TicketApuesta.fecha.desc())
    )
    apuestas_result = await db.execute(query)
    rows = apuestas_result.all()
    
    response = []
    for ticket, apuesta in rows:
        resultado = "Ganada" if ticket.opcion_id == apuesta.opcion_ganadora_id else "Perdida"
        response.append(PublicApuestaResponse(
            id=ticket.id,
            titulo=apuesta.titulo,
            cantidad=ticket.cantidad,
            resultado=resultado,
            fecha=ticket.fecha.isoformat()
        ))
    return response

@router.get("/public/{username}/misiones", response_model=List[PublicMisionResponse])
async def get_public_misiones(username: str, db: AsyncSession = Depends(get_db)):
    user_query = select(Usuario).where(Usuario.username == username)
    result = await db.execute(user_query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    query = (
        select(PruebaMision, Mision)
        .join(Mision, Mision.id == PruebaMision.mision_id)
        .where(
            and_(
                PruebaMision.usuario_id == user.id,
                PruebaMision.estado == 'approved'
            )
        )
        .order_by(PruebaMision.fecha_creacion.desc())
    )
    misiones_result = await db.execute(query)
    rows = misiones_result.all()
    
    response = []
    for prueba, mision in rows:
        response.append(PublicMisionResponse(
            id=prueba.id,
            titulo=mision.titulo,
            recompensa=mision.recompensa,
            fecha_completada=prueba.fecha_creacion.isoformat()
        ))
    return response

@router.get("/public/{username}/duelos", response_model=List[PublicDueloResponse])
async def get_public_duelos(username: str, db: AsyncSession = Depends(get_db)):
    user_query = select(Usuario).where(Usuario.username == username)
    result = await db.execute(user_query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    query = (
        select(Duelo)
        .options(
            selectinload(Duelo.retador),
            selectinload(Duelo.retado)
        )
        .where(
            or_(
                Duelo.retador_id == user.id,
                Duelo.retado_id == user.id
            )
        )
        .order_by(Duelo.fecha_creacion.desc())
    )
    duelos_result = await db.execute(query)
    duelos = duelos_result.scalars().all()
    
    response = []
    for duelo in duelos:
        ganador_username = None
        if duelo.ganador_id:
            if duelo.ganador_id == duelo.retador_id:
                ganador_username = duelo.retador.username
            elif duelo.ganador_id == duelo.retado_id:
                ganador_username = duelo.retado.username
            
        response.append(PublicDueloResponse(
            id=duelo.id,
            retador=duelo.retador.username,
            retado=duelo.retado.username,
            juego=duelo.juego,
            tokens_en_juego=duelo.tokens_en_juego,
            estado=duelo.estado,
            ganador=ganador_username,
            fecha=duelo.fecha_creacion.isoformat()
        ))
    return response
