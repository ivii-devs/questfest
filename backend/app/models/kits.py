"""
================================================================================
MODELOS DE KITS DE EVENTOS Y PRESETS (QuestFest)
================================================================================
Este módulo implementa las entidades de persistencia para los Kits de Eventos:
1. KitEvento: Plantilla reutilizable que empaqueta misiones, ruletas y apuestas
   para resolver el Cold Start Problem en la creación o dinamización de comunidades.
2. KitLike: Registro único por usuario que audita la popularidad comunitaria del kit.
3. KitReporte: Registro de auditoría y moderación para denuncias ciudadanas sin censura ciega.
================================================================================
"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.usuario import Usuario


class KitEvento(Base):
    """
    Entidad Central de Kit / Plantilla de Evento.

    Propósito de Negocio:
    Permite a los anfitriones inicializar grupos de amigos en cuestión de segundos
    con un catálogo prediseñado de retos, misiones de ruleta y apuestas temáticas.
    
    Inmutabilidad de Inyecciones:
    Los kits funcionan como 'moldes'. Cuando un anfitrión inyecta un kit en su grupo,
    se generan registros independientes de Mision y Apuesta en dicho grupo. Si el kit
    original es modificado o eliminado posteriormente, las entidades del grupo
    permanecen intactas garantizando la soberanía de datos del evento.
    """

    __tablename__ = "kits_eventos"

    id: Mapped[int] = mapped_column(primary_key=True)
    titulo: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    categoria: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    icono_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Si el autor elimina su cuenta personal, el kit de la comunidad o del sistema
    # no se destruye, sino que se desvincula para preservar el catálogo activo.
    autor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True, index=True
    )
    
    # Diferencia kits verificados por la plataforma de creaciones libres de la comunidad
    es_oficial: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Permite kits privados ("Solo para mí") o públicos en la pestaña de Comunidad
    es_publico: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    descargas_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Estructura JSONB del kit: {"misiones": [...], "ruletas": [...], "apuestas": [...]}
    contenido: Mapped[dict] = mapped_column(JSONB, nullable=False)
    
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relaciones ORM
    autor: Mapped[Optional["Usuario"]] = relationship("Usuario", foreign_keys=[autor_id])
    likes: Mapped[List["KitLike"]] = relationship(
        "KitLike",
        back_populates="kit",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    reportes: Mapped[List["KitReporte"]] = relationship(
        "KitReporte",
        back_populates="kit",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class KitLike(Base):
    """
    Registro Relacional de Voto Positivo (Like) en un Kit.

    Regla de Negocio:
    Garantiza que un usuario solo pueda otorgar un 'Me Gusta' por cada kit mediante
    la restricción de unicidad compuesta ('kit_id', 'usuario_id'). La llamada al endpoint
    actúa como un 'toggle' idempotente (si ya existe se elimina, si no existe se crea).
    """

    __tablename__ = "kits_likes"

    id: Mapped[int] = mapped_column(primary_key=True)
    kit_id: Mapped[int] = mapped_column(
        ForeignKey("kits_eventos.id", ondelete="CASCADE"), index=True, nullable=False
    )
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), index=True, nullable=False
    )
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    kit: Mapped["KitEvento"] = relationship("KitEvento", back_populates="likes")
    usuario: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[usuario_id])

    __table_args__ = (
        UniqueConstraint("kit_id", "usuario_id", name="uq_kit_usuario_like"),
    )


class KitReporte(Base):
    """
    Registro de Denuncia o Reporte de Contenido en un Kit Comunitario.

    Política Anti-Censura Ciega:
    Para prevenir sabotajes o denuncias coordinadas maliciosas entre usuarios rivales,
    el kit reportado NO se oculta automáticamente. Queda registrado en esta tabla
    para que los administradores globales inspeccionen el motivo y decidan la acción disciplinaria.
    """

    __tablename__ = "kits_reportes"

    id: Mapped[int] = mapped_column(primary_key=True)
    kit_id: Mapped[int] = mapped_column(
        ForeignKey("kits_eventos.id", ondelete="CASCADE"), index=True, nullable=False
    )
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), index=True, nullable=False
    )
    motivo: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    kit: Mapped["KitEvento"] = relationship("KitEvento", back_populates="reportes")
    usuario: Mapped["Usuario"] = relationship("Usuario", foreign_keys=[usuario_id])
