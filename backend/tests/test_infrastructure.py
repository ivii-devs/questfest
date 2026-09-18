import pytest
from starlette.requests import Request
from app.core.database import normalize_database_url
from app.core.rate_limiter import get_real_client_ip

def test_normalize_database_url_postgres_prefix():
    """
    Verifica que las URLs inyectadas con el prefijo heredado 'postgres://'
    se conviertan automáticamente al driver asíncrono 'postgresql+asyncpg://'.
    """
    raw_url = "postgres://user:secret@localhost:5432/questfest"
    expected = "postgresql+asyncpg://user:secret@localhost:5432/questfest"
    assert normalize_database_url(raw_url) == expected

def test_normalize_database_url_postgresql_prefix():
    """
    Verifica que las URLs con prefijo 'postgresql://' estándar se adapten
    al driver 'postgresql+asyncpg://'.
    """
    raw_url = "postgresql://user:secret@db.service.internal:5432/questfest_prod?ssl=require"
    expected = "postgresql+asyncpg://user:secret@db.service.internal:5432/questfest_prod?ssl=require"
    assert normalize_database_url(raw_url) == expected

def test_normalize_database_url_already_asyncpg():
    """
    Verifica que una URL que ya contenga el esquema 'postgresql+asyncpg://'
    se mantenga inalterada sin duplicar drivers.
    """
    raw_url = "postgresql+asyncpg://user:secret@localhost:5432/questfest"
    assert normalize_database_url(raw_url) == raw_url

def test_normalize_database_url_sqlite():
    """
    Verifica que otras conexiones (como SQLite para tests en memoria)
    no sean modificadas por la función de normalización.
    """
    sqlite_url = "sqlite+aiosqlite:///:memory:"
    assert normalize_database_url(sqlite_url) == sqlite_url

def test_get_real_client_ip_with_x_real_ip():
    """
    Verifica que se priorice la cabecera 'X-Real-IP' inyectada por Nginx.
    """
    scope = {
        "type": "http",
        "headers": [
            (b"x-real-ip", b"203.0.113.195"),
            (b"x-forwarded-for", b"198.51.100.1"),
        ],
        "client": ("172.20.0.5", 54321),
    }
    request = Request(scope)
    assert get_real_client_ip(request) == "203.0.113.195"

def test_get_real_client_ip_with_x_forwarded_for_anti_spoofing():
    """
    Verifica que cuando no existe X-Real-IP, se examine X-Forwarded-For de derecha
    a izquierda descartando saltos privados de proxy para neutralizar IP spoofing.
    """
    # En este escenario, el cliente real posee la IP pública 93.184.216.34.
    # El atacante intentó inyectar un encabezado falso '8.8.8.8'.
    # El proxy interno de Docker es 172.20.0.2 (rango privado RFC 1918).
    # La función debe descartar el proxy privado y retornar 93.184.216.34, neutralizando el spoofing.
    scope = {
        "type": "http",
        "headers": [
            (b"x-forwarded-for", b"8.8.8.8, 93.184.216.34, 172.20.0.2"),
        ],
        "client": ("172.20.0.2", 54321),
    }
    request = Request(scope)
    assert get_real_client_ip(request) == "93.184.216.34"

def test_get_real_client_ip_local_private_network():
    """
    Verifica que en un entorno local donde todas las IPs son de rango privado (ej. Docker Compose),
    se extraiga la primera IP válida de la cadena en lugar de fallar.
    """
    scope = {
        "type": "http",
        "headers": [
            (b"x-forwarded-for", b"172.18.0.10, 172.18.0.2"),
        ],
        "client": ("172.18.0.2", 54321),
    }
    request = Request(scope)
    assert get_real_client_ip(request) == "172.18.0.10"

def test_get_real_client_ip_fallback_to_client_host():
    """
    Verifica que en ausencia de cabeceras de proxy, se retorne el host reportado
    por el socket ASGI.
    """
    scope = {
        "type": "http",
        "headers": [],
        "client": ("192.168.1.50", 45678),
    }
    request = Request(scope)
    assert get_real_client_ip(request) == "192.168.1.50"

def test_get_real_client_ip_fallback_no_client():
    """
    Verifica que ante peticiones sin objeto client (como llamadas de prueba o ASGI sintéticas),
    se proporcione '127.0.0.1' como valor por defecto seguro.
    """
    scope = {
        "type": "http",
        "headers": [],
        "client": None,
    }
    request = Request(scope)
    assert get_real_client_ip(request) == "127.0.0.1"
