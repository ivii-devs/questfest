import json
import os

# Claves VAPID por defecto (para desarrollo/fallback)
DEFAULT_VAPID_PUBLIC_KEY = os.getenv(
    "VAPID_PUBLIC_KEY",
    "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgD8q0_PzL9tK4Z1g0XnL9jX_L5y0x4Kz6xL9jX_L5y0=",
)
DEFAULT_VAPID_PRIVATE_KEY = os.getenv(
    "VAPID_PRIVATE_KEY", "aK9_xL5y0x4Kz6xL9jX_L5y0x4Kz6xL9jX_L5y0x4K="
)
VAPID_CLAIMS_SUB = os.getenv("VAPID_CLAIMS_SUB", "mailto:admin@questfest.app")


def get_vapid_public_key() -> str:
    return DEFAULT_VAPID_PUBLIC_KEY


def send_web_push(subscription_info: dict, payload: dict) -> bool:
    """
    Envía una notificación WebPush VAPID a la suscripción de un dispositivo.
    Si el payload incluye 'group_name', formatea el título antecediendo el nombre
    del grupo para que el usuario distinga de qué comunidad procede la alerta.
    """
    try:
        from pywebpush import webpush

        # Clonamos el payload para no mutar el diccionario recibido
        formatted_payload = dict(payload)
        group_name = formatted_payload.get("group_name")
        if group_name and "title" in formatted_payload:
            if not formatted_payload["title"].startswith(f"[{group_name}]"):
                formatted_payload["title"] = f"[{group_name}] {formatted_payload['title']}"

        webpush(
            subscription_info={
                "endpoint": subscription_info["endpoint"],
                "keys": {"p256dh": subscription_info["p256dh"], "auth": subscription_info["auth"]},
            },
            data=json.dumps(formatted_payload),
            vapid_private_key=DEFAULT_VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CLAIMS_SUB},
        )
        return True
    except Exception as e:
        print(f"[Push Service] Error enviando notificacion WebPush: {e}")
        return False
