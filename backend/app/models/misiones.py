from sqlalchemy import Integer, String, Boolean, ForeignKey, Text, CheckConstraint, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from datetime import datetime, timezone

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.usuario import Usuario

# ==============================================================================
# Modelos del Sistema de Misiones, Retos y Pruebas (QuestFest)
# ==============================================================================
# Este módulo articula la mecánica central de retos del evento:
# 1. Misión: Desafío propuesto u oficial con recompensa en QuestCoins.
# 2. PruebaMision: Evidencia multimedia enviada por un jugador para reclamar la recompensa.
# 3. VotoMision: Votación comunitaria de propuestas antes de que el Admin las oficialice.
# 4. MisionRuletaAceptada: Vinculación de misiones diarias secretas al jugador que las tiró.
# ==============================================================================

class Mision(Base):
    """
    Entidad de Misión / Reto del Tablón.
    
    Tipologías de Misión:
    - Misiones Regulares ('es_ruleta = False'): Aparecen en el tablón común de la comunidad.
      Pueden ser propuestas por los jugadores ('estado = "propuesta"') y pasar por votación popular,
      o creadas directamente por el administrador ('estado = "activa"').
    - Misiones de Ruleta ('es_ruleta = True'): Forman parte del bombo de misiones secretas.
      No se listan en el tablón general hasta que un usuario las gana en su tirada diaria y las acepta.
    
    Reglas de Negocio:
    - 'cupo_maximo': Si se define, restringe el número máximo de jugadores que pueden completar la misión.
    - 'recompensa': Importe en tokens que el tribunal transferirá al usuario al validar su prueba.
    """
    __tablename__ = "misiones"

    id: Mapped[int] = mapped_column(primary_key=True)
    grupo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("grupos.id", ondelete="CASCADE"), index=True, nullable=True)
    titulo: Mapped[str] = mapped_column(String(150))
    creador_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    descripcion: Mapped[str] = mapped_column(Text)
    recompensa: Mapped[int] = mapped_column(Integer)
    cupo_maximo: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fase: Mapped[str] = mapped_column(String(50))
    es_ruleta: Mapped[bool] = mapped_column(Boolean, default=False)
    media_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    estado: Mapped[str] = mapped_column(String(50), default="activa") # 'propuesta', 'activa', 'cerrada'
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    creador: Mapped["Usuario"] = relationship(back_populates="misiones_creadas")

class PruebaMision(Base):
    """
    Evidencia de Completitud de Misión enviada por un Jugador.
    
    Flujo de Sentencia del Tribunal:
    1. 'pending': El usuario sube una foto (alojada en Cloudinary) o un texto explicativo demostrando la hazaña.
    2. 'approved': El administrador valida la prueba en el panel de control. El motor económico abona los tokens.
    3. 'rejected': El tribunal descarta la prueba (foto falsa, reto incumplido, etc.) justificando el motivo al usuario.
    """
    __tablename__ = "pruebas_misiones"

    id: Mapped[int] = mapped_column(primary_key=True)
    mision_id: Mapped[int] = mapped_column(ForeignKey("misiones.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    prueba_texto: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prueba_imagen_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    estado: Mapped[str] = mapped_column(String(50), default="pending")
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    mision: Mapped["Mision"] = relationship()
    usuario: Mapped["Usuario"] = relationship()

    __table_args__ = (
        CheckConstraint("estado IN ('pending', 'approved', 'rejected')", name="check_estado_prueba"),
    )

class VotoMision(Base):
    """
    Votos Populares sobre Sugerencias de Misiones.
    
    Permite que la comunidad apoye ('up') o vete ('down') propuestas creadas por otros jugadores.
    La restricción 'uix_voto_mision_usuario' garantiza 1 voto por jugador, permitiendo cambiar el sentido del voto.
    """
    __tablename__ = "votos_misiones"

    id: Mapped[int] = mapped_column(primary_key=True)
    mision_id: Mapped[int] = mapped_column(ForeignKey("misiones.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    tipo_voto: Mapped[str] = mapped_column(String(10))

    mision: Mapped["Mision"] = relationship()
    usuario: Mapped["Usuario"] = relationship()

    __table_args__ = (
        UniqueConstraint('mision_id', 'usuario_id', name='uix_voto_mision_usuario'),
        CheckConstraint("tipo_voto IN ('up', 'down')", name="check_tipo_voto"),
    )

class MisionRuletaAceptada(Base):
    """
    Registro de Misión de Ruleta Aceptada por el Jugador.
    
    ¿Por qué esta tabla separada?
    Cuando un jugador gira la ruleta diaria, el backend selecciona una misión del bombo secreto.
    Si el jugador hace clic en 'Aceptar', se inserta este registro para asociar la misión al jugador
    y permitir que aparezca temporalmente en su tablón activo durante el día en curso.
    """
    __tablename__ = "mision_ruleta_aceptada"

    id: Mapped[int] = mapped_column(primary_key=True)
    mision_id: Mapped[int] = mapped_column(ForeignKey("misiones.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    mision: Mapped["Mision"] = relationship()
    usuario: Mapped["Usuario"] = relationship()

    __table_args__ = (
        UniqueConstraint('mision_id', 'usuario_id', name='uix_ruleta_aceptada_mision_usuario'),
    )

