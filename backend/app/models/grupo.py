from sqlalchemy import Integer, String, Text, Boolean, CheckConstraint, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
from typing import Optional, List

from app.models.base import Base

class Grupo(Base):
    """
    Modelo de Multi-Tenancy para Grupos y Comunidades Independientes.
    
    ¿Qué problema resuelve este modelo?
    QuestFest permite que múltiples grupos de amigos o eventos independientes coexistan en la misma
    plataforma sin mezclar sus economías. Cada grupo tiene su propio muro social, sus apuestas particulares,
    sus misiones locales y su propia tabla de clasificación (ranking).
    
    Decisiones de Diseño:
    - 'codigo_unico': Código alfanumérico corto (ej. 'QF-ABC12') que actúa como enlace de invitación portable.
    - 'password_hash': Contraseña opcional para comunidades privadas. Si requiere clave, se valida en '/join'.
    - 'creador_id (SET NULL)': Si el usuario fundador decide borrar su cuenta personal, el grupo NO se destruye
      para no perjudicar al resto de miembros activos del evento.
    - 'saldo_inicial': Fondo de bienvenida (típicamente 100 QuestCoins) entregado a cada nuevo miembro al unirse.
    """
    __tablename__ = "grupos"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo_unico: Mapped[str] = mapped_column(String(12), unique=True, index=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icono_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    requiere_password: Mapped[bool] = mapped_column(Boolean, default=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    saldo_inicial: Mapped[int] = mapped_column(Integer, default=100)
    creador_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relaciones
    creador = relationship("Usuario", foreign_keys=[creador_id])
    miembros: Mapped[List["MiembroGrupo"]] = relationship("MiembroGrupo", back_populates="grupo", cascade="all, delete-orphan")


class MiembroGrupo(Base):
    """
    Tabla Intermedia de Membresía con Estado Económico y Jerarquía Local.
    
    Aislamiento Contable y de Permisos:
    - 'saldo_grupo': El saldo de QuestCoins que el jugador posee DENTRO de esta comunidad concreta.
      Ganar o perder tokens en el 'Grupo A' no afecta en absoluto su balance en el 'Grupo B'.
    - 'check_saldo_grupo_positivo': Restricción a nivel de base de datos que garantiza matemáticamente
      que las apuestas o duelos locales no dejen al usuario con saldo negativo en ningún grupo.
    - 'rol': 'admin' (líder del evento con potestad para moderar y resolver) o 'member' (participante).
    - 'uq_miembro_grupo': Clave única compuesta que impide que un usuario se inscriba por duplicado en el mismo grupo.
    """
    __tablename__ = "miembros_grupo"

    id: Mapped[int] = mapped_column(primary_key=True)
    grupo_id: Mapped[int] = mapped_column(ForeignKey("grupos.id", ondelete="CASCADE"), index=True, nullable=False)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True, nullable=False)
    rol: Mapped[str] = mapped_column(String(20), default="member", nullable=False)
    saldo_grupo: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    fecha_union: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("grupo_id", "usuario_id", name="uq_miembro_grupo"),
        CheckConstraint("rol IN ('admin', 'member')", name="check_rol_grupo_valido"),
        CheckConstraint("saldo_grupo >= 0", name="check_saldo_grupo_positivo"),
    )

    # Relaciones
    grupo: Mapped["Grupo"] = relationship("Grupo", back_populates="miembros")
    usuario = relationship("Usuario", foreign_keys=[usuario_id])
