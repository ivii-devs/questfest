'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useNetworkStore } from '@/store/useNetworkStore';

export default function SWRegister() {
  useEffect(() => {
    // Sincronización reactiva del estado de red online/offline
    const cleanupNetwork = useNetworkStore.getState().initNetworkListeners();

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log(
              'Service Worker registrado con exito en el scope:',
              registration.scope
            );

            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (
                    installingWorker.state === 'installed' &&
                    navigator.serviceWorker.controller
                  ) {
                    toast(
                      (t) => (
                        <div className="flex items-center gap-3">
                          <span className="text-dracula-light text-xs font-semibold">
                            Nueva versión disponible de la app.
                          </span>
                          <button
                            onClick={() => {
                              toast.dismiss(t.id);
                              installingWorker.postMessage({
                                action: 'skipWaiting',
                              });
                              window.location.reload();
                            }}
                            className="bg-dracula-purple text-dracula-base rounded px-2.5 py-1 text-xs font-bold shadow transition-opacity hover:opacity-90"
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

    return () => {
      cleanupNetwork();
    };
  }, []);

  return null;
}
