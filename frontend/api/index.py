"""
Punto de Entrada Serverless para Vercel (cuando el Root Directory es 'frontend')
=============================================================================
Permite que Vercel detecte y compile la función Serverless de FastAPI cuando el
proyecto se configura con Root Directory apuntando a 'frontend' en el panel de Vercel.
"""

import sys
from pathlib import Path

# Localizar la carpeta 'backend' en la raíz del repositorio
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent.parent
backend_dir = project_root / "backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app  # noqa: E402
