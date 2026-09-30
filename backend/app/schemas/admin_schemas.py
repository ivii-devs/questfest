from pydantic import BaseModel, ConfigDict
from typing import Optional, Any, Dict
from datetime import datetime

class AnuncioCreate(BaseModel):
    contenido: str
    media_url: Optional[str] = None
    group_id: Optional[int] = None

class NotificacionCreate(BaseModel):
    titulo: str
    mensaje: str
    media_url: Optional[str] = None
    fecha_programada: Optional[datetime] = None
    destinatario_tipo: str
    destinatario_id: Optional[int] = None
    config_boletin: Optional[Dict[str, Any]] = None
    group_id: Optional[int] = None

class NotificacionResponse(BaseModel):
    id: int
    titulo: str
    mensaje: str
    media_url: Optional[str]
    estado: str
    fecha_programada: Optional[datetime]
    destinatario_tipo: str
    destinatario_id: Optional[int]
    config_boletin: Optional[Dict[str, Any]]
    fecha_creacion: datetime
    
    model_config = ConfigDict(from_attributes=True)

class GlobalStats(BaseModel):
    total_users: int
    total_tokens: int

class UserBalanceUpdate(BaseModel):
    cantidad: int # Positivo para bonificar, Negativo para multar
    concepto: str
    group_id: Optional[int] = None

class RuletaMisionCreate(BaseModel):
    titulo: str
    descripcion: str
    recompensa: int
    media_url: Optional[str] = None
    group_id: Optional[int] = None

class AudiencePreviewRequest(BaseModel):
    destinatario_tipo: str
    destinatario_id: Optional[int] = None

class StatUser(BaseModel):
    name: str
    points: Optional[int] = None
    count: Optional[int] = None
    amount: Optional[str] = None

class DuelStat(BaseModel):
    name: str
    opponent: str

class DailySummaryStatsResponse(BaseModel):
    phase: str
    firstPlace: Optional[StatUser]
    lastPlace: Optional[StatUser]
    mostBetsWon: Optional[StatUser]
    mostMissions: Optional[StatUser]
    duelWinner: Optional[DuelStat]
    biggestWinner: Optional[StatUser]
    biggestLoser: Optional[StatUser]

class BetStatusUpdate(BaseModel):
    estado: str
    opcion_ganadora_id: Optional[str] = None

class AdminAprobarSugerencia(BaseModel):
    recompensa: int

class AdminRechazarPrueba(BaseModel):
    motivo: str
