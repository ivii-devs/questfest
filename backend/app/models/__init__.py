from app.models.base import Base
from app.models.usuario import Usuario, LedgerTransaccion
from app.models.juegos import RegistroRuleta, Apuesta, Duelo, TicketApuesta
from app.models.misiones import Mision, PruebaMision, VotoMision, MisionRuletaAceptada
from app.models.publicaciones import Publicacion
from app.models.configuracion import ConfiguracionGlobal
from app.models.notificaciones import NotificacionAdmin, NotificacionLeida
from app.models.push import PushSubscription
from app.models.audit import AuditLog
from app.models.grupo import Grupo, MiembroGrupo

# Exponemos formalmente todas las entidades de dominio para que tanto Alembic
# como las consultas dinámicas reconozcan la totalidad del catálogo relacional.
__all__ = [
    "Base",
    "Usuario",
    "LedgerTransaccion",
    "RegistroRuleta",
    "Apuesta",
    "Duelo",
    "TicketApuesta",
    "Mision",
    "PruebaMision",
    "VotoMision",
    "MisionRuletaAceptada",
    "Publicacion",
    "ConfiguracionGlobal",
    "NotificacionAdmin",
    "NotificacionLeida",
    "PushSubscription",
    "AuditLog",
    "Grupo",
    "MiembroGrupo",
]

