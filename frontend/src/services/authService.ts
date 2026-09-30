/**
 * ============================================================================
 * SERVICIO DE AUTENTICACIÓN Y SESIÓN (authService)
 * ============================================================================
 * Centraliza las peticiones de red hacia el subsistema de usuarios y seguridad.
 * Desacopla la lógica de transporte HTTP de los componentes visuales y stores.
 * ============================================================================
 */

import api from '@/lib/axios';
import {
  Usuario,
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  UserStatsResponse,
} from '@/types';

/**
 * Autentica al usuario mediante OAuth2 Password Form Request.
 * El backend responde con el access_token JWT.
 */
export async function loginUser(
  credentials: LoginRequest
): Promise<LoginResponse> {
  const formData = new URLSearchParams();
  formData.append('username', credentials.username);
  formData.append('password', credentials.password);

  const response = await api.post<LoginResponse>(
    '/api/auth/login',
    formData.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
  return response.data;
}

/**
 * Registra una nueva cuenta de jugador en el sistema.
 */
export async function registerUser(payload: RegisterRequest): Promise<Usuario> {
  const response = await api.post<Usuario>('/api/auth/register', payload);
  return response.data;
}

/**
 * Recupera el perfil del usuario autenticado actual desde el token en vigor.
 */
export async function getMe(): Promise<Usuario> {
  const response = await api.get<Usuario>('/api/auth/me');
  return response.data;
}

/**
 * Obtiene las métricas globales acumuladas del usuario actual.
 */
export async function getUserStats(): Promise<UserStatsResponse> {
  const response = await api.get<UserStatsResponse>('/api/users/stats');
  return response.data;
}

/**
 * Notifica al backend la revocación de la sesión actual.
 */
export async function logoutUser(): Promise<void> {
  try {
    await api.post('/api/auth/logout');
  } catch {
    // Si el backend no responde o el token ya expiró, continuamos con la limpieza local
  }
}
