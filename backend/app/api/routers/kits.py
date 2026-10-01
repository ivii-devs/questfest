"""
================================================================================
ROUTER DE KITS DE EVENTOS Y PRESETS (QuestFest)
================================================================================
Centraliza la exposición de contratos REST para:
1. Catálogo público y personal de plantillas de retos y apuestas.
2. Autoría y edición soberana de kits.
3. Votación popular (Likes) y sistema de denuncias ciudadanas.
4. Asistente de inyección atómica en comunidades multi-tenant.
================================================================================
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limiter import limiter
from app.crud import kits_crud
from app.dependencies import get_current_user, get_optional_current_user
from app.models.usuario import Usuario
from app.schemas.kits_schemas import (
    InyeccionKitRequest,
    InyeccionKitResponse,
    KitCreateRequest,
    KitLikeResponse,
    KitReportRequest,
    KitResponse,
    KitUpdateRequest,
)

router = APIRouter()


@router.get("/", response_model=List[KitResponse])
async def list_kits_endpoint(
    tipo: Optional[str] = Query(
        None, description="Filtro de catálogo: 'oficial', 'comunidad', 'mis-kits'"
    ),
    categoria: Optional[str] = Query(
        None, description="Categoría temática: 'Fiesta', 'Viajes', 'Deporte', etc."
    ),
    query: Optional[str] = Query(
        None, description="Búsqueda por texto en título, descripción o categoría"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: Optional[Usuario] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lista los kits del catálogo aplicando los filtros solicitados por la interfaz PWA.
    Permite descubrir kits oficiales de la plataforma, creaciones de la comunidad o
    gestionar los kits propios creados por el usuario activo.
    """
    user_id = current_user.id if current_user else None
    return await kits_crud.list_kits(
        db=db,
        current_user_id=user_id,
        tipo=tipo,
        categoria=categoria,
        query=query,
        skip=skip,
        limit=limit,
    )


@router.get("/{kit_id}", response_model=KitResponse)
async def get_kit_detail_endpoint(
    kit_id: int,
    current_user: Optional[Usuario] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):

    """
    Obtiene el detalle completo de un kit, incluyendo su árbol estructurado de
    misiones del tablón, ruletas secretas y mercados de apuestas con arquetipos.
    """
    user_id = current_user.id if current_user else None
    return await kits_crud.get_kit_by_id(db=db, kit_id=kit_id, current_user_id=user_id)


@router.post("/", response_model=KitResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_kit_endpoint(
    request: Request,
    kit_data: KitCreateRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Crea un nuevo kit en el sistema.
    Puede nacer desde cero en el formulario del Hub o empaquetado a partir de un grupo existente.
    """
    return await kits_crud.create_kit(db=db, user=current_user, data=kit_data)


@router.put("/{kit_id}", response_model=KitResponse)
async def update_kit_endpoint(
    kit_id: int,
    update_data: KitUpdateRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Actualiza los metadatos o el contenido JSONB de un kit.
    ACCESO RESTRINGIDO: Exclusivo para el autor del kit o superadministradores.
    """
    return await kits_crud.update_kit(
        db=db, kit_id=kit_id, user=current_user, data=update_data
    )


@router.delete("/{kit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kit_endpoint(
    kit_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Elimina un kit del catálogo.
    Las misiones y apuestas previamente inyectadas en grupos no se alteran.
    ACCESO RESTRINGIDO: Exclusivo para el autor del kit o superadministradores.
    """
    await kits_crud.delete_kit(db=db, kit_id=kit_id, user=current_user)
    return None


@router.post("/{kit_id}/like", response_model=KitLikeResponse)
async def toggle_kit_like_endpoint(
    kit_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Alterna de forma atómica el estado de 'Me Gusta' del usuario sobre el kit.
    Devuelve el nuevo estado booleano ('liked') y el contador actualizado.
    """
    return await kits_crud.toggle_kit_like(
        db=db, kit_id=kit_id, user_id=current_user.id
    )


@router.post("/{kit_id}/report", status_code=status.HTTP_201_CREATED)
async def report_kit_endpoint(
    kit_id: int,
    report_data: KitReportRequest,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Registra una denuncia por contenido indebido en un kit comunitario.
    El kit permanece visible para evitar censuras automáticas malintencionadas.
    """
    await kits_crud.report_kit(
        db=db, kit_id=kit_id, user_id=current_user.id, motivo=report_data.motivo
    )
    return {"message": "El reporte fue registrado exitosamente para la revisión del tribunal."}


@router.post("/inject/{grupo_id}", response_model=InyeccionKitResponse)
@router.post("/{kit_id}/inject/{grupo_id}", response_model=InyeccionKitResponse)
@limiter.limit("15/minute")
async def inject_kit_endpoint(
    request: Request,
    grupo_id: int,
    payload: InyeccionKitRequest,
    kit_id: Optional[int] = None,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Inyecta atómicamente un lote de misiones y apuestas en el grupo indicado.
    ACCESO RESTRINGIDO: Exclusivo para usuarios con rol 'admin' en el grupo destino.
    """
    # Si kit_id viene en la ruta, tiene prioridad sobre el payload
    if kit_id is not None:
        payload.kit_id = kit_id
    return await kits_crud.inyectar_kit_en_grupo(
        db=db, grupo_id=grupo_id, user=current_user, payload=payload
    )
