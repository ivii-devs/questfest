"""
================================================================================
SERVICIO DEL TRIBUNAL DE MISIONES Y PRUEBAS: QuestFest
================================================================================
Este servicio gestiona el flujo de curación comunitaria y arbitraje de retos:
1. Evaluación de sugerencias de misiones propuestas por los jugadores.
2. Aprobación y publicación oficial con asignación de recompensa o rechazo/purga.
3. Validación de evidencias multimedia (pruebas fotográficas y de texto) con abono
   atómico de QuestCoins en el Ledger de la comunidad correspondiente.
4. Notificaciones automáticas de resolución a los jugadores implicados.
================================================================================
"""

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.exceptions import EntityNotFoundError
from app.crud.ledger_crud import move_tokens
from app.dependencies import verify_group_admin
from app.models.grupo import MiembroGrupo
from app.models.misiones import Mision, PruebaMision, VotoMision
from app.models.notificaciones import NotificacionAdmin
from app.models.usuario import Usuario
from app.schemas.admin_schemas import AdminAprobarSugerencia, AdminRechazarPrueba


async def get_admin_sugerencias(
    db: AsyncSession,
    current_user: Usuario,
    group_id: Optional[int] = None,
) -> List[dict]:
    """
    Obtiene el listado de misiones sugeridas por la comunidad pendientes de evaluación.
    Calcula los upvotes y downvotes agregados por los jugadores en la fase previa.
    Aísla las consultas por jurisdicción territorial (group_id).
    """
    stmt = select(Mision).options(joinedload(Mision.creador)).filter(Mision.estado == "propuesta")
    if group_id is not None:
        await verify_group_admin(db, current_user, group_id)
        stmt = stmt.filter(Mision.grupo_id == group_id)
    elif current_user.rol != "admin":
        admin_groups_subq = select(MiembroGrupo.grupo_id).where(
            MiembroGrupo.usuario_id == current_user.id,
            MiembroGrupo.rol == "admin",
        )
        stmt = stmt.filter(Mision.grupo_id.in_(admin_groups_subq))
    stmt = stmt.order_by(Mision.fecha_creacion.desc())
    result = await db.execute(stmt)
    misiones = result.scalars().all()

    mision_ids = [m.id for m in misiones]
    votos = []
    if mision_ids:
        votos_result = await db.execute(
            select(VotoMision).filter(VotoMision.mision_id.in_(mision_ids))
        )
        votos = votos_result.scalars().all()

    response_list = []
    for mision in misiones:
        m_votos = [v for v in votos if v.mision_id == mision.id]
        upvotes = sum(1 for v in m_votos if v.tipo_voto == "up")
        downvotes = sum(1 for v in m_votos if v.tipo_voto == "down")

        response_list.append(
            {
                "id": str(mision.id),
                "title": mision.titulo,
                "description": mision.descripcion,
                "reward": mision.recompensa,
                "author": mision.creador.username if mision.creador else str(mision.creador_id),
                "upvotes": upvotes,
                "downvotes": downvotes,
                "createdAt": mision.fecha_creacion.isoformat() if mision.fecha_creacion else None,
            }
        )
    return response_list


async def aprobar_sugerencia(
    db: AsyncSession,
    mision_id: int,
    data: AdminAprobarSugerencia,
    current_user: Usuario,
) -> dict:
    """
    Aprueba una sugerencia de misión comunitaria, fija la recompensa final dictada
    por el tribunal y la promociona a estado 'activa', notificando formalmente al creador.
    """
    result = await db.execute(
        select(Mision)
        .options(selectinload(Mision.creador))
        .filter(Mision.id == mision_id, Mision.estado == "propuesta")
    )
    mision = result.scalars().first()
    if not mision:
        raise EntityNotFoundError("Sugerencia no encontrada")

    await verify_group_admin(db, current_user, mision.grupo_id)

    mision.estado = "activa"
    mision.recompensa = data.recompensa

    notif = NotificacionAdmin(
        titulo="¡Sugerencia Aprobada!",
        mensaje=(
            f"Tu sugerencia '{mision.titulo}' ha sido aprobada por el Tribunal y ya está "
            "disponible para que todos la jueguen. ¡Gracias por tu aportación!"
        ),
        destinatario_tipo="specific",
        destinatario_id=mision.creador_id,
        estado="sent",
    )
    db.add(notif)

    await db.commit()
    return {"message": "Sugerencia aprobada y publicada"}


async def rechazar_sugerencia(
    db: AsyncSession,
    mision_id: int,
    current_user: Usuario,
) -> dict:
    """Descarta y elimina definitivamente una propuesta de misión no adecuada."""
    result = await db.execute(
        select(Mision).filter(Mision.id == mision_id, Mision.estado == "propuesta")
    )
    mision = result.scalars().first()
    if not mision:
        raise EntityNotFoundError("Sugerencia no encontrada")

    await verify_group_admin(db, current_user, mision.grupo_id)

    await db.delete(mision)
    await db.commit()
    return {"message": "Sugerencia eliminada"}


async def get_admin_pruebas(
    db: AsyncSession,
    current_user: Usuario,
    group_id: Optional[int] = None,
) -> List[dict]:
    """
    Obtiene las pruebas gráficas o escritas aportadas por los jugadores
    pendientes de homologación ('pending'), aisladas por grupo.
    """
    stmt = (
        select(PruebaMision)
        .options(selectinload(PruebaMision.usuario), selectinload(PruebaMision.mision))
        .filter(PruebaMision.estado == "pending")
    )
    if group_id is not None:
        await verify_group_admin(db, current_user, group_id)
        stmt = stmt.join(PruebaMision.mision).filter(Mision.grupo_id == group_id)
    elif current_user.rol != "admin":
        admin_groups_subq = select(MiembroGrupo.grupo_id).where(
            MiembroGrupo.usuario_id == current_user.id,
            MiembroGrupo.rol == "admin",
        )
        stmt = stmt.join(PruebaMision.mision).filter(Mision.grupo_id.in_(admin_groups_subq))
    stmt = stmt.order_by(PruebaMision.fecha_creacion.desc())
    result = await db.execute(stmt)
    pruebas = result.scalars().all()

    return [
        {
            "id": p.id,
            "mision_id": p.mision.id,
            "mision_title": p.mision.titulo,
            "mision_reward": p.mision.recompensa,
            "usuario": p.usuario.username,
            "usuario_avatar": p.usuario.avatar_url,
            "proof_text": p.prueba_texto,
            "proof_image_url": p.prueba_imagen_url,
            "createdAt": p.fecha_creacion.isoformat() if p.fecha_creacion else None,
        }
        for p in pruebas
    ]


async def validar_prueba(
    db: AsyncSession,
    prueba_id: int,
    current_user: Usuario,
) -> dict:
    """
    Homologa y aprueba la prueba de una misión presentada por un jugador,
    acreditando la recompensa en QuestCoins en el Ledger de la comunidad correspondiente
    mediante el motor contable atómico `move_tokens`.
    """
    result = await db.execute(
        select(PruebaMision)
        .options(selectinload(PruebaMision.usuario), selectinload(PruebaMision.mision))
        .filter(PruebaMision.id == prueba_id, PruebaMision.estado == "pending")
    )
    prueba = result.scalars().first()
    if not prueba:
        raise EntityNotFoundError("Prueba no encontrada o ya procesada")

    await verify_group_admin(db, current_user, prueba.mision.grupo_id)

    prueba.estado = "approved"
    usuario = prueba.usuario
    mision = prueba.mision

    # Determinar el grupo receptor para el abono en el Ledger
    target_group_id = mision.grupo_id
    if target_group_id is None:
        member_stmt = (
            select(MiembroGrupo.grupo_id).where(MiembroGrupo.usuario_id == usuario.id).limit(1)
        )
        res = await db.execute(member_stmt)
        target_group_id = res.scalar()

    await move_tokens(
        db=db,
        user_id=usuario.id,
        amount=mision.recompensa,
        concept=f"Misión completada: {mision.titulo}",
        group_id=target_group_id,
        auto_commit=False,
    )

    notif = NotificacionAdmin(
        titulo="✅ Misión Validada",
        mensaje=(
            f"El Tribunal ha validado tu prueba para '{mision.titulo}'. "
            f"Se han añadido 💰 {mision.recompensa} a tu cuenta."
        ),
        destinatario_tipo="specific",
        destinatario_id=usuario.id,
        estado="sent",
    )
    db.add(notif)

    await db.commit()
    return {"message": "Prueba validada correctamente"}


async def rechazar_prueba(
    db: AsyncSession,
    prueba_id: int,
    data: AdminRechazarPrueba,
    current_user: Usuario,
) -> dict:
    """
    Rechaza una prueba aportada por un jugador con explicación pedagógica razonada
    y emite la cédula de notificación correspondiente.
    """
    result = await db.execute(
        select(PruebaMision)
        .options(selectinload(PruebaMision.usuario), selectinload(PruebaMision.mision))
        .filter(PruebaMision.id == prueba_id, PruebaMision.estado == "pending")
    )
    prueba = result.scalars().first()
    if not prueba:
        raise EntityNotFoundError("Prueba no encontrada o ya procesada")

    await verify_group_admin(db, current_user, prueba.mision.grupo_id)

    prueba.estado = "rejected"

    notif = NotificacionAdmin(
        titulo="❌ Prueba Rechazada",
        mensaje=(
            f"El Tribunal ha rechazado tu prueba para '{prueba.mision.titulo}'. "
            f"Motivo: {data.motivo}"
        ),
        destinatario_tipo="specific",
        destinatario_id=prueba.usuario.id,
        estado="sent",
    )
    db.add(notif)

    await db.commit()
    return {"message": "Prueba rechazada"}
