from sqlalchemy import Integer, String, ForeignKey, CheckConstraint, UniqueConstraint, Date, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.usuario import Usuario

# ==============================================================================
# Modelos de Juegos, Gamificación y Mercados Predictivos (QuestFest)
# ==============================================================================
# Este módulo define las estructuras de datos que soportan la dinámica de juego:
# 1. Ruleta Diaria: Tirada aleatoria una vez al día para desbloquear misiones secretas.
# 2. Apuestas Colectivas: Propuestas de la comunidad, mercado abierto y liquidación de cuotas.
# 3. Duelos 1vs1: Desafíos directos con retención preventiva de saldo y resolución arbitral.
# 4. Tickets de Apuesta: Comprobantes individuales de participación en un mercado.
# ==============================================================================

class RegistroRuleta(Base):
    """
    Registro Histórico de Giros de la Ruleta Diaria.
    
    Regla de Negocio:
    Cada usuario tiene derecho a un único tiro diario para desbloquear una misión especial de ruleta.
    Para blindar esta regla contra condiciones de carrera o peticiones concurrentes simultáneas,
    la base de datos impone 'UniqueConstraint("usuario_id", "fecha")', haciendo físicamente imposible
    que un jugador tire dos veces en la misma fecha UTC.
    """
    __tablename__ = "registro_ruleta"

    id: Mapped[int] = mapped_column(primary_key=True)
    grupo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("grupos.id", ondelete="CASCADE"), index=True, nullable=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    fecha: Mapped[date] = mapped_column(Date, default=date.today)

    usuario: Mapped["Usuario"] = relationship(back_populates="ruletas")

    __table_args__ = (
        UniqueConstraint("usuario_id", "fecha", name="uq_usuario_fecha_ruleta"),
    )

class Apuesta(Base):
    """
    Mercado de Apuestas / Predicciones del Evento.
    
    Ciclo de Vida de una Apuesta:
    1. 'propuesta': Sugerida por un jugador. Los demás usuarios votan a favor o en contra ('votos_sugerencia').
    2. 'abierta': Aprobada por el administrador/líder. El mercado queda abierto y los usuarios pueden comprar tickets.
    3. 'cerrada': El evento concluyó. El administrador selecciona la 'opcion_ganadora_id' y el motor económico
       abona las ganancias automáticamente a los ganadores según el multiplicador (cuota).
    4. 'rechazada': Propuesta descartada por el tribunal o votos negativos de la comunidad.
    
    ¿Por qué 'opciones' en JSONB?
    Permite flexibilidad total en el número de opciones (ej. 2 opciones para Sí/No, o múltiples para podiums)
    almacenando para cada una su ID único corto, texto descriptivo y cuota (multiplicador de ganancia).
    """
    __tablename__ = "apuestas"

    id: Mapped[int] = mapped_column(primary_key=True)
    grupo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("grupos.id", ondelete="CASCADE"), index=True, nullable=True)
    titulo: Mapped[str] = mapped_column(String(200))
    creador_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    opciones: Mapped[dict] = mapped_column(JSONB) # Diccionario JSONB: { "opt1": {"id": "opt1", "text": "Sí", "multiplier": 1.5}, ... }
    fase: Mapped[str] = mapped_column(String(50))
    estado: Mapped[str] = mapped_column(String(50), default="abierta")
    opcion_ganadora_id: Mapped[str] = mapped_column(String(50), nullable=True)
    votos_sugerencia: Mapped[dict] = mapped_column(JSONB, default=dict, server_default='{}')
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    fecha_aprobacion: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    creador: Mapped["Usuario"] = relationship(back_populates="apuestas_creadas")

class Duelo(Base):
    """
    Desafío Directo 1vs1 entre Jugadores.
    
    Protocolo Económico de Retención Preventiva (Escrow):
    - Al crearse el duelo, el retador inmoviliza preventivamente su apuesta ('tokens_en_juego').
    - Si el retado acepta, el retado inmoviliza la misma cantidad, conformando un bote total de 2 * tokens_en_juego.
    - Si el retado rechaza o el duelo se anula, los tokens retenidos se reembolsan íntegramente.
    - Cuando se dicta sentencia sobre el ganador, el tribunal transfiere el bote completo al vencedor.
    
    Máquina de Estados Finita ('check_estado_duelo'):
    - 'pending': Reto propuesto; esperando aceptación del retado.
    - 'accepted': Reto aceptado por el contrincante; duelo en curso.
    - 'validation_winner': Uno de los jugadores reportó el resultado; esperando ratificación del tribunal.
    - 'validation_rejected': Desafío rechazado; fondos liberados.
    - 'completed': Duelo resuelto y tokens acreditados al ganador (o devueltos si hubo empate).
    - 'penalized_challenger': Sentencia disciplinaria contra el jugador por fraude o falta de conducta.
    """
    __tablename__ = "duelos"

    id: Mapped[int] = mapped_column(primary_key=True)
    grupo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("grupos.id", ondelete="CASCADE"), index=True, nullable=True)
    retador_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    retado_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    juego: Mapped[str] = mapped_column(String(150)) # Nombre o descripción de la prueba (ej. 'Futbolín', 'Pimpón', 'Piedra-Papel-Tijera')
    tokens_en_juego: Mapped[int] = mapped_column(Integer) # Cantidad que apuesta cada contendiente (el bote total es el doble)
    estado: Mapped[str] = mapped_column(String(50))
    ganador_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    reported_resolution: Mapped[str] = mapped_column(String(50), nullable=True) # Codificación 'challenger:victory', 'challenged:draw', etc.

    retador: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[retador_id], back_populates="duelos_retador")
    retado: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[retado_id], back_populates="duelos_retado")

    __table_args__ = (
        CheckConstraint(
            "estado IN ('pending', 'accepted', 'validation_winner', 'validation_rejected', 'completed', 'penalized_challenger')", 
            name="check_estado_duelo"
        ),
    )

class TicketApuesta(Base):
    """
    Comprobante Individual de Participación en una Apuesta.
    
    Reglas de Integridad:
    - 'check_ticket_cantidad_positiva': Prohíbe apostar 0 o cantidades negativas de tokens.
    - 'uq_usuario_apuesta': Un usuario solo puede tener un ticket por apuesta. Para cambiar su pronóstico
      o ampliar su inversión, debe regirse por la política del mercado (evita fragmentación de apuestas).
    """
    __tablename__ = "ticket_apuestas"

    id: Mapped[int] = mapped_column(primary_key=True)
    grupo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("grupos.id", ondelete="CASCADE"), index=True, nullable=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    apuesta_id: Mapped[int] = mapped_column(ForeignKey("apuestas.id", ondelete="CASCADE"), index=True)
    opcion_id: Mapped[str] = mapped_column(String(50))
    cantidad: Mapped[int] = mapped_column(Integer)
    fecha: Mapped[date] = mapped_column(Date, default=date.today)

    usuario: Mapped["Usuario"] = relationship()
    apuesta: Mapped["Apuesta"] = relationship()

    __table_args__ = (
        CheckConstraint("cantidad > 0", name="check_ticket_cantidad_positiva"),
        UniqueConstraint("usuario_id", "apuesta_id", name="uq_usuario_apuesta"),
    )

