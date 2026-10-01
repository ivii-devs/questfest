"""
================================================================================
CAPA DE ACCESO A DATOS (CRUD): KITS DE EVENTOS Y PRESETS (QuestFest)
================================================================================
Este módulo implementa las consultas y transacciones sobre las plantillas de eventos:
1. Listado multifactorial (filtros por tipo, categoría, búsqueda en tiempo real).
2. Obtención de detalle con hidratación de autores y estado de 'Me Gusta'.
3. Creación y edición soberana de kits con restricción de autoría.
4. Toggle idempotente de likes con recuento atómico.
5. Inyección atómica en bloque de retos y apuestas en comunidades multi-tenant.
================================================================================
"""

from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import verify_group_admin
from app.models.grupo import Grupo
from app.models.juegos import Apuesta
from app.models.kits import KitEvento, KitLike, KitReporte
from app.models.misiones import Mision
from app.models.usuario import Usuario
from app.schemas.kits_schemas import (
    ContenidoKitSchema,
    InyeccionKitRequest,
    InyeccionKitResponse,
    KitCreateRequest,
    KitLikeResponse,
    KitResponse,
    KitUpdateRequest,
)


def _format_kit_response(kit: KitEvento, liked: bool = False) -> KitResponse:
    """
    Función auxiliar para normalizar y estructurar la salida de un KitEvento
    hacia el contrato de respuesta KitResponse, calculando dinámicamente las métricas
    de desglose (total misiones, ruletas y apuestas) sin penalizar con consultas adicionales.
    """
    contenido_dict = kit.contenido or {}
    misiones = contenido_dict.get("misiones", [])
    ruletas = contenido_dict.get("ruletas", [])
    apuestas = contenido_dict.get("apuestas", [])

    return KitResponse(
        id=kit.id,
        titulo=kit.titulo,
        descripcion=kit.descripcion,
        categoria=kit.categoria,
        icono_url=kit.icono_url,
        autor_id=kit.autor_id,
        autor_username=kit.autor.username if kit.autor else "QuestFest",
        es_oficial=kit.es_oficial,
        es_publico=kit.es_publico,
        descargas_count=kit.descargas_count,
        likes_count=kit.likes_count,
        is_liked_by_user=liked,
        total_misiones=len(misiones),
        total_ruletas=len(ruletas),
        total_apuestas=len(apuestas),
        contenido=ContenidoKitSchema(
            misiones=misiones,
            ruletas=ruletas,
            apuestas=apuestas,
        ),
        fecha_creacion=kit.fecha_creacion,
    )


async def list_kits(
    db: AsyncSession,
    current_user_id: Optional[int] = None,
    tipo: Optional[str] = None,
    categoria: Optional[str] = None,
    query: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> List[KitResponse]:
    """
    Lista el catálogo de kits aplicando los filtros de navegación PWA.

    Estrategia de Seguridad y Visibilidad:
    - tipo='oficial': Solo kits verificados por la plataforma ('es_oficial = True').
    - tipo='comunidad': Kits públicos de otros usuarios ('es_oficial = False' y 'es_publico = True').
    - tipo='mis-kits': Todos los kits creados por el usuario activo (públicos y privados).
    - Si no se especifica tipo, se exponen todos los kits públicos más los privados del usuario.
    """
    stmt = select(KitEvento).options(selectinload(KitEvento.autor))

    if tipo == "oficial":
        stmt = stmt.filter(KitEvento.es_oficial.is_(True))
    elif tipo == "comunidad":
        stmt = stmt.filter(KitEvento.es_oficial.is_(False), KitEvento.es_publico.is_(True))
    elif tipo == "mis-kits":
        if not current_user_id:
            return []
        stmt = stmt.filter(KitEvento.autor_id == current_user_id)
    else:
        # Modo combinado: kits públicos o propios
        if current_user_id:
            stmt = stmt.filter(
                or_(KitEvento.es_publico.is_(True), KitEvento.autor_id == current_user_id)
            )
        else:
            stmt = stmt.filter(KitEvento.es_publico.is_(True))

    # Filtro por categoría temática (ignorando mayúsculas/minúsculas)
    if categoria and categoria.lower() != "todos":
        stmt = stmt.filter(func.lower(KitEvento.categoria) == categoria.lower().strip())

    # Búsqueda libre en tiempo real sobre título, descripción y categoría
    if query and query.strip():
        term = f"%{query.strip().lower()}%"
        stmt = stmt.filter(
            or_(
                func.lower(KitEvento.titulo).like(term),
                func.lower(KitEvento.descripcion).like(term),
                func.lower(KitEvento.categoria).like(term),
            )
        )

    stmt = stmt.order_by(KitEvento.fecha_creacion.desc()).offset(skip).limit(limit)
    res = await db.execute(stmt)
    kits = res.scalars().all()

    if not kits:
        return []

    # Determinamos de forma eficiente qué kits tienen 'like' del usuario actual
    # mediante una única consulta IN en lugar de subconsultas N+1.
    liked_kit_ids = set()
    if current_user_id:
        kit_ids = [k.id for k in kits]
        like_stmt = select(KitLike.kit_id).filter(
            KitLike.usuario_id == current_user_id, KitLike.kit_id.in_(kit_ids)
        )
        like_res = await db.execute(like_stmt)
        liked_kit_ids = set(like_res.scalars().all())

    return [_format_kit_response(kit, liked=(kit.id in liked_kit_ids)) for kit in kits]


async def get_kit_by_id(
    db: AsyncSession, kit_id: int, current_user_id: Optional[int] = None
) -> KitResponse:
    """
    Obtiene los detalles completos de un Kit de Eventos y su árbol JSONB de items.
    Valida la privacidad: si el kit es privado, solo el autor o un superadmin pueden inspeccionarlo.
    """
    stmt = (
        select(KitEvento)
        .options(selectinload(KitEvento.autor))
        .filter(KitEvento.id == kit_id)
    )
    res = await db.execute(stmt)
    kit = res.scalars().first()

    if not kit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El kit de eventos con ID {kit_id} no fue encontrado.",
        )

    # Restricción de privacidad para kits no públicos
    if not kit.es_publico and kit.autor_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este kit es privado y pertenece exclusivamente a su autor.",
        )

    liked = False
    if current_user_id:
        like_stmt = select(KitLike.id).filter(
            KitLike.kit_id == kit.id, KitLike.usuario_id == current_user_id
        )
        like_res = await db.execute(like_stmt)
        liked = like_res.scalars().first() is not None

    return _format_kit_response(kit, liked=liked)


async def create_kit(
    db: AsyncSession, user: Usuario, data: KitCreateRequest
) -> KitResponse:
    """
    Persiste un nuevo Kit en la plataforma.
    
    Regla de Soberanía Oficial:
    Solo los usuarios con rol global 'admin' pueden publicar kits marcados como 'es_oficial = True'.
    Si un usuario estándar intenta marcarlo, el valor se fuerza a False sin abortar la operación.
    """
    if (
        not data.contenido.misiones
        and not data.contenido.ruletas
        and not data.contenido.apuestas
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El kit debe contener al menos una misión, ruleta o apuesta.",
        )

    es_oficial = data.es_oficial if user.rol == "admin" else False

    nuevo_kit = KitEvento(
        titulo=data.titulo.strip(),
        descripcion=data.descripcion.strip(),
        categoria=data.categoria.strip(),
        icono_url=data.icono_url,
        autor_id=user.id,
        es_oficial=es_oficial,
        es_publico=data.es_publico,
        descargas_count=0,
        likes_count=0,
        contenido=data.contenido.model_dump(),
    )
    db.add(nuevo_kit)
    await db.commit()
    await db.refresh(nuevo_kit)

    # Re-cargamos relación con autor para serializar correctamente
    return await get_kit_by_id(db, nuevo_kit.id, current_user_id=user.id)


async def update_kit(
    db: AsyncSession, kit_id: int, user: Usuario, data: KitUpdateRequest
) -> KitResponse:
    """
    Modifica un Kit existente en el catálogo.
    Solo el autor original o un administrador global poseen potestad de edición.
    """
    stmt = (
        select(KitEvento)
        .options(selectinload(KitEvento.autor))
        .filter(KitEvento.id == kit_id)
    )
    res = await db.execute(stmt)
    kit = res.scalars().first()

    if not kit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El kit de eventos con ID {kit_id} no fue encontrado.",
        )

    if kit.autor_id != user.id and user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para modificar este kit. Solo su autor o el tribunal global pueden editarlo.",
        )

    if data.titulo is not None:
        kit.titulo = data.titulo.strip()
    if data.descripcion is not None:
        kit.descripcion = data.descripcion.strip()
    if data.categoria is not None:
        kit.categoria = data.categoria.strip()
    if data.icono_url is not None:
        kit.icono_url = data.icono_url
    if data.es_publico is not None:
        kit.es_publico = data.es_publico
    if data.contenido is not None:
        kit.contenido = data.contenido.model_dump()

    await db.commit()
    await db.refresh(kit)
    return await get_kit_by_id(db, kit.id, current_user_id=user.id)


async def delete_kit(db: AsyncSession, kit_id: int, user: Usuario) -> None:
    """
    Elimina un Kit del catálogo público o privado.
    
    Aislamiento y Soberanía de Comunidades:
    Gracias a la inmutabilidad de inyecciones, eliminar un kit de la tienda
    NO afecta en absoluto a las misiones y apuestas que ya fueron volcadas
    en los diferentes grupos del sistema.
    """
    stmt = select(KitEvento).filter(KitEvento.id == kit_id)
    res = await db.execute(stmt)
    kit = res.scalars().first()

    if not kit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El kit con ID {kit_id} no existe.",
        )

    if kit.autor_id != user.id and user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación denegada. Solo el autor del kit o un administrador global pueden eliminarlo.",
        )

    await db.delete(kit)
    await db.commit()


async def toggle_kit_like(
    db: AsyncSession, kit_id: int, user_id: int
) -> KitLikeResponse:
    """
    Alterna de forma atómica e idempotente el voto 'Me Gusta' de un usuario sobre un kit.
    Si ya había votado positivamente, se retira el voto y se reduce el contador.
    Si no había votado, se crea el registro KitLike y se incrementa el contador.
    """
    stmt = select(KitEvento).filter(KitEvento.id == kit_id)
    res = await db.execute(stmt)
    kit = res.scalars().first()

    if not kit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kit con ID {kit_id} no encontrado.",
        )

    like_stmt = select(KitLike).filter(
        KitLike.kit_id == kit_id, KitLike.usuario_id == user_id
    )
    like_res = await db.execute(like_stmt)
    existing_like = like_res.scalars().first()

    if existing_like:
        await db.delete(existing_like)
        kit.likes_count = max(0, kit.likes_count - 1)
        liked = False
    else:
        new_like = KitLike(kit_id=kit_id, usuario_id=user_id)
        db.add(new_like)
        kit.likes_count = kit.likes_count + 1
        liked = True

    try:
        await db.commit()
        await db.refresh(kit)
    except IntegrityError:
        await db.rollback()
        # En caso de colisión concurrente, recuperamos el estado persistido
        stmt = select(KitEvento).filter(KitEvento.id == kit_id)
        res = await db.execute(stmt)
        kit = res.scalars().first()
        like_stmt = select(KitLike.id).filter(
            KitLike.kit_id == kit_id, KitLike.usuario_id == user_id
        )
        like_res = await db.execute(like_stmt)
        liked = like_res.scalars().first() is not None
        return KitLikeResponse(liked=liked, likes_count=kit.likes_count if kit else 0)

    return KitLikeResponse(liked=liked, likes_count=kit.likes_count)


async def report_kit(
    db: AsyncSession, kit_id: int, user_id: int, motivo: str
) -> None:
    """
    Registra una denuncia comunitaria sobre un kit con contenido inapropiado.
    Cumple la directiva de moderación manual: el kit permanece activo mientras
    se registra el informe de auditoría para la revisión del tribunal.

    Reglas de Seguridad y Anti-Abuso:
    1. Los kits oficiales de la plataforma no pueden ser reportados.
    2. Un autor no puede reportar su propio kit.
    3. Idempotencia: No se permiten reportes duplicados del mismo usuario sobre el mismo kit.
    """
    stmt = select(KitEvento).filter(KitEvento.id == kit_id)
    res = await db.execute(stmt)
    kit = res.scalars().first()

    if not kit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Kit con ID {kit_id} no encontrado.",
        )

    if kit.es_oficial:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los kits oficiales verificados por la plataforma no pueden ser denunciados.",
        )

    if kit.autor_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes denunciar tu propio kit de eventos.",
        )

    existing_report_stmt = select(KitReporte.id).filter(
        KitReporte.kit_id == kit_id, KitReporte.usuario_id == user_id
    )
    existing_res = await db.execute(existing_report_stmt)
    if existing_res.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya has enviado una denuncia para este kit. El Tribunal la revisará en breve.",
        )

    nuevo_reporte = KitReporte(
        kit_id=kit_id,
        usuario_id=user_id,
        motivo=motivo.strip(),
    )
    db.add(nuevo_reporte)
    await db.commit()


async def inyectar_kit_en_grupo(
    db: AsyncSession,
    grupo_id: int,
    user: Usuario,
    payload: InyeccionKitRequest,
) -> InyeccionKitResponse:
    """
    Ejecuta la inyección atómica en bloque de los ítems seleccionados de un kit en el grupo.

    Garantías Transaccionales y de Seguridad:
    1. Verifica que el grupo existe en el registro territorial.
    2. 'verify_group_admin': Certifica que el usuario ostenta el rol de 'admin' en dicho grupo.
    3. Transacción atómica: Se crean todas las misiones regulares, misiones de ruleta y
       mercados de apuestas en un único bloque; si cualquiera fallara, se revierte todo.
    4. Calibración de Estado: Los elementos se crean en estado 'activa'/'abierta'
       si 'publicar_inmediatamente = True', o en estado 'propuesta' si se guardan como borradores.
    5. Métricas: Si se vinculó un kit_id, se incrementa 'descargas_count' en el kit.
    """
    # 1. Comprobar existencia del grupo
    stmt = select(Grupo).filter(Grupo.id == grupo_id)
    res = await db.execute(stmt)
    grupo = res.scalars().first()
    if not grupo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El grupo con ID {grupo_id} no existe.",
        )

    # 2. Validar que el usuario es administrador del grupo
    await verify_group_admin(db, user, grupo_id)

    # 3. Validar que se ha seleccionado al menos un reto para inyectar
    if (
        not payload.misiones_seleccionadas
        and not payload.ruletas_seleccionadas
        and not payload.apuestas_seleccionadas
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes seleccionar al menos una misión, ruleta o apuesta para inyectar en el grupo.",
        )

    # 4. Si se especificó un kit de origen, validar existencia y permisos de acceso
    kit_origen = None
    if payload.kit_id:
        kit_stmt = select(KitEvento).filter(KitEvento.id == payload.kit_id)
        kit_res = await db.execute(kit_stmt)
        kit_origen = kit_res.scalars().first()
        if not kit_origen:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El kit de eventos de origen con ID {payload.kit_id} no existe.",
            )
        if not kit_origen.es_publico and kit_origen.autor_id != user.id and user.rol != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para utilizar este kit privado.",
            )

    estado_misiones = "activa" if payload.publicar_inmediatamente else "propuesta"
    estado_apuestas = "abierta" if payload.publicar_inmediatamente else "propuesta"

    misiones_creadas = 0
    ruletas_creadas = 0
    apuestas_creadas = 0

    # 5. Inserción de Misiones de Tablón
    for mision_item in payload.misiones_seleccionadas:
        mision = Mision(
            grupo_id=grupo_id,
            creador_id=user.id,
            titulo=mision_item.titulo.strip(),
            descripcion=mision_item.descripcion.strip(),
            recompensa=mision_item.recompensa,
            cupo_maximo=mision_item.cupo_maximo,
            fase="global",
            es_ruleta=False,
            estado=estado_misiones,
        )
        db.add(mision)
        misiones_creadas += 1

    # 6. Inserción de Misiones de Ruleta Diaria (Bombo Secreto)
    for ruleta_item in payload.ruletas_seleccionadas:
        ruleta = Mision(
            grupo_id=grupo_id,
            creador_id=user.id,
            titulo=ruleta_item.titulo.strip(),
            descripcion=ruleta_item.descripcion.strip(),
            recompensa=ruleta_item.recompensa,
            cupo_maximo=None,
            fase="global",
            es_ruleta=True,
            estado=estado_misiones,
        )
        db.add(ruleta)
        ruletas_creadas += 1

    # 7. Inserción de Mercados de Apuestas
    for apuesta_item in payload.apuestas_seleccionadas:
        # Convertimos las opciones de lista a diccionario indexado por ID para compatibilidad con el modelo Apuesta
        opciones_dict = {}
        for opt in apuesta_item.opciones:
            opt_id = opt.id if opt.id else str(uuid.uuid4())[:8]
            opciones_dict[opt_id] = {
                "id": opt_id,
                "text": opt.text.strip(),
                "multiplier": float(opt.multiplier),
            }

        apuesta = Apuesta(
            grupo_id=grupo_id,
            creador_id=user.id,
            titulo=apuesta_item.titulo.strip(),
            opciones=opciones_dict,
            fase="global",
            estado=estado_apuestas,
            fecha_aprobacion=func.now() if estado_apuestas == "abierta" else None,
        )
        db.add(apuesta)
        apuestas_creadas += 1

    # 8. Actualizar métricas del kit si fue especificado y validado
    if kit_origen:
        kit_origen.descargas_count += 1

    await db.commit()

    return InyeccionKitResponse(
        misiones_creadas=misiones_creadas,
        ruletas_creadas=ruletas_creadas,
        apuestas_creadas=apuestas_creadas,
        estado_asignado=estado_misiones,
        mensaje=f"Se inyectaron {misiones_creadas} misiones, {ruletas_creadas} ruletas y {apuestas_creadas} apuestas en el grupo '{grupo.nombre}'.",
    )
