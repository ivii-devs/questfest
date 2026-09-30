'use client';

/**
 * ============================================================================
 * STORE DE AUTENTICACIÓN Y SESIÓN (useAuthStore)
 * ============================================================================
 * Centraliza la sesión del jugador, token JWT, estado de carga y acciones
 * de login/logout/recuperación de perfil.
 *
 * Privacidad e Integridad Contable:
 * En el proceso de logout(), purga completamente la memoria local y comanda
 * al Service Worker la invalidación total de las cachés ('CLEAR_APP_CACHE')
 * para garantizar aislamiento estricto en dispositivos compartidos.
 * ============================================================================
 */

import { create } from 'zustand';
import api from '@/lib/axios';
import { loginUser, getMe, logoutUser } from '@/services/authService';
import { Usuario } from '@/types';

interface AuthState {
  user: Usuario | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;

  // Acciones
  setToken: (token: string | null) => void;
  setUser: (user: Usuario | null) => void;
  setLoading: (loading: boolean) => void;
  login: (username: string, password: string) => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateBalance: (delta: number) => void;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token:
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null,
  isAuthenticated: false,
  loading: true,

  setToken: (token) => set({ token, isAuthenticated: Boolean(token) }),
  setUser: (user) => set({ user, isAuthenticated: Boolean(user) }),
  setLoading: (loading) => set({ loading }),

  login: async (username: string, password: string) => {
    try {
      const { access_token } = await loginUser({ username, password });

      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', access_token);
        document.cookie = `access_token=${access_token}; path=/; max-age=86400; samesite=lax`;
      }

      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      set({ token: access_token, isAuthenticated: true });

      await get().fetchProfile();
    } catch (error) {
      console.error('Error al iniciar sesión en useAuthStore:', error);
      throw error;
    }
  },

  fetchProfile: async () => {
    try {
      const userProfile = await getMe();
      set({ user: userProfile, isAuthenticated: true, loading: false });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('force-check-notifications'));
      }
    } catch (error) {
      console.error('Error cargando perfil del usuario:', error);
      await get().logout();
    } finally {
      set({ loading: false });
    }
  },

  updateBalance: (delta: number) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const newSaldo = Math.max(0, currentUser.saldo_actual + delta);
    set({ user: { ...currentUser, saldo_actual: newSaldo } });
  },

  logout: async () => {
    try {
      await logoutUser();
    } catch {
      // Ignorar fallos de red durante el cierre de sesión
    }

    // 1. Limpieza de almacenamiento local y cookies de sesión
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      document.cookie =
        'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax';

      // 2. Aislamiento PWA: Enviar mensaje al Service Worker para purgar toda la caché local
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_APP_CACHE',
        });
      }

      // Purga directa en CacheStorage si estuviese disponible en el contexto de ventana
      if ('caches' in window) {
        try {
          await caches.delete('questfest-cache-v1');
        } catch {
          // Si el navegador bloquea la operación, continuamos
        }
      }
    }

    delete api.defaults.headers.common['Authorization'];
    set({ user: null, token: null, isAuthenticated: false, loading: false });
  },

  initializeAuth: async () => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('access_token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      set({ token, isAuthenticated: true });
      await get().fetchProfile();
    } else {
      set({ loading: false });
    }
  },
}));
