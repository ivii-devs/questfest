'use client';

/**
 * ============================================================================
 * MODAL DE NOTIFICACIÓN DE AJUSTE DE SALDO (BalanceNotificationModal)
 * ============================================================================
 * Informa al jugador de manera explícita si un administrador ha bonificado
 * o penalizado su cuenta con QuestCoins.
 * Consume dinámicamente el usuario autenticado para evitar fugas contables locales.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Check, Coins, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface BalanceAlertData {
  type: 'add' | 'subtract';
  amount: number;
  reason: string;
}

export default function BalanceNotificationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [alertData, setAlertData] = useState<BalanceAlertData | null>(null);
  const currentUsername = useAuthStore((state) => state.user?.username);

  useEffect(() => {
    if (!currentUsername) return;

    const storageKey = `balance_alert_${currentUsername}`;
    const cachedAlert = localStorage.getItem(storageKey);

    // Si el administrador guardó una alerta para este usuario específico, la cargamos
    if (cachedAlert) {
      try {
        const parsed: BalanceAlertData = JSON.parse(cachedAlert);
        setAlertData(parsed);
        setIsOpen(true);
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
  }, [currentUsername]);

  const handleClose = () => {
    if (currentUsername) {
      localStorage.removeItem(`balance_alert_${currentUsername}`);
    }
    setIsOpen(false);
  };

  if (!isOpen || !alertData) return null;

  const isFine = alertData.type === 'subtract';

  return (
    <div className="animate-fadeIn fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        className={`bg-dracula-base relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border-2 shadow-2xl ${
          isFine ? 'border-dracula-red' : 'border-dracula-green'
        }`}
      >
        {/* Banner de Estado */}
        <div
          className={`text-dracula-base p-5 text-center font-bold ${
            isFine ? 'bg-dracula-red' : 'bg-dracula-green'
          }`}
        >
          <div className="bg-dracula-base mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full shadow-md">
            {isFine ? (
              <TrendingDown size={24} className="text-dracula-red" />
            ) : (
              <TrendingUp size={24} className="text-dracula-green" />
            )}
          </div>
          <h2 className="text-lg font-black tracking-wider uppercase">
            {isFine ? '¡Has sido Penalizado!' : '¡Notificación de Saldo!'}
          </h2>
        </div>

        {/* Detalles del Ajuste */}
        <div className="flex flex-col items-center gap-4 p-5 text-center">
          <div className="bg-dracula-card border-dracula-gray/20 flex items-center gap-2 rounded-xl border px-4 py-2">
            <Coins size={20} className="text-dracula-yellow" />
            <span
              className={`font-mono text-xl font-black ${
                isFine ? 'text-dracula-red' : 'text-dracula-green'
              }`}
            >
              {isFine ? '-' : '+'}
              {alertData.amount} QuestCoins
            </span>
          </div>

          <div className="flex w-full flex-col gap-1">
            <span className="text-dracula-gray mb-1 block text-[10px] font-bold tracking-widest uppercase">
              Motivo del ajuste
            </span>
            <p className="text-dracula-light bg-dracula-card border-dracula-gray/10 rounded-xl border p-3 text-sm leading-relaxed font-medium italic">
              &ldquo;{alertData.reason}&rdquo;
            </p>
          </div>
        </div>

        {/* Botón de Confirmación */}
        <div className="border-dracula-gray/20 bg-dracula-card/20 border-t p-4">
          <button
            onClick={handleClose}
            className={`text-dracula-base flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold tracking-wide uppercase hover:opacity-90 ${
              isFine ? 'bg-dracula-red' : 'bg-dracula-green'
            }`}
          >
            <Check size={16} strokeWidth={2.5} /> Confirmar Lectura
          </button>
        </div>
      </div>
    </div>
  );
}
