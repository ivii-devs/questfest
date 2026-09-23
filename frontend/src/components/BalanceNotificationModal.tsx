'use client';

import { useState, useEffect } from 'react';
import { Check, Coins, TrendingDown, TrendingUp } from 'lucide-react';

export default function BalanceNotificationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [alertData, setAlertData] = useState<any | null>(null);

  useEffect(() => {
    // Simulamos que el usuario que inicia la app es "Colega1" para poder verificar los testings visuales locales
    const currentUser = 'Colega1';
    const storageKey = `balance_alert_${currentUser}`;
    const cachedAlert = localStorage.getItem(storageKey);

    // Si el administrador guardó una alerta para este usuario, la cargamos
    if (cachedAlert) {
      setAlertData(JSON.parse(cachedAlert));
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    // Eliminamos la alerta para que no se repita en el siguiente inicio
    const currentUser = 'Colega1';
    localStorage.removeItem(`balance_alert_${currentUser}`);
    setIsOpen(false);
  };

  if (!isOpen || !alertData) return null;

  const isFine = alertData.type === 'subtract';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className={`bg-dracula-base w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col relative border-2 ${
          isFine ? 'border-dracula-red' : 'border-dracula-green'
        }`}
      >
        {/* Banner de Estado */}
        <div
          className={`p-5 text-center text-dracula-base font-bold ${
            isFine ? 'bg-dracula-red' : 'bg-dracula-green'
          }`}
        >
          <div className="mx-auto w-12 h-12 bg-dracula-base rounded-full flex items-center justify-center mb-2 shadow-md">
            {isFine ? (
              <TrendingDown size={24} className="text-dracula-red" />
            ) : (
              <TrendingUp size={24} className="text-dracula-green" />
            )}
          </div>
          <h2 className="text-lg uppercase tracking-wider font-black">
            {isFine ? '¡Has sido Penalizado!' : '¡Notificación de Saldo!'}
          </h2>
        </div>

        {/* Detalles del Ajuste */}
        <div className="p-5 flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2 bg-dracula-card px-4 py-2 rounded-xl border border-dracula-gray/20">
            <Coins size={20} className="text-dracula-yellow" />
            <span
              className={`text-xl font-mono font-black ${
                isFine ? 'text-dracula-red' : 'text-dracula-green'
              }`}
            >
              {isFine ? '-' : '+'}
              {alertData.amount} QuestCoins
            </span>
          </div>

          <div className="flex flex-col gap-1 w-full">
            <span className="text-[10px] text-dracula-gray uppercase font-bold tracking-widest block mb-1">
              Motivo del ajuste
            </span>
            <p className="text-sm font-medium text-dracula-light bg-dracula-card p-3 rounded-xl border border-dracula-gray/10 italic leading-relaxed">
              "{alertData.reason}"
            </p>
          </div>
        </div>

        {/* Botón de Confirmación */}
        <div className="p-4 border-t border-dracula-gray/20 bg-dracula-card/20">
          <button
            onClick={handleClose}
            className={`w-full py-3 rounded-xl font-bold text-sm text-dracula-base flex items-center justify-center gap-2 uppercase tracking-wide hover:opacity-90 ${
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
