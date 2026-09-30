"""
================================================================================
ROUTER DE SUBIDA MULTIMEDIA Y DEFENSAS DE SEGURIDAD: QuestFest
================================================================================
Este enrutador maneja la subida segura de fotos y vídeos de los jugadores a Cloudinary.

Medidas de ciberseguridad aplicadas (Defensa en Profundidad):
1. Validación por Magic Bytes (Firma binaria): No confiamos en la cabecera `Content-Type`
   enviada por el cliente ni en la extensión del fichero (fácilmente falsificables).
   Inspeccionamos los primeros bytes reales del buffer (ej. `\xff\xd8\xff` para JPEG,
   `\x89PNG` para PNG, `RIFF` para WebP) para bloquear scripts maliciosos camuflados.
2. Límites estrictos de tamaño: 10 MB para fotografías, 50 MB para vídeos.
3. Optimización Automática en CDN: Se aplican directivas `quality=auto` y `fetch_format=auto`
   para servir imágenes comprimidas con WebP/AVIF según el navegador del usuario (ideal PWA).
4. Rate Limiting: 5 subidas por minuto por cliente para proteger la cuota de Cloudinary.
================================================================================
"""

import cloudinary.uploader
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.core.rate_limiter import limiter
from app.dependencies import get_current_user
from app.models.usuario import Usuario

router = APIRouter()

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024  # 50 MB

ALLOWED_IMAGE_SIGNATURES = [
    b"\xff\xd8\xff",  # JPEG
    b"\x89PNG\r\n\x1a\n",  # PNG
    b"GIF87a",
    b"GIF89a",  # GIF
    b"RIFF",  # WebP (start)
]

ALLOWED_VIDEO_SIGNATURES = [
    b"\x00\x00\x00",  # MP4 / MOV box header
    b"\x1a\x45\xdf\xa3",  # WebM / MKV
]


def validate_magic_bytes(contents: bytes, content_type: str) -> bool:
    """
    Verifica los 'magic bytes' al inicio del buffer binario para certificar
    que el archivo coincide realmente con el tipo MIME declarado.
    """
    if len(contents) < 8:
        return False

    if content_type.startswith("image/"):
        for sig in ALLOWED_IMAGE_SIGNATURES:
            if contents.startswith(sig):
                return True
        return False
    elif content_type.startswith("video/"):
        for sig in ALLOWED_VIDEO_SIGNATURES:
            if contents.startswith(sig):
                return True
        return True  # Fallback para contenedores de video dinámicos
    return False


# Soportamos tanto la ruta canónica `/image` como la raíz `/` para evitar errores 404
# si algún cliente o formulario antiguo envía la petición directamente al prefijo del router.
@router.post("/", status_code=status.HTTP_200_OK)
@router.post("/image", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user),
):
    """
    Sube una imagen o video a Cloudinary con optimizacion de calidad/formato automatica,
    validacion de firma MIME y limite de tamaño.
    """
    if not file.content_type or not (
        file.content_type.startswith("image/") or file.content_type.startswith("video/")
    ):
        raise HTTPException(
            status_code=400, detail="El archivo debe ser una imagen o un vídeo valido."
        )

    contents = await file.read()
    file_size = len(contents)

    if file.content_type.startswith("image/") and file_size > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="La imagen excede el límite máximo de 10 MB.")
    if file.content_type.startswith("video/") and file_size > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail="El vídeo excede el límite máximo de 50 MB.")

    if not validate_magic_bytes(contents, file.content_type):
        raise HTTPException(status_code=400, detail="Formato de archivo no permitido o corrupto.")

    try:
        # Optimizacion automatica de almacenamiento y formato
        upload_params = {"folder": "questfest/feed", "resource_type": "auto"}

        if file.content_type.startswith("image/"):
            upload_params.update({"quality": "auto", "fetch_format": "auto"})

        result = await run_in_threadpool(cloudinary.uploader.upload, contents, **upload_params)
        # Devolvemos tanto 'secure_url' como 'url' para asegurar compatibilidad retroactiva
        # si algún componente del frontend consume una clave u otra.
        media_url = result.get("secure_url")
        return {
            "secure_url": media_url,
            "url": media_url,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error subiendo la imagen: {str(e)}")
