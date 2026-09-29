'use client';

import { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Comprobar si ya esta instalada o descartada en esta sesion
    const dismissed = sessionStorage.getItem('pwa_prompt_dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Detectar si es iOS y no esta corriendo en modo standalone
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    if (isIOS && !isStandalone) {
      setShowIOSPrompt(true);
    }

    // Escuchar evento nativo de instalacion en Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('El usuario acepto instalar QuestFest');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (isDismissed) return null;

  // Render para Android/Chrome con evento beforeinstallprompt
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 bg-dracula-card border border-dracula-purple/40 rounded-xl p-4 shadow-2xl z-50 flex items-center justify-between animate-slideUp">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-dracula-purple text-dracula-base font-black rounded-lg flex items-center justify-center text-sm shrink-0">
            QF
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-dracula-light">Instalar QuestFest App</span>
            <span className="text-[10px] text-dracula-gray">Acceso rapido y experiencia a pantalla completa</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="bg-dracula-purple text-dracula-base px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <Download size={14} /> Instalar
          </button>
          <button onClick={handleDismiss} aria-label="Cerrar aviso de instalación" className="text-dracula-gray p-1 hover:text-dracula-light">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Render instructivo para iOS Safari
  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 bg-dracula-card border border-dracula-cyan/40 rounded-xl p-4 shadow-2xl z-50 flex flex-col gap-2 animate-slideUp">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share size={16} className="text-dracula-cyan" />
            <span className="text-xs font-bold text-dracula-light">Instalar en tu iPhone</span>
          </div>
          <button onClick={handleDismiss} aria-label="Cerrar aviso de instalación" className="text-dracula-gray p-1 hover:text-dracula-light">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-dracula-gray leading-relaxed">
          Pulsa el boton <strong className="text-dracula-light">Compartir <Share size={10} className="inline" /></strong> en Safari y luego selecciona <strong className="text-dracula-light">Añadir a pantalla de inicio <PlusSquare size={10} className="inline" /></strong> para instalar QuestFest.
        </p>
      </div>
    );
  }

  return null;
}
