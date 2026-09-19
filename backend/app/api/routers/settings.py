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
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

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
async def get_boletin_config(
    group_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Recupera la configuración de visibilidad del boletín diario matutino.
    Si se especifica group_id, busca la configuración específica de ese grupo ('boletin_config_group_{group_id}').
    Si no existe o falla, recurre a la clave global ('boletin_config') o a los valores por defecto.
    """
    default_config = {
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

    if group_id is not None:
        group_config = await db.scalar(
            select(ConfiguracionGlobal).where(ConfiguracionGlobal.clave == f"boletin_config_group_{group_id}")
        )
        if group_config and group_config.valor:
            try:
                parsed = json.loads(group_config.valor)
                return {**default_config, **parsed}
            except Exception:
                pass

    config = await db.scalar(select(ConfiguracionGlobal).where(ConfiguracionGlobal.clave == "boletin_config"))
    if config and config.valor:
        try:
            parsed = json.loads(config.valor)
            return {**default_config, **parsed}
        except Exception:
            pass

    return default_config

@router.put("/boletin")
async def update_boletin_config(
    payload: dict = Body(...),
    group_id: Optional[int] = Query(None),
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Persiste la configuración del boletín serializándola a formato JSON string.
    Si se proporciona group_id (en Query o en payload), se autoriza a administradores
    globales o al administrador local del grupo en cuestión, guardándose en la clave del grupo.
    """
    target_group_id = group_id if group_id is not None else payload.get("group_id")

    # Verificación de permisos: Admin global o Admin local del grupo
    is_authorized = False
    if current_user.rol == 'admin':
        is_authorized = True
    elif target_group_id is not None:
        from app.models.grupo import MiembroGrupo
        membership = await db.scalar(
            select(MiembroGrupo).where(
                and_(
                    MiembroGrupo.usuario_id == current_user.id,
                    MiembroGrupo.grupo_id == target_group_id,
                    MiembroGrupo.rol == 'admin'
                )
            )
        )
        if membership:
            is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar el boletín")

    clave = f"boletin_config_group_{target_group_id}" if target_group_id is not None else "boletin_config"

    config = await db.scalar(select(ConfiguracionGlobal).where(ConfiguracionGlobal.clave == clave))
    valor_str = json.dumps(payload)
    if not config:
        config = ConfiguracionGlobal(clave=clave, valor=valor_str)
        db.add(config)
    else:
        config.valor = valor_str

    await db.commit()
    return {"status": "success", "config": payload}
