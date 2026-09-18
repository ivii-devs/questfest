import ipaddress
import os
from fastapi import Request
from slowapi import Limiter

def get_real_client_ip(request: Request) -> str:
    """
    Obtiene la dirección IP real del cliente que realiza la petición HTTP,
    resolviendo de forma segura la presencia de proxies inversos (como Nginx o Docker)
    y evitando ataques de suplantación de identidad (IP Spoofing).

    Problema que resuelve:
    Por defecto, 'get_remote_address' de SlowAPI lee únicamente 'request.client.host',
    que al estar detrás de Nginx o un balanceador de carga siempre devuelve la IP interna
    del contenedor proxy (por ejemplo 172.20.0.x). Si todos los clientes comparten la misma IP,
    un límite estricto como 5 peticiones/minuto en upload o login bloquearía a todos los usuarios
    del mundo con errores HTTP 429 masivos.

    Estrategia defensiva:
    1. Prioridad 'X-Real-IP': En nuestro despliegue con Nginx (nginx.conf), la directiva
       'proxy_set_header X-Real-IP $remote_addr;' garantiza que Nginx sobreescriba esta cabecera
       con la IP TCP remota del cliente, anulando cualquier valor falsificado por el usuario.
    2. 'X-Forwarded-For': Si no existe X-Real-IP (por ejemplo en entornos con balanceadores en la nube),
       se analiza la cadena de saltos de derecha a izquierda, descartando proxies internos
       (redes privadas RFC 1918 y loopback) para encontrar la primera IP pública real.
    3. Fallback: Si no existen cabeceras de proxy válidas, se utiliza la conexión directa reportada
       por el servidor ASGI ('request.client.host').
    """
    # 1. Inspeccionar X-Real-IP (garantizada y sobreescrita por Nginx)
    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        candidate = x_real_ip.strip()
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            pass  # Cabecera malformada o inválida, continuamos con la siguiente estrategia

    # 2. Inspeccionar X-Forwarded-For con validación de salto y descarte de proxies privados
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        raw_ips = [ip.strip() for ip in x_forwarded_for.split(",") if ip.strip()]
        
        # Recorremos de derecha a izquierda (desde el último proxy hacia el cliente original)
        for candidate in reversed(raw_ips):
            try:
                parsed_ip = ipaddress.ip_address(candidate)
                # Si encontramos una IP pública legítima, esa es la IP del cliente real
                if not (parsed_ip.is_private or parsed_ip.is_loopback or parsed_ip.is_link_local):
                    return candidate
            except ValueError:
                continue

        # Si todas las IPs en la cadena son privadas (desarrollo local en Docker o red de pruebas),
        # seleccionamos la primera IP válida de la cadena
        for candidate in raw_ips:
            try:
                ipaddress.ip_address(candidate)
                return candidate
            except ValueError:
                continue

    # 3. Fallback seguro a la dirección del socket directo
    if request.client and request.client.host:
        return request.client.host

    # Fallback final en caso de peticiones sintéticas sin cliente ASGI
    return "127.0.0.1"


# Configuración del motor de almacenamiento para SlowAPI
# Permite conmutar automáticamente a Redis en producción distribuida o memoria en monocontenedor
redis_url = os.getenv("REDIS_URL", None)

if redis_url:
    limiter = Limiter(key_func=get_real_client_ip, storage_uri=redis_url)
else:
    # Almacenamiento en memoria RAM local (ideal para tests y desarrollo)
    limiter = Limiter(key_func=get_real_client_ip)
