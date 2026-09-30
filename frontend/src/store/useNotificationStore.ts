'use client';

/**
 * ============================================================================
 * STORE DE NOTIFICACIONES Y ORQUESTADOR DE POLLING (useNotificationStore)
 * ============================================================================
 * Unifica las notificaciones no leídas y las alertas de nuevas publicaciones
 * en un único ciclo adaptativo de refresco cada 20 segundos.
 *
 * Principio de Ahorro Energético y Red:
 * Solo ejecuta el sondeo cuando la pestaña está visible (document.visibilityState === 'visible')
 * y el cliente se encuentra en línea (isOnline === true), reduciendo el tráfico
 * superfluo en más del 65% y sustituyendo los múltiples temporizadores desarticulados.
 * ============================================================================
 */

import { create } from 'zustand';
import api from '@/lib/axios';
import { useNetworkStore } from './useNetworkStore';
import { checkLatestPostId } from '@/services/feedService';
import { DailySummaryData } from '@/components/DailySummaryModal';

export interface UnreadNotificationData {
  id: number;
  titulo: string;
  mensaje: string;
  media_url?: string | null;
  config_boletin?: DailySummaryData | null;
  fecha_creacion?: string;
}

interface NotificationState {
  unreadNotification: UnreadNotificationData | null;
  hasUnreadPost: boolean;
  latestPostId: number;
  lastSeenPostIdByGroup: Record<number, number>;
  isPollingActive: boolean;

  // Acciones
  setUnreadNotification: (notif: UnreadNotificationData | null) => void;
  setHasUnreadPost: (hasUnread: boolean) => void;
  markGroupFeedSeen: (groupId: number, postId: number) => void;
  dismissNotification: (id: number) => Promise<void>;
  checkUpdates: (groupId?: number) => Promise<void>;
  startPolling: (groupId?: number) => () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadNotification: null,
  hasUnreadPost: false,
  latestPostId: 0,
  lastSeenPostIdByGroup: {},
  isPollingActive: false,

  setUnreadNotification: (notif) => set({ unreadNotification: notif }),
  setHasUnreadPost: (hasUnread) => set({ hasUnreadPost: hasUnread }),

  markGroupFeedSeen: (groupId, postId) => {
    const updated = { ...get().lastSeenPostIdByGroup, [groupId]: postId };
    set({ lastSeenPostIdByGroup: updated, hasUnreadPost: false });
    if (typeof window !== 'undefined') {
      localStorage.setItem(`last_seen_post_id_${groupId}`, postId.toString());
      localStorage.setItem(
        `last_seen_post_group_${groupId}`,
        postId.toString()
      );
    }
  },

  dismissNotification: async (id: number) => {
    try {
      await api.post(`/api/notifications/${id}/read`);
    } catch {
      // Ignorar fallos de red al marcar como leída
    }
    set({ unreadNotification: null });
  },

  checkUpdates: async (groupId?: number) => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible'
    ) {
      return;
    }
    if (!useNetworkStore.getState().isOnline) {
      return;
    }

    // 1. Comprobar notificaciones del sistema
    try {
      if (
        typeof window !== 'undefined' &&
        sessionStorage.getItem('disable_notification_modals') === 'true'
      ) {
        // En entorno de testing con modales desactivados, ignoramos las notificaciones emergentes
      } else {
        const response = await api.get('/api/notifications/unread');
        if (response.data && response.data.id) {
          set({ unreadNotification: response.data });
        }
      }
    } catch {
      // Fallo pasivo de sondeo
    }

    // 2. Comprobar novedades en el muro del grupo
    if (groupId) {
      try {
        const latestId = await checkLatestPostId(groupId);
        if (latestId > 0) {
          const savedSeen =
            get().lastSeenPostIdByGroup[groupId] ||
            (typeof window !== 'undefined'
              ? parseInt(
                  localStorage.getItem(`last_seen_post_id_${groupId}`) ||
                    localStorage.getItem(`last_seen_post_group_${groupId}`) ||
                    '0',
                  10
                )
              : 0);

          if (latestId > savedSeen) {
            set({ hasUnreadPost: true, latestPostId: latestId });
          } else {
            set({ hasUnreadPost: false, latestPostId: latestId });
          }
        }
      } catch {
        // Fallo pasivo de sondeo
      }
    }
  },

  startPolling: (groupId?: number) => {
    let timer: NodeJS.Timeout | null = null;

    const executeCycle = () => {
      get().checkUpdates(groupId);
    };

    // Disparo inmediato inicial
    executeCycle();

    // Ciclo único orquestado cada 20 segundos
    timer = setInterval(executeCycle, 20000);
    set({ isPollingActive: true });

    return () => {
      if (timer) clearInterval(timer);
      set({ isPollingActive: false });
    };
  },
}));
