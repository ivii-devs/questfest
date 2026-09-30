import api from '@/lib/axios';

/**
 * Utilidades para la gestión de Notificaciones Push Web (VAPID) en QuestFest.
 * Diseñado específicamente para cumplir con los estándares de iOS 16.4+ y navegadores modernos:
 * 1. Detección de entorno seguro (HTTPS vs HTTP local).
 * 2. Detección de modo PWA Standalone requerido por Apple en iPhone/iPad.
 * 3. Conversión de claves públicas VAPID a Uint8Array y registro de suscripción contra el backend.
 */

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function checkPushSupport(): { supported: boolean; reason?: string } {
  if (typeof window === 'undefined') return { supported: false, reason: 'SSR' };

  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: 'insecure_context', // HTTP por IP de red en lugar de HTTPS o localhost
    };
  }

  if (!('Notification' in window)) {
    return { supported: false, reason: 'notification_unsupported' };
  }

  if (!('serviceWorker' in navigator)) {
    return { supported: false, reason: 'sw_unsupported' };
  }

  if (!('PushManager' in window)) {
    return { supported: false, reason: 'push_unsupported' };
  }

  return { supported: true };
}

/**
 * Convierte la clave pública VAPID en Base64 URL-safe al array de bytes que espera PushManager.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushSubscriptionResult {
  success: boolean;
  status?:
    | 'granted'
    | 'denied'
    | 'requires_https'
    | 'requires_pwa_install'
    | 'unsupported';
  message: string;
}

/**
 * Solicita permisos de notificación al usuario y registra la suscripción WebPush en el backend.
 */
export async function subscribeToPushNotifications(): Promise<PushSubscriptionResult> {
  const support = checkPushSupport();

  // Caso 1: Conexión no segura (ej. accediendo desde iPhone a http://192.168.X.X:3000)
  if (!support.supported && support.reason === 'insecure_context') {
    return {
      success: false,
      status: 'requires_https',
      message:
        'iOS y los navegadores requieren una conexión segura (HTTPS) para habilitar notificaciones push. Accede mediante HTTPS o añade un túnel seguro.',
    };
  }

  // Caso 2: Dispositivo iPhone en navegador Safari común (no añadido a pantalla de inicio)
  if (isIOSDevice() && !isStandaloneMode()) {
    return {
      success: false,
      status: 'requires_pwa_install',
      message:
        'En iPhone, Apple exige instalar la app en la pantalla de inicio (Compartir > Añadir a pantalla de inicio) para poder recibir notificaciones push.',
    };
  }

  if (!support.supported) {
    return {
      success: false,
      status: 'unsupported',
      message: 'Tu navegador no soporta notificaciones push web.',
    };
  }

  // Caso 3: Permiso previamente bloqueado en el sistema
  if (Notification.permission === 'denied') {
    return {
      success: false,
      status: 'denied',
      message:
        'El permiso de notificaciones está bloqueado. Por favor, habilítalo en los Ajustes de tu navegador o dispositivo.',
    };
  }

  try {
    // 1. Solicitamos permiso interactivo al usuario
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        status: 'denied',
        message: 'Permiso de notificaciones no concedido.',
      };
    }

    // 2. Esperamos a que el Service Worker esté listo
    const registration = await navigator.serviceWorker.ready;
    if (!registration.pushManager) {
      return {
        success: false,
        status: 'unsupported',
        message: 'PushManager no disponible en el Service Worker.',
      };
    }

    // 3. Obtenemos la clave pública VAPID del backend
    const vapidRes = await api.get('/api/notifications/vapid-public-key');
    const vapidPublicKey = vapidRes.data?.public_key;

    if (!vapidPublicKey) {
      return {
        success: false,
        message: 'No se pudo obtener la clave pública VAPID del servidor.',
      };
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    // 4. Creamos la suscripción en el navegador
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    }

    // 5. Enviamos la suscripción al backend para asociarla a la cuenta
    const subJson = subscription.toJSON();
    await api.post('/api/notifications/subscribe', {
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
      },
    });

    return {
      success: true,
      status: 'granted',
      message: '¡Notificaciones push activadas con éxito!',
    };
  } catch (error: unknown) {
    console.error('[PushNotifications] Error al suscribir:', error);
    const err = error as {
      response?: { data?: { detail?: string } };
      message?: string;
    };
    return {
      success: false,
      message:
        err.response?.data?.detail ||
        err.message ||
        'Error al configurar notificaciones push.',
    };
  }
}

/**
 * Comprueba si el navegador ya cuenta con una suscripción activa y concedida.
 */
export async function isPushActive(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || Notification.permission !== 'granted')
    return false;
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.pushManager) return false;
    const sub = await registration.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}
