'use client';

/**
 * ============================================================================
 * CONTEXTO DE AUTENTICACIÓN (AuthContext): QuestFest PWA
 * ============================================================================
 * Centraliza la sesión del jugador, el token JWT y su perfil reactivo en toda la app.
 * Sincronizado bidireccionalmente con el store de Zustand (useAuthStore).
 *
 * Decisiones clave de arquitectura móvil:
 * 1. Estrategia Dual de Almacenamiento (localStorage + Cookie):
 *    - `localStorage`: Permite a la SPA y a los interceptores de Axios leer el JWT sincrónicamente.
 *    - `document.cookie`: Permite a los Server Components y middleware de Next.js conocer
 *      la sesión antes de renderizar páginas protegidas en el servidor.
 * 2. Purga Atómica de Service Worker en Logout:
 *    Destruye la caché de la aplicación ('questfest-cache-v1') y notifica al Service Worker
 *    para evitar contaminación cruzada de datos contables entre jugadores en el mismo dispositivo.
 * 3. Fallback Seguro: Si una llamada a `/api/auth/me` falla (token caducado o revocado),
 *    fuerza un `logout()` automático para no dejar al usuario en un estado visual zombi.
 * ============================================================================
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { loginUser, logoutUser, getMe } from '@/services/authService';
import { Usuario } from '@/types';

export type User = Usuario;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateBalance: (delta: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Cierra sesión destruyendo el estado local, la cookie expirada, el header de Axios
   * y purgando la caché de la aplicación en el Service Worker.
   */
  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Ignoramos fallos silenciosamente al limpiar credenciales locales
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      document.cookie =
        'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax';

      // Purga atómica en Service Worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_APP_CACHE',
        });
      }

      if ('caches' in window) {
        try {
          await caches.delete('questfest-cache-v1');
        } catch {
          // Continuamos si el entorno restringe el borrado directo
        }
      }
    }

    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    useAuthStore.getState().setUser(null);
    router.push('/login');
  }, [router]);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await getMe();
      setUser(data);
      useAuthStore.getState().setUser(data);

      // Despertamos al gestor de notificaciones para que consulte alertas inmediatamente
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('force-check-notifications'));
      }
    } catch {
      console.error('Token inválido o expirado. Cerrando sesión...');
      await logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  /**
   * Actualización optimista del balance local en memoria.
   * Evita saltos visuales en la UI mientras la llamada HTTP al backend finaliza.
   * Garantiza que el saldo mostrado nunca baje de 0 (`Math.max(0, ...)`).
   */
  const updateBalance = (delta: number) => {
    setUser((prev) => {
      if (!prev) return null;
      const newSaldo = Math.max(0, prev.saldo_actual + delta);
      const updatedUser = { ...prev, saldo_actual: newSaldo };
      useAuthStore.getState().setUser(updatedUser);
      return updatedUser;
    });
  };

  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('access_token')
        : null;
    if (token) {
      api.defaults.headers.common['Authorization'] = 'Bearer ' + token;
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [fetchProfile]);

  /**
   * Inicia sesión enviando credenciales OAuth2 al backend.
   * Guarda el JWT en localStorage y Cookie (`max-age=86400`, 24h), y redirige a /groups.
   */
  const login = async (username: string, password: string) => {
    try {
      const { access_token } = await loginUser({ username, password });
      localStorage.setItem('access_token', access_token);
      document.cookie = `access_token=${access_token}; path=/; max-age=86400; samesite=lax`;

      api.defaults.headers.common['Authorization'] = 'Bearer ' + access_token;

      await fetchProfile();
      // Tras el inicio de sesión exitoso, dirigimos al usuario al Welcome Hub (/groups)
      router.push('/groups');
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshProfile: fetchProfile,
        updateBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
