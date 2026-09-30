'use client';

/**
 * ============================================================================
 * PESTAÑA DE AJUSTES GENERALES DEL HUB (WelcomeSettingsTab)
 * ============================================================================
 * Centraliza la configuración visual de temas (ThemeSettingsCard),
 * la suscripción a notificaciones push Web (VAPID), el estado PWA y logout.
 * ============================================================================
 */

import React, { useState } from 'react';
import { Bell, Check, Download, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import ThemeSettingsCard from '@/components/ThemeSettingsCard';
import { subscribeToPushNotifications } from '@/lib/pushNotifications';
import { useAuth } from '@/context/AuthContext';

export default function WelcomeSettingsTab() {
  const { logout } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const handlePushSubscribe = async () => {
    setPushLoading(true);
    try {
      const res = await subscribeToPushNotifications();
      if (res.success) {
        setPushEnabled(true);
        toast.success(res.message);
      } else {
        if (
          res.status === 'requires_https' ||
          res.status === 'requires_pwa_install'
        ) {
          toast(res.message, { icon: 'ℹ️', duration: 6500 });
        } else {
          toast.error(res.message);
        }
      }
    } catch {
      toast.error('Error solicitando notificaciones push');
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div className="animate-fade-in mx-auto max-w-lg space-y-4">
      {/* Control de Tema y Paleta Cromática */}
      <ThemeSettingsCard />

      <div className="bg-dracula-card border-dracula-gray/20 divide-dracula-gray/20 divide-y overflow-hidden rounded-2xl border shadow-xl">
        {/* Notificaciones del Dispositivo */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="bg-dracula-cyan/10 text-dracula-cyan rounded-xl p-2.5">
              <Bell size={20} />
            </div>
            <div>
              <h4 className="text-dracula-light text-sm font-bold">
                Notificaciones Push
              </h4>
              <p className="text-dracula-gray text-xs">
                Avisos de duelos y misiones en vivo
              </p>
            </div>
          </div>
          {pushEnabled ? (
            <span className="bg-dracula-green/10 text-dracula-green border-dracula-green/30 flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold">
              <Check size={14} /> Activadas
            </span>
          ) : (
            <button
              onClick={handlePushSubscribe}
              disabled={pushLoading}
              className="bg-dracula-base text-dracula-cyan border-dracula-cyan/30 hover:bg-dracula-cyan hover:text-dracula-base rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
            >
              {pushLoading ? 'Activando...' : 'Permitir'}
            </button>
          )}
        </div>

        {/* Instalación de la PWA */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#50fa7b]/10 p-2.5 text-[#50fa7b]">
              <Download size={20} />
            </div>
            <div>
              <h4 className="text-dracula-light text-sm font-bold">
                App Progresiva (PWA)
              </h4>
              <p className="text-dracula-gray text-xs">
                Instala QuestFest en tu pantalla de inicio
              </p>
            </div>
          </div>
          <span className="rounded-lg bg-[#50fa7b]/10 px-2.5 py-1 text-[11px] font-black text-[#50fa7b] uppercase">
            Instalable
          </span>
        </div>

        {/* Cerrar Sesión */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="bg-dracula-red/10 text-dracula-red rounded-xl p-2.5">
              <LogOut size={20} />
            </div>
            <div>
              <h4 className="text-dracula-red text-sm font-bold">
                Cerrar Sesión
              </h4>
              <p className="text-dracula-gray text-xs">
                Salir de tu cuenta en este dispositivo
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="bg-dracula-red text-dracula-base rounded-lg px-3.5 py-1.5 text-xs font-bold transition-opacity hover:opacity-90"
          >
            Salir
          </button>
        </div>
      </div>

      <div className="pt-4 text-center">
        <span className="text-dracula-gray text-[11px] font-semibold">
          QuestFest v2.0 • Arquitectura Multi-Grupo Aislada
        </span>
      </div>
    </div>
  );
}
