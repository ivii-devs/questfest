"""
================================================================================
JERARQUÍA DE EXCEPCIONES DE DOMINIO: QuestFest
================================================================================
Aísla la capa de persistencia (CRUD) y los servicios de dominio del protocolo HTTP.
Siguiendo Clean Architecture y Separation of Concerns, las funciones de acceso
a datos y reglas de negocio no importan 'fastapi.HTTPException' directamente.
Lanzan excepciones de dominio semánticas que derivan de DomainException.
Al heredar de HTTPException en su infraestructura base, se garantiza
interoperabilidad con la suite de pruebas automatizadas y los manejadores de FastAPI.
================================================================================
"""

from fastapi import HTTPException, status


class DomainException(HTTPException):
    """Excepción base para cualquier error de regla de negocio o dominio."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=message)
        self.message = message


class EntityNotFoundError(DomainException):
    """El recurso o entidad solicitada no existe en la base de datos (HTTP 404)."""

    def __init__(self, message: str = "Recurso no encontrado"):
        super().__init__(message=message, status_code=status.HTTP_404_NOT_FOUND)


class InsufficientBalanceError(DomainException):
    """El usuario no posee suficientes QuestCoins para ejecutar la transacción (HTTP 400)."""

    def __init__(self, message: str = "Saldo insuficiente para realizar la operación."):
        super().__init__(message=message, status_code=status.HTTP_400_BAD_REQUEST)


class InvalidStateTransitionError(DomainException):
    """Se intentó realizar una transición de estado inválida en una apuesta, reto o misión (HTTP 400)."""

    def __init__(self, message: str = "Transición de estado inválida."):
        super().__init__(message=message, status_code=status.HTTP_400_BAD_REQUEST)


class PermissionDeniedError(DomainException):
    """El usuario no posee los privilegios requeridos o viola la soberanía de la comunidad (HTTP 403)."""

    def __init__(self, message: str = "Permiso denegado."):
        super().__init__(message=message, status_code=status.HTTP_403_FORBIDDEN)


class UnauthorizedError(DomainException):
    """El usuario o credencial proporcionada no es válida (HTTP 401)."""

    def __init__(self, message: str = "No autorizado."):
        super().__init__(message=message, status_code=status.HTTP_401_UNAUTHORIZED)


class ConflictError(DomainException):
    """Conflicto con un recurso existente o clave duplicada (HTTP 400)."""

    def __init__(self, message: str = "Conflicto con recurso existente."):
        super().__init__(message=message, status_code=status.HTTP_400_BAD_REQUEST)
