'use client';

/**
 * ============================================================================
 * CONTEXTO DE AUTENTICACIÓN (AuthContext): QuestFest PWA
 * ============================================================================
 * Centraliza la sesión del jugador, el token JWT y su perfil reactivo en toda la app.
 * 
 * Decisiones clave de arquitectura móvil:
 * 1. Estrategia Dual de Almacenamiento (localStorage + Cookie):
 *    - `localStorage`: Permite a la SPA y a los interceptores de Axios leer el JWT sincrónicamente.
 *    - `document.cookie`: Permite a los Server Components y middleware de Next.js conocer
 *      la sesión antes de renderizar páginas protegidas en el servidor.
 * 2. Eventos Reactivos Inter-Componentes:
 *    Tras autenticar o refrescar perfil, dispara el evento sintético `force-check-notifications`
 *    en `window` para que el `GlobalNotificationListener` consulte inmediatamente alertas nuevas.
 * 3. Fallback Seguro: Si una llamada a `/api/auth/me` falla (token caducado o revocado),
 *    fuerza un `logout()` automático para no dejar al usuario en un estado visual zombi.
 * ============================================================================
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';

export interface User {
  id: number;
  username: string;
  rol: string;
  saldo_actual: number;
  bio?: string;
  avatar_url?: string;
}

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

  const fetchProfile = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data);
      // Despertamos al gestor de notificaciones para que consulte alertas inmediatamente
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('force-check-notifications'));
    } catch {
      // Si el token no es válido o está expirado, cerramos sesión de inmediato
      console.error("Token inválido o expirado. Cerrando sesión...");
      logout();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Actualización optimista del balance local en memoria.
   * Evita saltos visuales en la UI mientras la llamada HTTP al backend finaliza.
   * Garantiza que el saldo mostrado nunca baje de 0 (`Math.max(0, ...)`).
   */
  const updateBalance = (delta: number) => {
    setUser((prev) => {
      if (!prev) return null;
      const newSaldo = Math.max(0, prev.saldo_actual + delta);
      return { ...prev, saldo_actual: newSaldo };
    });
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  /**
   * Inicia sesión enviando credenciales OAuth2 Form URL Encoded al backend.
   * Guarda el JWT en localStorage y Cookie (`max-age=86400`, 24h), y redirige a /groups.
   */
  const login = async (username: string, password: string) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await api.post('/api/auth/login', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;
      localStorage.setItem('access_token', access_token);
      document.cookie = `access_token=${access_token}; path=/; max-age=86400; samesite=lax`;
      
      api.defaults.headers.common['Authorization'] = 'Bearer ' + access_token;
      
      await fetchProfile();
      // Tras el inicio de sesión exitoso, dirigimos al usuario al Welcome Hub (/groups)
      // para que seleccione su comunidad o gestione sus grupos activos.
      router.push('/groups');
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      throw error;
    }
  };

  /**
   * Cierra sesión destruyendo el estado local, la cookie expirada y el header de Axios.
   */
  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Ignoramos silenciosamente fallos del endpoint remoto de logout al limpiar credenciales locales
    }
    localStorage.removeItem('access_token');
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax";
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshProfile: fetchProfile, updateBalance }}>
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
