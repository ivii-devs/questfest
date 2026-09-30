/**
 * ============================================================================
 * CLIENTE HTTP AXIOS: QuestFest
 * ============================================================================
 * Instancia global preconfigurada para las comunicaciones cliente-servidor.
 * 
 * Características:
 * 1. `withCredentials: true`: Habilita el envío de cookies de sesión cross-origin,
 *    esencial para entornos de desarrollo en LAN y producción en dominios cruzados.
 * 2. Interceptor de Petición (Bearer Injection):
 *    Inspecciona `localStorage` sincrónicamente antes de enviar cada petición HTTP.
 *    Si existe `access_token`, inyecta la cabecera estándar `Authorization: Bearer <token>`.
 * 3. Detección de Entorno (`typeof window !== 'undefined'`):
 *    Evita errores de ejecución durante el Server-Side Rendering (SSR) de Next.js.
 * ============================================================================
 */

import axios from 'axios';

const getBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL !== undefined) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // En producción (ej. Vercel bajo el mismo dominio), las peticiones a '/api/...' son relativas
  if (process.env.NODE_ENV === 'production') {
    return '';
  }
  // En desarrollo local por defecto apuntamos al servidor FastAPI en IPv4 loopback (127.0.0.1:8000)
  // para evitar fallos de resolución DNS IPv6 ([::1]) en navegadores bajo Windows
  return 'http://127.0.0.1:8000';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
});

// Interceptor de salida: inyecta el token Bearer en cada petición
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }
  }
  return config;
});

export default api;
