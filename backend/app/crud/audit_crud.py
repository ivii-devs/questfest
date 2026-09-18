from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.models.audit import AuditLog

async def log_admin_action(
    db: AsyncSession,
    admin_id: int,
    action: str,
    entity: str,
    entity_id: Optional[int] = None,
    details: Optional[dict] = None
) -> AuditLog:
    """
    Registra una acción administrativa en la tabla audit_logs para trazabilidad.
    """
    log_entry = AuditLog(
        admin_id=admin_id,
        accion=action,
        entidad=entity,
        entidad_id=entity_id,
        detalles=details
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)
    return log_entry
