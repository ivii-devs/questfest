"""
================================================================================
ROUTER DE RULETA DIARIA DE MISIONES: QuestFest
================================================================================
Este enrutador controla la mecánica de la Ruleta Diaria ("Lucky Wheel"),
permitiendo a cada jugador obtener una misión aleatoria y secreta cada día de fiesta.

Principios de diseño y seguridad:
1. Determinismo en Servidor: El sorteo aleatorio (RNG) se ejecuta exclusivamente
   en el backend (`misiones_crud.spin_roulette`). El cliente frontend solo reproduce
   la animación visual con el resultado previamente resuelto.
2. Límite de 1 Tiro Diario: Se valida mediante `RegistroRuleta` por fecha natural (UTC/local).
3. Aceptación Idempotente: La tabla `MisionRuletaAceptada` cuenta con una restricción
   única para evitar que un jugador acepte múltiples veces el mismo premio.
4. Rate Limiting: Protegido por slowapi (`10/minute`) para evitar abusos o denegación de servicio.
================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.misiones_schemas import MissionResponse
from app.crud import misiones_crud
from app.core.rate_limiter import limiter

router = APIRouter()

@router.post("/spin", response_model=MissionResponse, status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def spin_roulette(
    request: Request,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Ejecuta el giro diario de la Ruleta.
    
    Verifica que el usuario no haya agotado su tirada del día en `RegistroRuleta`,
    selecciona aleatoriamente una misión del bombo y quema el tiro de forma atómica.
    """
    mission = await misiones_crud.spin_roulette(db, current_user.id)
    return {
        "id": str(mission.id),
        "title": mission.titulo,
        "description": mission.descripcion,
        "reward": mission.recompensa,
        "phase": mission.fase,
        "is_roulette": mission.es_ruleta,
        "max_completions": mission.cupo_maximo,
        "author": str(mission.creador_id)
    }

@router.post("/accept/{mission_id}", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def accept_roulette_mission(
    request: Request,
    mission_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Confirma la aceptación de la misión asignada tras el giro de ruleta.
    
    Captura de `IntegrityError`:
    Si el usuario intenta aceptar dos veces la misma misión (por ejemplo, pulsando
    el botón repetidamente), la clave primaria/única en base de datos salta y
    capturamos el error para devolver un código HTTP 400 limpio sin romper la sesión.
    """
    from app.models.misiones import MisionRuletaAceptada
    from sqlalchemy.exc import IntegrityError
    
    aceptada = MisionRuletaAceptada(
        mision_id=mission_id,
        usuario_id=current_user.id
    )
    db.add(aceptada)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Ya has aceptado esta misión anteriormente."
        )
    return {"message": "Misión de ruleta aceptada con éxito"}
