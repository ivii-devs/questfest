from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Usuario(Base):
    """
    Entidad Central de Identidad y Cuenta de Usuario en QuestFest.

    Gestiona las credenciales de acceso, el perfil público, los roles de plataforma y
    la cuenta económica global (QuestCoins).

    Principios de Integridad Contable:
    - 'check_saldo_positivo': Restricción a nivel de motor de base de datos (CheckConstraint).
      Garantiza que bajo NINGUNA circunstancia concurrente un usuario pueda quedar con saldo negativo.
      Cualquier débito que supere los fondos disponibles hará que PostgreSQL aborte la transacción
      con un IntegrityError, forzando un rollback automático en FastAPI.
    """

    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    rol: Mapped[str] = mapped_column(
        String(20)
    )  # 'admin' (plataforma global) o 'player' (jugador regular)
    saldo_actual: Mapped[int] = mapped_column(Integer, default=0)
    bio: Mapped[str] = mapped_column(String(150), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        CheckConstraint("rol IN ('admin', 'player')", name="check_rol_valido"),
        CheckConstraint("saldo_actual >= 0", name="check_saldo_positivo"),
    )

    # Relaciones Relacionales (Lazy loading mediante strings para prevenir dependencias circulares en SQLAlchemy)
    transacciones: Mapped[List["LedgerTransaccion"]] = relationship(
        back_populates="usuario", cascade="all, delete-orphan"
    )
    ruletas: Mapped[List["RegistroRuleta"]] = relationship(
        back_populates="usuario", cascade="all, delete-orphan"
    )
    publicaciones: Mapped[List["Publicacion"]] = relationship(
        back_populates="autor", cascade="all, delete-orphan"
    )
    misiones_creadas: Mapped[List["Mision"]] = relationship(
        back_populates="creador", cascade="all, delete-orphan"
    )
    apuestas_creadas: Mapped[List["Apuesta"]] = relationship(
        back_populates="creador", cascade="all, delete-orphan"
    )

    # Duelos: Al tener dos claves foráneas apuntando a la misma tabla 'usuarios' (retador vs retado),
    # SQLAlchemy exige especificar foreign_keys de forma explícita en ambas direcciones.
    duelos_retador: Mapped[List["Duelo"]] = relationship(
        "Duelo",
        foreign_keys="Duelo.retador_id",
        back_populates="retador",
        cascade="all, delete-orphan",
    )
    duelos_retado: Mapped[List["Duelo"]] = relationship(
        "Duelo",
        foreign_keys="Duelo.retado_id",
        back_populates="retado",
        cascade="all, delete-orphan",
    )


class LedgerTransaccion(Base):
    """
    Libro Mayor Inmutable (Ledger) de Auditoría Económica.

    Cada movimiento de QuestCoins (ganancia en apuestas, resolución de duelos, recompensas de misiones,
    penalizaciones o compras) genera un registro inmutable en esta tabla.

    ¿Por qué 'saldo_resultante'?
    Almacenar una instantánea (snapshot) del saldo inmediatamente posterior a la transacción permite
    reconstruir el historial cronológico y auditar discrepancias al instante, sin necesidad de recalcular
    la suma acumulada de miles de transacciones pasadas mediante consultas costosas ('SUM() OVER').

    ¿Por qué 'grupo_id' es opcional?
    Permite asociar la transacción al balance específico de una comunidad/evento (economía local)
    o dejarlo en 'NULL' para movimientos de la cuenta global del usuario.
    """

    __tablename__ = "ledger_transacciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    grupo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("grupos.id", ondelete="CASCADE"), index=True, nullable=True
    )
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), index=True
    )
    cantidad: Mapped[int] = mapped_column(
        Integer
    )  # Positivo para ingresos, negativo para débitos/gastos
    concepto: Mapped[str] = mapped_column(String(255))
    saldo_resultante: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    usuario: Mapped["Usuario"] = relationship(back_populates="transacciones")
