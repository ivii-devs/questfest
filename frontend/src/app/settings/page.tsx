'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirección canónica de compatibilidad para la ruta anterior /settings.
 * 
 * En la arquitectura Multi-Grupo de QuestFest v2.0, los ajustes generales de la aplicación
 * (personalización de tema, notificaciones push del dispositivo, estado PWA y cierre de sesión)
 * residen unificados en el Hub de Bienvenida (/groups?tab=ajustes).
 * 
 * Redirigimos inmediatamente al usuario a su ubicación canónica para evitar interfaces
 * obsoletas de versiones previas (antiguas reglas globales, vistas estáticas) y prevenir
 * bucles de navegación innecesarios.
 */
export default function SettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/groups?tab=ajustes');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3 select-none">
      <div className="w-10 h-10 border-4 border-dracula-purple border-t-transparent rounded-full animate-spin"></div>
      <span className="text-sm font-bold text-dracula-gray uppercase tracking-widest">
        Cargando Ajustes...
      </span>
    </div>
  );
}
