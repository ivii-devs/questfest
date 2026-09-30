'use client';

/**
 * ============================================================================
 * ESCUCHADOR GLOBAL DE NOTIFICACIONES Y BOLETÍN: QuestFest PWA
 * ============================================================================
 * Componente centinela invisible montado en la raíz de la aplicación para
 * recibir avisos push simulados y presentar el boletín matutino.
 *
 * Mecanismo híbrido:
 * 1. Sondeo reactivo (Short-Polling de 15s): Consulta pasiva periódica de notificaciones
 *    pendientes ('/api/notifications/unread') y configuración horaria del boletín.
 * 2. Evento sintético ('force-check-notifications'): Permite a cualquier acción del usuario
 *    (ej: lanzar un reto o apostar) forzar una comprobación inmediata sin esperar los 15s.
 * 3. Supresión de duplicados: El boletín diario solo se muestra una vez por jornada
 *    almacenando la marca de verificación en localStorage (`summary_seen_YYYY-MM-DD`).
 * ============================================================================
 */

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import { usePathname } from 'next/navigation';
import { BellRing, Check } from 'lucide-react';
import DailySummaryModal, { DailySummaryData } from './DailySummaryModal';
import {
  useNotificationStore,
  UnreadNotificationData,
} from '@/store/useNotificationStore';

export type UnreadNotification = UnreadNotificationData;

/**
 * Rutas excluidas donde no debe proyectarse el boletín diario (como el Welcome Hub o login).
 */
const isExcludedRoute = (path: string): boolean => {
  return (
    path.startsWith('/groups') ||
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/join') ||
    path.startsWith('/offline') ||
    path.startsWith('/perfil') ||
    path.startsWith('/settings')
  );
};

export default function GlobalNotificationListener() {
  const { user } = useAuth();
  const { activeGroup } = useGroup();
  const pathname = usePathname();
  const unreadNotif = useNotificationStore((s) => s.unreadNotification);
  const [boletinData, setBoletinData] = useState<DailySummaryData | null>(null);
  const isModalOpen = Boolean(boletinData || unreadNotif);

  /**
   * Evalúa si ha llegado la hora configurada para proyectar el resumen matutino del grupo activo.
   *
   * Aislamiento por grupo y protección del Welcome Hub:
   * 1. Solo se ejecuta cuando el usuario se encuentra dentro de las vistas de un grupo activo.
   * 2. Emplea una clave de persistencia en localStorage específica para cada usuario, grupo y fecha:
   *    `summary_seen_${user.id}_${activeGroup.id}_${todayDate}`.
   * 3. Consulta las estadísticas específicas del grupo vía query parameter `group_id`.
   */
  const checkBoletin = useCallback(async () => {
    if (
      typeof window !== 'undefined' &&
      sessionStorage.getItem('disable_notification_modals') === 'true'
    ) {
      return;
    }
    if (!user || !activeGroup || isExcludedRoute(pathname)) return;

    try {
      const todayDate = new Date().toISOString().split('T')[0];
      const seenKey = `summary_seen_${user.id}_${activeGroup.id}_${todayDate}`;
      if (localStorage.getItem(seenKey)) return;

      const resConfig = await api.get('/api/settings/boletin', {
        params: { group_id: activeGroup.id },
      });
      const config = resConfig.data;
      if (!config || !config.hora) return;

      const now = new Date();
      const [h, m] = config.hora.split(':');
      const targetTime = new Date();
      targetTime.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);

      if (now >= targetTime) {
        const resStats = await api.get('/api/notifications/boletin-stats', {
          params: { group_id: activeGroup.id },
        });
        const fullData = resStats.data;

        const filteredData: DailySummaryData = {};
        if (config.phaseValue) filteredData.phase = config.phaseValue;
        if (config.firstPlace) filteredData.firstPlace = fullData.firstPlace;
        if (config.lastPlace) filteredData.lastPlace = fullData.lastPlace;
        if (config.mostBetsWon) filteredData.mostBetsWon = fullData.mostBetsWon;
        if (config.mostMissions)
          filteredData.mostMissions = fullData.mostMissions;
        if (config.duelWinner) filteredData.duelWinner = fullData.duelWinner;
        if (config.biggestWinner)
          filteredData.biggestWinner = fullData.biggestWinner;
        if (config.biggestLoser)
          filteredData.biggestLoser = fullData.biggestLoser;

        setBoletinData(filteredData);
      }
    } catch {
      // Supresión silenciosa de excepciones transitorias de red
    }
  }, [user, activeGroup, pathname]);

  useEffect(() => {
    if (!user) return; // Solo se activa para sesiones autenticadas

    // Iniciar el orquestador único de polling de 20s en Zustand
    const stopPolling = useNotificationStore
      .getState()
      .startPolling(activeGroup?.id);

    // Comprobación de boletín
    checkBoletin();

    const handleForceCheck = () => {
      useNotificationStore.getState().checkUpdates(activeGroup?.id);
      checkBoletin();
    };

    // Escuchador de disparos reactivos manuales
    window.addEventListener('force-check-notifications', handleForceCheck);

    return () => {
      stopPolling();
      window.removeEventListener('force-check-notifications', handleForceCheck);
    };
  }, [user, activeGroup?.id, checkBoletin]);

  /**
   * Descarta el boletín del día guardando la clave local aislada por grupo y usuario.
   */
  const handleCloseBoletin = () => {
    if (user && activeGroup) {
      const todayDate = new Date().toISOString().split('T')[0];
      localStorage.setItem(
        `summary_seen_${user.id}_${activeGroup.id}_${todayDate}`,
        'true'
      );
    }
    setBoletinData(null);
  };

  /**
   * Marca la notificación como leída en la base de datos de manera atómica.
   */
  const markAsRead = async () => {
    if (!unreadNotif) return;
    await useNotificationStore.getState().dismissNotification(unreadNotif.id);
  };

  if (!isModalOpen) return null;

  if (boletinData) {
    return (
      <DailySummaryModal
        forceOpen={true}
        previewData={boletinData}
        onClosePreview={handleCloseBoletin}
      />
    );
  }

  if (!unreadNotif) return null;

  // Si la notificación es un Boletín (tiene config_boletin), mostramos el modal del boletín (LEGACY)
  if (unreadNotif.config_boletin) {
    if (!activeGroup || isExcludedRoute(pathname)) return null;
    return (
      <DailySummaryModal
        forceOpen={true}
        previewData={unreadNotif.config_boletin}
        onClosePreview={markAsRead}
      />
    );
  }

  // De lo contrario, mostramos el modal de Aviso Inmediato con estética Dracula
  return (
    <div className="animate-fadeIn fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="bg-dracula-card relative flex w-full max-w-sm flex-col items-center rounded-3xl border-2 border-[#8be9fd]/50 p-6 text-center shadow-[0_0_40px_rgba(139,233,253,0.3)]">
        {/* Ícono superior */}
        <div className="mb-4 flex h-16 w-16 animate-bounce items-center justify-center rounded-full border border-[#8be9fd]/50 bg-[#8be9fd]/20 text-[#8be9fd] shadow-[0_0_15px_rgba(139,233,253,0.4)]">
          <BellRing size={32} />
        </div>

        {/* Título */}
        <h2 className="text-dracula-light mb-2 text-xl font-black tracking-wide uppercase">
          {unreadNotif.titulo}
        </h2>

        {/* Mensaje */}
        <p className="text-dracula-gray mb-6 text-sm leading-relaxed whitespace-pre-wrap">
          {unreadNotif.mensaje}
        </p>

        {/* Imagen opcional (si tiene) */}
        {unreadNotif.media_url && (
          <img
            src={unreadNotif.media_url}
            alt="Notificación"
            className="border-dracula-gray/20 mb-6 max-h-48 w-full rounded-xl border object-cover"
          />
        )}

        {/* Botón de cierre */}
        <button
          onClick={markAsRead}
          className="text-dracula-base flex w-full items-center justify-center gap-2 rounded-xl bg-[#8be9fd] py-3 text-sm font-black tracking-widest uppercase shadow-lg transition-colors hover:bg-[#8be9fd]/80"
        >
          <Check size={18} strokeWidth={3} /> Entendido
        </button>
      </div>
    </div>
  );
}
