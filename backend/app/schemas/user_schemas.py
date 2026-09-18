from pydantic import BaseModel
from typing import Optional

class UserUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None

class UserStatsResponse(BaseModel):
    missionsCompleted: int
    betsWon: int
    duelsWon: int
    betsActive: int
    betsLost: int
    tokensActive: int
    tokensWon: int
    tokensLost: int
    duelsLost: int
    duelsActive: int

class RankingResponse(BaseModel):
    rankingPosition: int

class TransactionResponse(BaseModel):
    id: int
    type: str  # 'income' or 'expense'
    amount: int
    concept: str
    date: str
    balance: int

class StatDetailItem(BaseModel):
    id: str        # Ej: "tx_12", "bet_5", "duel_2"
    title: str     # Ej: "Duelo vs @usuario", o el concepto de la transacción
    amount: int    # Tokens en positivo absoluto
    date: str      # Fecha en formato .isoformat()
    type: str      # 'transaction', 'bet', 'duel'
    status: str    # 'won', 'lost', 'pending', 'income', 'expense'

class PublicProfileResponse(BaseModel):
    username: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    saldo_actual: int
    apuestas_acertadas: int
    misiones_completadas: int
    duelos_ganados: int

class PublicApuestaResponse(BaseModel):
    id: int
    titulo: str
    cantidad: int
    resultado: str # "Ganada" | "Perdida"
    fecha: str

class PublicMisionResponse(BaseModel):
    id: int
    titulo: str
    recompensa: int
    fecha_completada: str

class PublicDueloResponse(BaseModel):
    id: int
    retador: str
    retado: str
    juego: str
    tokens_en_juego: int
    estado: str
    ganador: Optional[str] = None
    fecha: str
