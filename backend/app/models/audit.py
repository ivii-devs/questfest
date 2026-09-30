from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AuditLog(Base):
    """
    Pista Inmutable de Auditoría para Acciones Administrativas (Audit Trail).

    ¿Por qué existe esta tabla?
    En un entorno gamificado con economía de tokens, los administradores poseen poderes discrecionales
    (modificar balances de saldo, arbitrar duelos disputados, imponer multas o validar pruebas dudosas).
    Para prevenir abusos de poder y mantener la transparencia, cada intervención manual de un administrador
    queda registrada cronológicamente e indexada para su posterior inspección.

    Campos de Rastreo:
    - 'admin_id': Identificador del usuario con rol de administrador que ejecutó la acción.
    - 'accion': Nombre del comando operativo (ej. 'update_user_balance', 'resolve_duel', 'approve_proof').
    - 'entidad' / 'entidad_id': Recurso sobre el que impactó la acción ('usuario', 'duelo', 'mision').
    - 'detalles': Objeto JSONB con los metadatos contextuales (valores anteriores, nuevos valores, motivo de la multa).
    """

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    grupo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("grupos.id", ondelete="CASCADE"), index=True, nullable=True
    )
    admin_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    accion: Mapped[str] = mapped_column(String(100), index=True)
    entidad: Mapped[str] = mapped_column(String(50), index=True)
    entidad_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    detalles: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    admin: Mapped["Usuario"] = relationship()
