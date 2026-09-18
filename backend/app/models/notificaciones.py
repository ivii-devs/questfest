from sqlalchemy import String, Text, DateTime, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone
from typing import Optional
from app.models.base import Base

class NotificacionAdmin(Base):
    """
    Sistema de Notificaciones Administrativas y Boletines Informativos.
    
    Permite a los administradores difundir mensajes emergentes en la PWA, programar alertas
    y segmentar la audiencia según el estado del jugador en el juego.
    
    Estrategia de Segmentación ('destinatario_tipo'):
    - 'all': Difusión masiva a todos los miembros de la comunidad.
    - 'specific': Notificación dirigida a un usuario concreto (ej. '@fulano te ha retado a un duelo',
      'Tu prueba de misión ha sido validada', 'Has recibido una multa del tribunal').
    - 'bankrupt': Dirigida exclusivamente a usuarios en bancarrota (saldo <= 0) para incentivarles
      a completar misiones o buscar duelos.
    - 'no_bet': Recordatorio para usuarios que aún no han colocado ninguna apuesta en el día de hoy.
    
    ¿Qué es 'config_boletin'?
    Campo JSONB opcional que almacena la configuración de estadísticas del Boletín Diario (Líder del ranking,
    mayor ganador de las últimas 24h, mayor perdedor, duelo más épico, etc.).
    """
    __tablename__ = "notificaciones_admin"

    id: Mapped[int] = mapped_column(primary_key=True)
    grupo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("grupos.id", ondelete="CASCADE"), index=True, nullable=True)
    titulo: Mapped[str] = mapped_column(String(150))
    mensaje: Mapped[str] = mapped_column(Text)
    media_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    estado: Mapped[str] = mapped_column(String(50), default="pending") # 'pending' (programada para el futuro) o 'sent' (activa)
    fecha_programada: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    destinatario_tipo: Mapped[str] = mapped_column(String(50)) # 'all', 'no_bet', 'bankrupt', 'specific'
    destinatario_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=True)
    config_boletin: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        CheckConstraint("estado IN ('pending', 'sent')", name="check_estado_notif"),
        CheckConstraint("destinatario_tipo IN ('all', 'no_bet', 'bankrupt', 'specific')", name="check_destinatario_tipo"),
    )

class NotificacionLeida(Base):
    """
    Registro de Confirmación de Lectura por Usuario.
    
    Para las notificaciones de difusión colectiva ('destinatario_tipo == "all"'), cada jugador debe
    marcar la notificación como leída de forma independiente para que el frontend no vuelva a
    desplegar el modal emergente en sus próximas sesiones.
    'uq_usuario_notificacion_leida' asegura que no se registren lecturas duplicadas.
    """
    __tablename__ = "notificaciones_leidas"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    notificacion_id: Mapped[int] = mapped_column(ForeignKey("notificaciones_admin.id", ondelete="CASCADE"))
    fecha_leida: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("usuario_id", "notificacion_id", name="uq_usuario_notificacion_leida"),
    )
