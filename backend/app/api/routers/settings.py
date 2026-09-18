"""
================================================================================
ROUTER DE CONFIGURACIÓN GLOBAL: QuestFest
================================================================================
Este enrutador gestiona los parámetros globales de la aplicación almacenados
en la tabla clave-valor `ConfiguracionGlobal`.

Ajustes administrados:
1. Reglas del Juego (`/rules`): Texto con las normas y pautas de convivencia
   del evento, visible para todos los jugadores y editable exclusivamente por administradores.
2. Configuración del Boletín Diario (`/boletin`): Diccionario JSON serializado que
   controla qué secciones (ganador, farolillo rojo, duelos) se mostrarán en el resumen matutino.
================================================================================
"""

import json
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.usuario import Usuario
from app.models.configuracion import ConfiguracionGlobal
from app.schemas.settings_schemas import ReglasResponse, ReglasUpdate

router = APIRouter()

@router.get("/rules", response_model=ReglasResponse)
async def get_rules(db: AsyncSession = Depends(get_db)):
    """
    Obtiene el texto canónico de las reglas del juego.
    Si no existe aún un registro personalizado en la BD, retorna el texto por defecto.
    """
    config = await db.scalar(select(ConfiguracionGlobal).where(ConfiguracionGlobal.clave == "reglas"))
    default_rules = "Bienvenido a QuestFest: Misiones reales en fiestas reales. Aquí estarán las reglas del juego."
    return ReglasResponse(reglas=config.valor if config else default_rules)

@router.put("/rules", response_model=ReglasResponse)
async def update_rules(
    rules_update: ReglasUpdate, 
    current_user: Usuario = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza el texto de las reglas del juego.
    Operación restringida exclusivamente a usuarios con rol 'admin'.
    """
    if current_user.rol != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos para editar las reglas")
    
    config = await db.scalar(select(ConfiguracionGlobal).where(ConfiguracionGlobal.clave == "reglas"))
    if not config:
        config = ConfiguracionGlobal(clave="reglas", valor=rules_update.reglas)
        db.add(config)
    else:
        config.valor = rules_update.reglas
    
    await db.commit()
    return ReglasResponse(reglas=config.valor)

@router.get("/boletin")
async def get_boletin_config(db: AsyncSession = Depends(get_db)):
    """
    Recupera la configuración de visibilidad del boletín diario matutino.
    Si falla la decodificación JSON o no existe el registro, retorna los valores por defecto.
    """
    config = await db.scalar(select(ConfiguracionGlobal).where(ConfiguracionGlobal.clave == "boletin_config"))
    if config and config.valor:
        try:
            return json.loads(config.valor)
        except Exception:
            pass
    return {
        "hora": "12:00",
        "phaseValue": "Noche 1",
        "phase": True,
        "firstPlace": True,
        "lastPlace": True,
        "mostBetsWon": True,
        "mostMissions": True,
        "duelWinner": True,
        "biggestWinner": True,
        "biggestLoser": True
    }

@router.put("/boletin")
async def update_boletin_config(
    payload: dict = Body(...),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Persiste la configuración del boletín serializándola a formato JSON string.
    Operación restringida exclusivamente a usuarios con rol 'admin'.
    """
    if current_user.rol != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos para editar el boletín")
    
    config = await db.scalar(select(ConfiguracionGlobal).where(ConfiguracionGlobal.clave == "boletin_config"))
    valor_str = json.dumps(payload)
    if not config:
        config = ConfiguracionGlobal(clave="boletin_config", valor=valor_str)
        db.add(config)
    else:
        config.valor = valor_str
    
    await db.commit()
    return {"status": "success", "config": payload}
