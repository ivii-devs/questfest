"""
================================================================================
GENERADOR CRIPTOGRÁFICO DE CÓDIGOS DE INVITACIÓN (CSPRNG): QuestFest
================================================================================
Encapsula la lógica de generación aleatoria segura mediante el módulo 'secrets'.
Diseñado específicamente para códigos de acceso de comunidades en entornos móviles:
- Excluye caracteres ópticamente ambiguos ('I', '1', 'O', '0').
- Prefijo reconocible 'QF-' para validación en expresiones regulares.
- Prevención de colisiones mediante verificación asíncrona en la base de datos.
================================================================================
"""

import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainException
from app.models.grupo import Grupo

# Alfabeto no ambiguo: 32 caracteres (evita confusión visual en pantallas móviles)
SAFE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_random_code(length: int = 6) -> str:
    """
    Genera una cadena alfanumérica de longitud fija utilizando un generador
    criptográficamente seguro (CSPRNG).
    """
    return "".join(secrets.choice(SAFE_ALPHABET) for _ in range(length))


async def generate_unique_group_code(db: AsyncSession) -> str:
    """
    Genera un código con prefijo 'QF-' asegurando unicidad en PostgreSQL.
    Reintenta hasta 10 veces en el caso improbable de colisión probabilística.
    """
    for _ in range(10):
        candidate_code = f"QF-{generate_random_code(5)}"
        existing = await db.scalar(select(Grupo).where(Grupo.codigo_unico == candidate_code))
        if not existing:
            return candidate_code

    raise DomainException(
        "No se pudo generar un código único para el grupo tras múltiples intentos."
    )
