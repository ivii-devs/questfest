'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';

export default function SWRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registrado con exito en el scope:', registration.scope);

            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    toast(
                      (t) => (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-dracula-light">
                            Nueva versión disponible de la app.
                          </span>
                          <button
                            onClick={() => {
                              toast.dismiss(t.id);
                              installingWorker.postMessage({ action: 'skipWaiting' });
                              window.location.reload();
                            }}
                            className="bg-dracula-purple text-dracula-base text-xs font-bold px-2.5 py-1 rounded shadow hover:opacity-90 transition-opacity"
                          >
                            Actualizar
                          </button>
                        </div>
                      ),
                      { duration: 10000, position: 'bottom-center' }
                    );
                  }
                };
              }
            };
          })
          .catch((error) => {
            console.error('Fallo el registro del Service Worker:', error);
          });
      });
    }
  }, []);

  return null;
}

