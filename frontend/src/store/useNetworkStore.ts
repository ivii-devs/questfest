'use client';

/**
 * ============================================================================
 * STORE DE ESTADO DE CONECTIVIDAD REACTIVA (useNetworkStore)
 * ============================================================================
 * Supervisa el estado de conexión del dispositivo móvil o navegador mediante
 * la API 'navigator.onLine' y eventos nativos 'online'/'offline'.
 * Permite a componentes y formularios inhabilitar de forma predecible botones
 * que requieran conectividad de red con el backend.
 * ============================================================================
 */

import { create } from 'zustand';

interface NetworkState {
  isOnline: boolean;
  setOnline: (online: boolean) => void;
  initNetworkListeners: () => () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  setOnline: (online: boolean) => set({ isOnline: online }),

  initNetworkListeners: () => {
    if (typeof window === 'undefined') return () => {};

    const handleOnline = () => {
      set({ isOnline: true });
    };

    const handleOffline = () => {
      set({ isOnline: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sincronización inicial
    set({ isOnline: navigator.onLine });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },
}));
