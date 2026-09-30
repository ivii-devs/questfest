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
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black select-none">
      <div className="border-dracula-purple h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"></div>
      <span className="text-dracula-gray text-sm font-bold tracking-widest uppercase">
        Cargando Ajustes...
      </span>
    </div>
  );
}
