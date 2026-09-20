"""
Punto de Entrada Serverless para Vercel: QuestFest API
======================================================
Este archivo expone la instancia ASGI 'app' de FastAPI para que el runtime
Serverless de Vercel (Python Function) sirva las peticiones entrantes a /api/*.

Añade el directorio 'backend' a 'sys.path' para que todas las importaciones
del proyecto ('app.core', 'app.api', 'app.models', etc.) se resuelvan de forma
nativa y transparente sin alterar la estructura original de carpetas.
"""

import sys
from pathlib import Path

# Resolver la ruta absoluta de la carpeta 'backend' e insertarla al inicio de sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Importar la aplicación FastAPI ya configurada
from app.main import app  # noqa: E402
