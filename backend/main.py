"""
Punto de entrada canónico para el servicio Backend (FastAPI).
Utilizado por Vercel Services y servidores ASGI estándar (Uvicorn).
"""

from app.main import app

# Exportación directa para auto-detección de frameworks ASGI
__all__ = ["app"]
