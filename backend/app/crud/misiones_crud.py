from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from sqlalchemy.sql.expression import func

from app.core.exceptions import (
    ConflictError,
    EntityNotFoundError,
)
from app.models.juegos import RegistroRuleta
from app.models.misiones import Mision, MisionRuletaAceptada, PruebaMision, VotoMision
from app.schemas.misiones_schemas import CompleteMissionRequest, SuggestMissionRequest

# ==============================================================================
# Operaciones CRUD para el Sistema de Misiones y Ruleta (QuestFest)
# ==============================================================================
# Este módulo implementa la lógica de negocio de retos y gamificación:
# 1. 'suggest_mission': Propuesta ciudadana de misiones para evaluación comunitaria.
# 2. 'get_active_missions_with_status': Consulta unificada del tablón de misiones activas,
#    incluyendo misiones ganadas en la ruleta diaria y el estado de completitud del jugador.
# 3. 'vote_mission': Votación toggle (upvote/downvote) para priorizar sugerencias.
# 4. 'submit_mission_proof': Envío de evidencia fotográfica o descriptiva para arbitraje.
# 5. 'spin_roulette': Selección estocástica en servidor con quemado atómico del tiro diario.
# ==============================================================================


async def suggest_mission(db: AsyncSession, user_id: int, request: SuggestMissionRequest):
    """
    Registra una nueva propuesta de misión sugerida por un jugador para su comunidad.
    Nace en estado 'propuesta' para someterse al escrutinio y votación de los miembros.
    """
    grupo_id = request.group_id
    if grupo_id is None:
        from app.models.grupo import MiembroGrupo

        member_stmt = (
            select(MiembroGrupo.grupo_id).where(MiembroGrupo.usuario_id == user_id).limit(1)
        )
        res = await db.execute(member_stmt)
        grupo_id = res.scalar()

    mision = Mision(
        titulo=request.title,
        creador_id=user_id,
        descripcion=request.description,
        recompensa=request.reward,
        fase="global",
        es_ruleta=False,
        estado="propuesta",
        grupo_id=grupo_id,
    )
    db.add(mision)
    await db.commit()
    await db.refresh(mision)
    return mision


async def get_active_missions_with_status(
    db: AsyncSession, current_user_id: int, group_id: Optional[int] = None
):
    """
    Construye la vista interactiva del tablón de misiones activas para el usuario actual.

    Lógica de Agregación:
    1. Recupera las misiones oficiales activas del grupo ('es_ruleta == False').
    2. Agrega las misiones secretas de ruleta que el usuario haya ganado y aceptado hoy ('MisionRuletaAceptada').
    3. Cruza con las pruebas enviadas ('PruebaMision') para determinar si el usuario ya la completó
       ('user_has_completed'), si tiene una prueba pendiente de revisión por el admin ('user_is_pending')
       y qué otros compañeros de grupo la han superado ('completed_by').
    """
    # 1. Misiones comunes activas en la comunidad
    stmt = (
        select(Mision)
        .options(joinedload(Mision.creador))
        .filter(Mision.estado == "activa", Mision.es_ruleta.is_(False))
    )
    if group_id is not None:
        stmt = stmt.filter(Mision.grupo_id == group_id)
    stmt = stmt.order_by(Mision.fecha_creacion.desc())

    result = await db.execute(stmt)
    misiones = list(result.scalars().all())

    # 2. Misiones de Ruleta aceptadas por el usuario durante el día de hoy (UTC)
    today = datetime.now(timezone.utc).date()
    stmt_ruleta = (
        select(Mision, MisionRuletaAceptada.fecha)
        .options(joinedload(Mision.creador))
        .join(MisionRuletaAceptada, Mision.id == MisionRuletaAceptada.mision_id)
        .filter(MisionRuletaAceptada.usuario_id == current_user_id)
        .filter(func.date(MisionRuletaAceptada.fecha) == today)
    )
    if group_id is not None:
        stmt_ruleta = stmt_ruleta.filter(Mision.grupo_id == group_id)
    result_ruleta = await db.execute(stmt_ruleta)

    # Mapa de fechas personalizadas para no mutar el modelo ORM directamente
    fechas_personalizadas = {}
    for row in result_ruleta.all():
        m_obj = row.Mision
        fechas_personalizadas[m_obj.id] = row.fecha
        misiones.append(m_obj)

    mision_ids = [m.id for m in misiones]

    if not mision_ids:
        return []

    # 3. Carga por lotes de pruebas presentadas para estas misiones (evita consultas N+1)
    pruebas_result = await db.execute(
        select(PruebaMision)
        .options(joinedload(PruebaMision.usuario))
        .filter(PruebaMision.mision_id.in_(mision_ids))
    )
    pruebas = pruebas_result.scalars().all()

    response_list = []
    for m in misiones:
        m_pruebas = [p for p in pruebas if p.mision_id == m.id]
        completed_by = [p.usuario.username for p in m_pruebas if p.estado == "approved"]
        user_has_completed = any(
            p.usuario_id == current_user_id and p.estado == "approved" for p in m_pruebas
        )
        user_is_pending = any(
            p.usuario_id == current_user_id and p.estado == "pending" for p in m_pruebas
        )

        fecha_mostrar = fechas_personalizadas.get(m.id, m.fecha_creacion)

        response_list.append(
            {
                "id": str(m.id),
                "title": m.titulo,
                "description": m.descripcion,
                "reward": m.recompensa,
                "group_id": m.grupo_id,
                "max_completions": m.cupo_maximo,
                "completed_by": completed_by,
                "user_has_completed": user_has_completed,
                "user_is_pending": user_is_pending,
                "phase": m.fase,
                "is_roulette": m.es_ruleta,
                "author": m.creador.username if getattr(m, "creador", None) else "Sistema",
                "createdAt": fecha_mostrar.isoformat() if fecha_mostrar else None,
            }
        )
    return response_list


async def get_closed_missions_with_status(
    db: AsyncSession, current_user_id: int, group_id: Optional[int] = None
):
    """
    Devuelve las misiones cerradas asociadas opcionalmente al grupo especificado.
    """
    stmt = select(Mision).filter(Mision.estado == "cerrada")
    if group_id is not None:
        stmt = stmt.filter(Mision.grupo_id == group_id)
    stmt = stmt.order_by(Mision.fecha_creacion.desc())
    result = await db.execute(stmt)
    misiones = result.scalars().all()

    mision_ids = [m.id for m in misiones]

    if not mision_ids:
        return []

    pruebas_result = await db.execute(
        select(PruebaMision)
        .options(joinedload(PruebaMision.usuario))
        .filter(PruebaMision.mision_id.in_(mision_ids))
    )
    pruebas = pruebas_result.scalars().all()

    response_list = []
    for m in misiones:
        m_pruebas = [p for p in pruebas if p.mision_id == m.id]
        completed_by = [
            {
                "username": p.usuario.username,
                "proof_text": p.prueba_texto,
                "proof_image_url": p.prueba_imagen_url,
            }
            for p in m_pruebas
            if p.estado == "approved"
        ]
        user_completed = any(
            p.usuario_id == current_user_id and p.estado == "approved" for p in m_pruebas
        )

        response_list.append(
            {
                "id": str(m.id),
                "title": m.titulo,
                "description": m.descripcion,
                "reward": m.recompensa,
                "group_id": m.grupo_id,
                "completed_by": completed_by,
                "user_completed": user_completed,
                "phase": m.fase,
                "is_roulette": m.es_ruleta,
                "author": str(m.creador_id),
                "createdAt": m.fecha_creacion.isoformat() if m.fecha_creacion else None,
            }
        )
    return response_list


async def get_suggested_missions_with_votes(
    db: AsyncSession, current_user_id: int, group_id: Optional[int] = None
):
    """
    Devuelve las propuestas de misión para votación popular, filtradas por grupo.
    """
    stmt = select(Mision).options(joinedload(Mision.creador)).filter(Mision.estado == "propuesta")
    if group_id is not None:
        stmt = stmt.filter(Mision.grupo_id == group_id)
    stmt = stmt.order_by(Mision.fecha_creacion.desc())
    result = await db.execute(stmt)
    misiones = result.scalars().all()

    mision_ids = [m.id for m in misiones]

    if not mision_ids:
        return []

    votos_result = await db.execute(select(VotoMision).filter(VotoMision.mision_id.in_(mision_ids)))
    votos = votos_result.scalars().all()

    response_list = []
    for m in misiones:
        m_votos = [v for v in votos if v.mision_id == m.id]
        upvotes = sum(1 for v in m_votos if v.tipo_voto == "up")
        downvotes = sum(1 for v in m_votos if v.tipo_voto == "down")

        user_vote = next((v.tipo_voto for v in m_votos if v.usuario_id == current_user_id), None)

        response_list.append(
            {
                "id": str(m.id),
                "title": m.titulo,
                "description": m.descripcion,
                "reward": m.recompensa,
                "group_id": m.grupo_id,
                "author": m.creador.username if m.creador else str(m.creador_id),
                "upvotes": upvotes,
                "downvotes": downvotes,
                "user_vote": user_vote,
                "createdAt": m.fecha_creacion.isoformat() if m.fecha_creacion else None,
            }
        )
    return response_list


async def vote_mission(db: AsyncSession, mission_id: int, user_id: int, vote_type: str):
    # Validar que la misión existe y es propuesta
    result = await db.execute(
        select(Mision).filter(Mision.id == mission_id, Mision.estado == "propuesta")
    )
    mision = result.scalars().first()
    if not mision:
        raise EntityNotFoundError("Misión sugerida no encontrada")

    # Buscar si ya votó
    result_voto = await db.execute(
        select(VotoMision).filter(
            VotoMision.mision_id == mission_id, VotoMision.usuario_id == user_id
        )
    )
    voto = result_voto.scalars().first()

    if voto:
        if voto.tipo_voto == vote_type:
            # Si vota lo mismo, quitamos el voto
            await db.delete(voto)
        else:
            voto.tipo_voto = vote_type
    else:
        nuevo_voto = VotoMision(mision_id=mission_id, usuario_id=user_id, tipo_voto=vote_type)
        db.add(nuevo_voto)

    await db.commit()
    return {"message": "Voto registrado"}


async def submit_mission_proof(
    db: AsyncSession, mission_id: int, user_id: int, request: CompleteMissionRequest
):
    # Validar que la misión existe
    result = await db.execute(select(Mision).filter(Mision.id == mission_id))
    mision = result.scalars().first()

    if not mision:
        raise EntityNotFoundError("Misión no encontrada")

    # Bloqueo de Múltiples Envíos
    existing_proof_result = await db.execute(
        select(PruebaMision).filter(
            PruebaMision.mision_id == mission_id,
            PruebaMision.usuario_id == user_id,
            PruebaMision.estado.in_(["pending", "approved"]),
        )
    )
    if existing_proof_result.scalars().first():
        raise ConflictError("Ya tienes una prueba pendiente o aprobada para esta misión.")

    # Crear prueba (requerirá validación del Admin)
    # Parseamos la URL asegurándonos que se guarda como string si existe
    img_url = str(request.proof_image_url) if request.proof_image_url else None
    clean_text = request.proof_text.strip() if request.proof_text else None

    prueba = PruebaMision(
        mision_id=mission_id,
        usuario_id=user_id,
        prueba_texto=clean_text,
        prueba_imagen_url=img_url,
        estado="pending",
    )
    db.add(prueba)
    await db.commit()
    await db.refresh(prueba)
    return prueba


async def spin_roulette(db: AsyncSession, user_id: int):
    today = datetime.now(timezone.utc).date()

    # 1. Comprobar si ya ha tirado hoy
    stmt_check = select(RegistroRuleta).filter(
        RegistroRuleta.usuario_id == user_id, RegistroRuleta.fecha == today
    )
    result_check = await db.execute(stmt_check)
    if result_check.scalars().first():
        raise ConflictError("Ya has tirado de la ruleta de misiones hoy. ¡Vuelve mañana!")

    # 2. Seleccionar misión aleatoria de la ruleta
    stmt_mission = (
        select(Mision).filter(Mision.es_ruleta.is_(True)).order_by(func.random()).limit(1)
    )
    result_mission = await db.execute(stmt_mission)
    random_mission = result_mission.scalars().first()

    if not random_mission:
        raise EntityNotFoundError(
            "La ruleta está vacía actualmente. El Administrador debe añadir misiones."
        )

    # 3. Registrar el tiro en la BD de forma segura
    registro = RegistroRuleta(usuario_id=user_id, fecha=today)
    db.add(registro)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Error de integridad: Ya has tirado hoy.")

    return random_mission
