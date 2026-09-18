'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirección canónica de compatibilidad para la ruta anterior /settings/editar.
 * 
 * En la arquitectura Multi-Grupo de QuestFest v2.0, la gestión de identidad global del jugador
 * (avatar sincronizado con Cloudinary, nombre de usuario y biografía/estado) se realiza
 * de forma interactiva y directa (in-place) desde la pestaña «Mi perfil» del Welcome Hub
 * (/groups?tab=perfil).
 * 
 * Redirigimos inmediatamente al usuario para consolidar una única vía de edición y evitar
 * pantallas huérfanas con bucles de retorno obsoletos.
 */
export default function EditProfileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/groups?tab=perfil');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3 select-none">
      <div className="w-10 h-10 border-4 border-dracula-purple border-t-transparent rounded-full animate-spin"></div>
      <span className="text-sm font-bold text-dracula-gray uppercase tracking-widest">
        Cargando Perfil...
      </span>
    </div>
  );
}
