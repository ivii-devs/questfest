"""
================================================================================
ESQUEMAS PYDANTIC: KITS DE EVENTOS Y PRESETS (QuestFest)
================================================================================
Define los contratos de entrada/salida para el catálogo de kits, serialización del
campo JSONB 'contenido', gestión de me gusta, denuncias ciudadanas y la inyección
atómica en comunidades multi-tenant.
================================================================================
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


# ==============================================================================
# Sub-estructuras del Campo JSONB 'contenido'
# ==============================================================================

class MisionKitItem(BaseModel):
    """Reto individual empaquetado para el tablón común."""
    model_config = ConfigDict(from_attributes=True)

    titulo: str = Field(..., min_length=3, max_length=150, description="Título del reto")
    descripcion: str = Field(..., min_length=3, description="Detalle y reglas de completitud")
    dificultad: str = Field("media", description="Nivel: facil, media, dificil")
    recompensa_sugerida: int = Field(25, ge=1, description="QuestCoins recomendadas (calibradas con saldo 100 QC)")
    cupo_maximo: Optional[int] = Field(None, ge=1, description="Límite de ganadores o null para ilimitado")


class RuletaKitItem(BaseModel):
    """Misión secreta individual empaquetada para el bombo de tiradas diarias."""
    model_config = ConfigDict(from_attributes=True)

    titulo: str = Field(..., min_length=3, max_length=150, description="Título del reto secreto")
    descripcion: str = Field(..., min_length=3, description="Detalle de la hazaña")
    dificultad: str = Field("media", description="Nivel: facil, media, dificil")
    recompensa_sugerida: int = Field(25, ge=1, description="QuestCoins otorgadas al superar el reto")


class OpcionApuestaKit(BaseModel):
    """Opción o resultado con cuota asociada para un mercado de predicción."""
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Identificador corto de la opción (ej: opt1)")
    text: str = Field(..., min_length=1, max_length=150, description="Texto visible o arquetipo")
    multiplier: float = Field(2.0, ge=1.01, description="Cuota multiplicadora para el cálculo de ganancias")


class ApuestaKitItem(BaseModel):
    """Mercado de predicción empaquetado con arquetipos configurables."""
    model_config = ConfigDict(from_attributes=True)

    titulo: str = Field(..., min_length=3, max_length=200, description="Pregunta o evento a pronosticar")
    opciones: List[OpcionApuestaKit] = Field(..., min_length=2, description="Al menos dos opciones posibles")


class ContenidoKitSchema(BaseModel):
    """Contenedor polimórfico del contenido JSONB persistido en KitEvento."""
    model_config = ConfigDict(from_attributes=True)

    misiones: List[MisionKitItem] = Field(default_factory=list)
    ruletas: List[RuletaKitItem] = Field(default_factory=list)
    apuestas: List[ApuestaKitItem] = Field(default_factory=list)


# ==============================================================================
# Operaciones CRUD sobre Kits de Eventos
# ==============================================================================

class KitCreateRequest(BaseModel):
    """Payload para dar de alta un nuevo Kit (desde cero o empaquetado desde grupo)."""
    titulo: str = Field(..., min_length=3, max_length=150)
    descripcion: str = Field(..., min_length=5)
    categoria: str = Field(..., min_length=2, max_length=50)
    icono_url: Optional[str] = None
    es_publico: bool = True
    es_oficial: bool = False
    contenido: ContenidoKitSchema


class KitUpdateRequest(BaseModel):
    """Payload para actualizar metadatos o contenido de un Kit existente."""
    titulo: Optional[str] = Field(None, min_length=3, max_length=150)
    descripcion: Optional[str] = Field(None, min_length=5)
    categoria: Optional[str] = Field(None, min_length=2, max_length=50)
    icono_url: Optional[str] = None
    es_publico: Optional[bool] = None
    contenido: Optional[ContenidoKitSchema] = None


class KitResponse(BaseModel):
    """Representación pública o de catálogo para un Kit de Eventos."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    descripcion: str
    categoria: str
    icono_url: Optional[str] = None
    autor_id: Optional[int] = None
    autor_username: Optional[str] = None
    es_oficial: bool
    es_publico: bool
    descargas_count: int
    likes_count: int
    is_liked_by_user: bool = False
    total_misiones: int = 0
    total_ruletas: int = 0
    total_apuestas: int = 0
    contenido: ContenidoKitSchema
    fecha_creacion: datetime


class KitLikeResponse(BaseModel):
    """Resultado del toggle de me gusta."""
    liked: bool
    likes_count: int


class KitReportRequest(BaseModel):
    """Motivo remitido al denunciar un kit de la comunidad."""
    motivo: str = Field(..., min_length=3, max_length=500)


# ==============================================================================
# Asistente de Inyección Atómica en Grupos
# ==============================================================================

class InyeccionMisionItem(BaseModel):
    """Misión seleccionada y opcionalmente adaptada por el anfitrión."""
    titulo: str = Field(..., min_length=3, max_length=150)
    descripcion: str = Field(..., min_length=3)
    recompensa: int = Field(25, ge=1)
    cupo_maximo: Optional[int] = None


class InyeccionRuletaItem(BaseModel):
    """Misión de ruleta diaria seleccionada para el bombo del grupo."""
    titulo: str = Field(..., min_length=3, max_length=150)
    descripcion: str = Field(..., min_length=3)
    recompensa: int = Field(25, ge=1)


class InyeccionApuestaItem(BaseModel):
    """Apuesta con arquetipos reasignados a miembros reales del grupo."""
    titulo: str = Field(..., min_length=3, max_length=200)
    opciones: List[OpcionApuestaKit] = Field(..., min_length=2)


class InyeccionKitRequest(BaseModel):
    """
    Payload consolidado enviado por el modal de personalización inline.
    Permite filtrar ítems, alterar textos o importes y decidir si nacen activas o propuestas.
    """
    kit_id: Optional[int] = None
    publicar_inmediatamente: bool = True
    misiones_seleccionadas: List[InyeccionMisionItem] = Field(default_factory=list)
    ruletas_seleccionadas: List[InyeccionRuletaItem] = Field(default_factory=list)
    apuestas_seleccionadas: List[InyeccionApuestaItem] = Field(default_factory=list)


class InyeccionKitResponse(BaseModel):
    """Resumen de la inyección atómica ejecutada en el grupo."""
    misiones_creadas: int
    ruletas_creadas: int
    apuestas_creadas: int
    estado_asignado: str
    mensaje: str
