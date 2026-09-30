"""
================================================================================
ROUTER DE TABLA DE CLASIFICACIÓN (RANKING): QuestFest
================================================================================
Este enrutador computa la tabla de líderes y posiciones del juego.

Optimización SQL y Multi-Tenancy:
1. Subconsultas Escalares Correlacionadas: Para evitar costosos GROUP BY con múltiples
   JOINs cruzados (que causarían productos cartesianos y ralentizarían la BD),
   el conteo de:
   - Apuestas acertadas (`TicketApuesta` con `opcion_ganadora_id`).
   - Misiones completadas con éxito (`PruebaMision` con estado 'approved').
   - Duelos ganados (`Duelo` con estado 'completed' y `ganador_id == Usuario.id`).
   se resuelve mediante `scalar_subquery()` ejecutadas por el motor de PostgreSQL.
2. Modo Grupo vs Modo Global:
   - Si se pasa `group_id`: El ranking muestra únicamente miembros de ese grupo,
     ordenados por su `saldo_grupo` local y filtrando sólo los logros obtenidos dentro del evento.
   - Si no se pasa `group_id`: Genera la clasificación general de la plataforma.
================================================================================
"""

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.grupo import MiembroGrupo
from app.models.juegos import Apuesta, Duelo, TicketApuesta
from app.models.misiones import Mision, PruebaMision
from app.models.usuario import Usuario

router = APIRouter()


class RankingUserItem(BaseModel):
    username: str
    avatar_url: Optional[str] = None
    saldo_actual: int
    apuestas_acertadas: int
    misiones_completadas: int
    duelos_ganados: int


@router.get("/", response_model=List[RankingUserItem])
async def get_global_ranking(group_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """
    Devuelve la tabla de clasificación ordenada de mayor a menor saldo.
    Soporta filtrado contextual por `group_id`.
    """
    if group_id is not None:
        # 1. Conteo de apuestas acertadas dentro del grupo
        subq_apuestas = (
            select(func.count(TicketApuesta.id))
            .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
            .where(
                and_(
                    TicketApuesta.usuario_id == Usuario.id,
                    TicketApuesta.grupo_id == group_id,
                    Apuesta.estado == "cerrada",
                    TicketApuesta.opcion_id == Apuesta.opcion_ganadora_id,
                )
            )
            .scalar_subquery()
        )

        # 2. Conteo de misiones validadas en el grupo
        subq_misiones = (
            select(func.count(PruebaMision.id))
            .join(Mision, Mision.id == PruebaMision.mision_id)
            .where(
                and_(
                    PruebaMision.usuario_id == Usuario.id,
                    Mision.grupo_id == group_id,
                    PruebaMision.estado == "approved",
                )
            )
            .scalar_subquery()
        )

        # 3. Conteo de duelos ganados en el grupo
        subq_duelos = (
            select(func.count(Duelo.id))
            .where(
                and_(
                    Duelo.ganador_id == Usuario.id,
                    Duelo.grupo_id == group_id,
                    Duelo.estado == "completed",
                )
            )
            .scalar_subquery()
        )

        # Consulta principal vinculada a la membresía del grupo
        query = (
            select(
                Usuario.username,
                Usuario.avatar_url,
                MiembroGrupo.saldo_grupo.label("saldo_actual"),
                subq_apuestas.label("apuestas_acertadas"),
                subq_misiones.label("misiones_completadas"),
                subq_duelos.label("duelos_ganados"),
            )
            .join(MiembroGrupo, MiembroGrupo.usuario_id == Usuario.id)
            .where(MiembroGrupo.grupo_id == group_id)
            .order_by(MiembroGrupo.saldo_grupo.desc())
        )
    else:
        subq_apuestas = (
            select(func.count(TicketApuesta.id))
            .join(Apuesta, Apuesta.id == TicketApuesta.apuesta_id)
            .where(
                and_(
                    TicketApuesta.usuario_id == Usuario.id,
                    Apuesta.estado == "cerrada",
                    TicketApuesta.opcion_id == Apuesta.opcion_ganadora_id,
                )
            )
            .scalar_subquery()
        )

        subq_misiones = (
            select(func.count(PruebaMision.id))
            .where(and_(PruebaMision.usuario_id == Usuario.id, PruebaMision.estado == "approved"))
            .scalar_subquery()
        )

        subq_duelos = (
            select(func.count(Duelo.id))
            .where(and_(Duelo.ganador_id == Usuario.id, Duelo.estado == "completed"))
            .scalar_subquery()
        )

        query = (
            select(
                Usuario.username,
                Usuario.avatar_url,
                Usuario.saldo_actual,
                subq_apuestas.label("apuestas_acertadas"),
                subq_misiones.label("misiones_completadas"),
                subq_duelos.label("duelos_ganados"),
            )
            .where(Usuario.rol.in_(["player", "admin"]))
            .order_by(Usuario.saldo_actual.desc())
        )

    result = await db.execute(query)
    rows = result.all()

    return [
        RankingUserItem(
            username=row.username,
            avatar_url=row.avatar_url,
            saldo_actual=row.saldo_actual,
            apuestas_acertadas=row.apuestas_acertadas or 0,
            misiones_completadas=row.misiones_completadas or 0,
            duelos_ganados=row.duelos_ganados or 0,
        )
        for row in rows
    ]
