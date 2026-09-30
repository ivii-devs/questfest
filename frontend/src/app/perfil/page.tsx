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
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black">
      <div className="border-dracula-purple h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"></div>
      <span className="text-dracula-gray text-sm font-bold tracking-widest uppercase">
        Cargando perfil...
      </span>
    </div>
  );
}
