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

export interface UnreadNotification {
  id: number;
  titulo: string;
  mensaje: string;
  media_url?: string | null;
  config_boletin?: DailySummaryData | null;
  fecha_creacion?: string;
}

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
  const [unreadNotif, setUnreadNotif] = useState<UnreadNotification | null>(null);
  const [boletinData, setBoletinData] = useState<DailySummaryData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    if (typeof window !== 'undefined' && sessionStorage.getItem('disable_notification_modals') === 'true') {
      return;
    }
    if (!user || !activeGroup || isExcludedRoute(pathname)) return;

    try {
      const todayDate = new Date().toISOString().split('T')[0];
      const seenKey = `summary_seen_${user.id}_${activeGroup.id}_${todayDate}`;
      if (localStorage.getItem(seenKey)) return;

      const resConfig = await api.get('/api/settings/boletin', {
        params: { group_id: activeGroup.id }
      });
      const config = resConfig.data;
      if (!config || !config.hora) return;

      const now = new Date();
      const [h, m] = config.hora.split(':');
      const targetTime = new Date();
      targetTime.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);

      if (now >= targetTime) {
        const resStats = await api.get('/api/notifications/boletin-stats', {
          params: { group_id: activeGroup.id }
        });
        const fullData = resStats.data;
        
        const filteredData: DailySummaryData = {};
        if (config.phaseValue) filteredData.phase = config.phaseValue;
        if (config.firstPlace) filteredData.firstPlace = fullData.firstPlace;
        if (config.lastPlace) filteredData.lastPlace = fullData.lastPlace;
        if (config.mostBetsWon) filteredData.mostBetsWon = fullData.mostBetsWon;
        if (config.mostMissions) filteredData.mostMissions = fullData.mostMissions;
        if (config.duelWinner) filteredData.duelWinner = fullData.duelWinner;
        if (config.biggestWinner) filteredData.biggestWinner = fullData.biggestWinner;
        if (config.biggestLoser) filteredData.biggestLoser = fullData.biggestLoser;

        setBoletinData(filteredData);
        setIsModalOpen(true);
      }
    } catch {
      // Supresión silenciosa de excepciones transitorias de red
    }
  }, [user, activeGroup, pathname]);

  useEffect(() => {
    if (!user) return; // Solo se activa para sesiones autenticadas

    // Comprobación inicial al montar o al cambiar de grupo/ruta
    checkUnread();
    checkBoletin();

    // Escuchador de disparos reactivos manuales
    window.addEventListener('force-check-notifications', checkUnread);

    // Ciclo de sondeo suave cada 15 segundos mientras no haya modal visible
    const interval = setInterval(() => {
      if (!isModalOpen) {
        checkUnread();
        checkBoletin();
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('force-check-notifications', checkUnread);
    };
  }, [user, isModalOpen, checkBoletin]);

  /**
   * Descarta el boletín del día guardando la clave local aislada por grupo y usuario.
   */
  const handleCloseBoletin = () => {
    if (user && activeGroup) {
      const todayDate = new Date().toISOString().split('T')[0];
      localStorage.setItem(`summary_seen_${user.id}_${activeGroup.id}_${todayDate}`, 'true');
    }
    setIsModalOpen(false);
    setBoletinData(null);
  };

  /**
   * Consulta notificaciones prioritarias pendientes de lectura.
   */
  const checkUnread = async () => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('disable_notification_modals') === 'true') {
      return;
    }
    try {
      const res = await api.get('/api/notifications/unread');
      if (res.data) {
        setUnreadNotif(res.data);
        setIsModalOpen(true);
      }
    } catch {
      // Ignorar fallos de sondeo
    }
  };

  /**
   * Marca la notificación como leída en la base de datos de manera atómica.
   */
  const markAsRead = async () => {
    if (!unreadNotif) return;
    
    try {
      await api.post(`/api/notifications/${unreadNotif.id}/read`);
    } catch {
      console.warn("Error marking notification as read");
    } finally {
      setIsModalOpen(false);
      setUnreadNotif(null);
    }
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-dracula-card w-full max-w-sm rounded-3xl border-2 border-[#8be9fd]/50 p-6 shadow-[0_0_40px_rgba(139,233,253,0.3)] relative flex flex-col items-center text-center">
        
        {/* Ícono superior */}
        <div className="w-16 h-16 rounded-full bg-[#8be9fd]/20 flex items-center justify-center text-[#8be9fd] mb-4 border border-[#8be9fd]/50 shadow-[0_0_15px_rgba(139,233,253,0.4)] animate-bounce">
          <BellRing size={32} />
        </div>

        {/* Título */}
        <h2 className="text-xl font-black text-dracula-light uppercase tracking-wide mb-2">
          {unreadNotif.titulo}
        </h2>
        
        {/* Mensaje */}
        <p className="text-sm text-dracula-gray mb-6 whitespace-pre-wrap leading-relaxed">
          {unreadNotif.mensaje}
        </p>
        
        {/* Imagen opcional (si tiene) */}
        {unreadNotif.media_url && (
          <img src={unreadNotif.media_url} alt="Notificación" className="w-full rounded-xl mb-6 max-h-48 object-cover border border-dracula-gray/20" />
        )}

        {/* Botón de cierre */}
        <button 
          onClick={markAsRead}
          className="w-full py-3 rounded-xl font-black text-dracula-base bg-[#8be9fd] hover:bg-[#8be9fd]/80 transition-colors shadow-lg flex justify-center items-center gap-2 uppercase tracking-widest text-sm"
        >
          <Check size={18} strokeWidth={3} /> Entendido
        </button>
      </div>
    </div>
  );
}
