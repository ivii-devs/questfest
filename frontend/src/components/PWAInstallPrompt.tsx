'use client';

import { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
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
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone);

    if (isIOS && !isStandalone) {
      setShowIOSPrompt(true);
    }

    // Escuchar evento nativo de instalacion en Android/Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      const promptEvent = e as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setDeferredPrompt(promptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
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
      <div className="bg-dracula-card border-dracula-purple/40 animate-slideUp fixed right-4 bottom-20 left-4 z-50 flex items-center justify-between rounded-xl border p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-dracula-purple text-dracula-base flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black">
            QF
          </div>
          <div className="flex flex-col">
            <span className="text-dracula-light text-xs font-bold">
              Instalar QuestFest App
            </span>
            <span className="text-dracula-gray text-[10px]">
              Acceso rapido y experiencia a pantalla completa
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="bg-dracula-purple text-dracula-base flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-90"
          >
            <Download size={14} /> Instalar
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Cerrar aviso de instalación"
            className="text-dracula-gray hover:text-dracula-light p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Render instructivo para iOS Safari
  if (showIOSPrompt) {
    return (
      <div className="bg-dracula-card border-dracula-cyan/40 animate-slideUp fixed right-4 bottom-20 left-4 z-50 flex flex-col gap-2 rounded-xl border p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share size={16} className="text-dracula-cyan" />
            <span className="text-dracula-light text-xs font-bold">
              Instalar en tu iPhone
            </span>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Cerrar aviso de instalación"
            className="text-dracula-gray hover:text-dracula-light p-1"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-dracula-gray text-[11px] leading-relaxed">
          Pulsa el boton{' '}
          <strong className="text-dracula-light">
            Compartir <Share size={10} className="inline" />
          </strong>{' '}
          en Safari y luego selecciona{' '}
          <strong className="text-dracula-light">
            Añadir a pantalla de inicio{' '}
            <PlusSquare size={10} className="inline" />
          </strong>{' '}
          para instalar QuestFest.
        </p>
      </div>
    );
  }

  return null;
}
