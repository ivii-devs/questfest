import asyncio
import json
from typing import Set


class EventBroadcaster:
    """
    Bus de Eventos Pub/Sub en Memoria (In-Process) para Server-Sent Events (SSE).

    ¿Qué problema resuelve?
    Permite transmitir publicaciones del feed, respuestas y alertas de juego a los navegadores
    en tiempo real mediante una conexión HTTP unidireccional permanente ('/api/feed/stream').
    A diferencia de WebSockets, SSE es nativo sobre HTTP, se reconecta automáticamente en caso
    de pérdida de cobertura (muy común en móviles y PWA) y atraviesa proxies Nginx sin configuración compleja.

    Advertencia de Arquitectura y Escalado:
    Este bus almacena las colas activas en la memoria RAM del proceso actual de Python ('self.listeners').
    Funciona a la perfección en el despliegue actual de QuestFest (un solo proceso/worker Uvicorn).
    Si en el futuro el sistema se escala horizontalmente a múltiples réplicas de Docker o múltiples workers,
    los eventos publicados en el proceso A no llegarán a los oyentes conectados al proceso B.
    En tal escenario, la implementación deberá conmutar hacia un backend distribuido como Redis Pub/Sub.
    """

    def __init__(self):
        # Conjunto de colas asíncronas activas correspondientes a cada cliente HTTP SSE conectado
        self.listeners: Set[asyncio.Queue] = set()

    async def subscribe(self) -> asyncio.Queue:
        """
        Registra a un nuevo cliente en el bus de eventos y le asigna una cola de mensajes exclusiva.
        Retorna la cola 'asyncio.Queue' para que el generador de StreamingResponse consuma sus eventos.
        """
        queue = asyncio.Queue()
        self.listeners.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        """
        Elimina la cola del cliente cuando el navegador cierra la pestaña, pierde conexión o aborta la petición SSE.
        Previene fugas de memoria (Memory Leaks) evitando retener colas inactivas.
        """
        self.listeners.discard(queue)

    async def broadcast(self, event_type: str, data: dict):
        """
        Difunde un mensaje serializado en JSON a todos los clientes actualmente suscritos.
        Si la cola de un cliente específico está llena o bloqueada, se ignora de forma no bloqueante ('put_nowait').
        """
        if not self.listeners:
            return

        message = json.dumps({"type": event_type, "payload": data})
        for queue in list(self.listeners):
            try:
                queue.put_nowait(message)
            except Exception:
                # Si una cola saturada rechaza el mensaje, no detenemos la difusión al resto de clientes
                pass


# Instancia única (Singleton) a nivel de proceso accesible globalmente en la aplicación
broadcaster = EventBroadcaster()
