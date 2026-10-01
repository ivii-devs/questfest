import asyncio
import logging
import os
import sys

# En sistemas operativos Windows, el bucle de eventos por defecto desde Python 3.8 es ProactorEventLoop (IOCP).
# Cuando se gestionan conexiones asíncronas remotas seguras (TLS/SSL) o pools con proxies como PgBouncer/Supavisor,
# ProactorEventLoop sufre frecuentemente desconexiones silenciosas con el error OSError [WinError 64]
# ("El nombre de red especificado ya no está disponible").
# Establecer explícitamente WindowsSelectorEventLoopPolicy solventa esta inestabilidad de red en Windows.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.routers import (
    admin,
    apuestas,
    duelos,
    groups,
    kits,
    misiones,
    notifications,
    public_profile,
    publicaciones,
    ranking,
    ruleta,
    settings,
    upload,
    users,
)
from app.core.cloudinary_config import init_cloudinary
from app.core.exceptions import (
    ConflictError,
    DomainException,
    EntityNotFoundError,
    InsufficientBalanceError,
    InvalidStateTransitionError,
    PermissionDeniedError,
    UnauthorizedError,
)
from app.core.rate_limiter import limiter

app = FastAPI(title="QuestFest API")

# Registrar el Rate Limiter en la aplicación.
# El limitador está configurado con la función extractora segura 'get_real_client_ip' (app.core.rate_limiter),
# lo cual garantiza que tras operar detrás del proxy inverso Nginx, la cuota de peticiones se compute
# de forma individual por cada IP de cliente real y no de manera compartida bajo la IP del contenedor proxy.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logging.getLogger("uvicorn.error").error(
        f"[422 Validation Error] Path: {request.url.path} | Errors: {exc.errors()} | Body: {exc.body}"
    )
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(exc.errors())})


@app.exception_handler(EntityNotFoundError)
async def entity_not_found_handler(request: Request, exc: EntityNotFoundError):
    return JSONResponse(status_code=404, content={"detail": exc.message})


@app.exception_handler(InsufficientBalanceError)
async def insufficient_balance_handler(request: Request, exc: InsufficientBalanceError):
    return JSONResponse(status_code=400, content={"detail": exc.message})


@app.exception_handler(InvalidStateTransitionError)
async def invalid_state_handler(request: Request, exc: InvalidStateTransitionError):
    return JSONResponse(status_code=400, content={"detail": exc.message})


@app.exception_handler(PermissionDeniedError)
async def permission_denied_handler(request: Request, exc: PermissionDeniedError):
    return JSONResponse(status_code=403, content={"detail": exc.message})


@app.exception_handler(UnauthorizedError)
async def unauthorized_handler(request: Request, exc: UnauthorizedError):
    return JSONResponse(status_code=401, content={"detail": exc.message})


@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError):
    return JSONResponse(status_code=400, content={"detail": exc.message})


@app.exception_handler(DomainException)
async def domain_exception_handler(request: Request, exc: DomainException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


# Inicializar servicios externos (almacenamiento de imágenes y media en la nube)
init_cloudinary()


# Middleware para Cabeceras de Seguridad HTTP
# Aplicamos una capa defensiva estándar para proteger la API y mitigar ataques comunes en la web:
# - X-Frame-Options DENY: Impide que la aplicación sea embebida en <iframe>, anulando ataques de Clickjacking.
# - X-Content-Type-Options nosniff: Obliga al navegador a respetar los tipos MIME declarados (previene XSS por confusión de tipos).
# - Referrer-Policy: Controla la fuga de URLs en cabeceras de referencia hacia orígenes externos.
# - Strict-Transport-Security (HSTS): En producción exige conexiones HTTPS estrictas durante 1 año, requisito indispensable para PWA e iOS.
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        if os.getenv("ENVIRONMENT") == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Configuración CORS para desarrollo y producción:
# En producción leemos ALLOWED_ORIGINS desde el entorno (.env).
# En desarrollo local usamos una expresión regular que permite cualquier IP privada de red local (RFC 1918) en el puerto 3000.
# ¿Por qué esta regex? Porque permite conectar un smartphone físico (iPhone o Android) a la misma red Wi-Fi y probar
# la PWA en tiempo real contra el backend de desarrollo sin tener que reconfigurar variables de entorno cada vez que cambia la IP del router.
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+):3000$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Integración de Controladores (Routers)
# Cada router encapsula un dominio del sistema (autenticación, economía, duelos, muro social, etc.)
app.include_router(users.router, prefix="/api/auth", tags=["Auth & Users"])
app.include_router(public_profile.router, prefix="/api/users", tags=["Public Profile"])
app.include_router(apuestas.router, prefix="/api/apuestas", tags=["Apuestas & Motor Económico"])
app.include_router(duelos.router, prefix="/api/duelos", tags=["Duelos 1vs1"])
app.include_router(misiones.router, prefix="/api/misiones", tags=["Tablón de Misiones"])
app.include_router(ruleta.router, prefix="/api/ruleta", tags=["Ruleta Diaria"])
app.include_router(admin.router, prefix="/api/admin", tags=["Panel de Administración"])
app.include_router(publicaciones.router, prefix="/api/feed", tags=["Muro Social / Cotilleos"])
app.include_router(settings.router, prefix="/api/settings", tags=["Ajustes y Reglas"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(upload.router, prefix="/api/upload", tags=["Uploads"])
app.include_router(ranking.router, prefix="/api/ranking", tags=["Ranking"])
app.include_router(groups.router, prefix="/api/groups", tags=["Grupos"])
app.include_router(groups.router, prefix="/api/v1/grupos", tags=["Grupos (v1)"])
app.include_router(kits.router, prefix="/api/v1/kits", tags=["Kits de Eventos (v1)"])
app.include_router(kits.router, prefix="/api/kits", tags=["Kits de Eventos"])


@app.get("/")
def read_root():
    """Endpoint de comprobación de salud básica (Health Check) para verificar que el servicio FastAPI está en línea."""
    return {"message": "API Backend QuestFest Activa"}
