'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirección de compatibilidad para la ruta anterior /perfil.
 * Siguiendo la nueva arquitectura multi-grupo, el perfil global de la cuenta
 * ahora reside en el Welcome Hub (/groups?tab=perfil), mientras que las estadísticas
 * e historial de transacciones específicas del grupo residen en /stats.
 */
export default function PerfilRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/groups?tab=perfil');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 border-4 border-dracula-purple border-t-transparent rounded-full animate-spin"></div>
      <span className="text-sm font-bold text-dracula-gray uppercase tracking-widest">
        Cargando perfil...
      </span>
    </div>
  );
}
