from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.usuario import Usuario


class Publicacion(Base):
    """
    Entidad del Muro Social y Línea Temporal de Actividad (Feed).

    ¿Qué representa este modelo?
    Es el espacio de interacción y cotilleo de la comunidad, combinando mensajes redactados
    por los usuarios con anuncios automáticos emitidos por los eventos del sistema.

    Características Técnicas de Diseño:
    - Jerarquía de Respuestas (Patrón Adjacency List): 'parent_id' referencia a la misma tabla 'publicaciones.id'.
      Si 'parent_id' es NULL, es una publicación principal; si contiene un ID, es una respuesta o comentario anidado.
    - 'tipo': Clasifica la naturaleza del mensaje ('social', 'apuesta', 'mision', 'duelo') para que la interfaz
      pueda renderizar insignias temáticas y estilos específicos de tarjeta.
    - 'es_sistema': 'True' cuando el mensaje es generado por el motor del juego (ej. proclamación de victoria en duelo
      o publicación de un nuevo boletín diario) y 'False' cuando procede de un jugador humano.
    """

    __tablename__ = "publicaciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    grupo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("grupos.id", ondelete="CASCADE"), index=True, nullable=True
    )
    tipo: Mapped[str] = mapped_column(String(50))
    autor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=True
    )
    contenido: Mapped[str] = mapped_column(Text)
    media_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    es_sistema: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("publicaciones.id", ondelete="CASCADE"), nullable=True
    )

    autor: Mapped["Usuario"] = relationship(back_populates="publicaciones")
    respuestas: Mapped[list["Publicacion"]] = relationship(
        "Publicacion", back_populates="parent", cascade="all, delete-orphan"
    )
    parent: Mapped[Optional["Publicacion"]] = relationship(
        "Publicacion", back_populates="respuestas", remote_side=[id]
    )

    __table_args__ = (
        CheckConstraint(
            "tipo IN ('social', 'apuesta', 'mision', 'duelo')", name="check_tipo_publicacion"
        ),
    )
