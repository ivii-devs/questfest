'use client';

/**
 * ============================================================================
 * ENRUTADOR RAÍZ DE ENTRADA (Root Gateway): QuestFest PWA
 * ============================================================================
 * Punto de entrada base de la aplicación (URL '/').
 * 
 * Responsabilidad única:
 * Dirigir de forma inmediata y sin parpadeos al usuario según su estado de sesión:
 * 1. Si no dispone de sesión autenticada: Redirige a '/login'.
 * 2. Si cuenta con sesión iniciada: Redirige al Hub de Bienvenida ('/groups') donde
 *    visualiza sus comunidades, su perfil global y los ajustes de la app.
 * ============================================================================
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RootPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else {
        router.replace('/groups');
      }
    }
  }, [authLoading, user, router]);

  // Pantalla de espera neutra con tokens visuales del App Shell para prevenir FOUC
  return (
    <div className="fixed inset-0 w-full h-[100dvh] flex flex-col items-center justify-center bg-[var(--theme-app-bg)] text-dracula-light select-none">
      <div className="w-10 h-10 border-3 border-dracula-purple/30 border-t-dracula-purple rounded-full animate-spin mb-4" />
      <span className="text-xs font-bold tracking-widest text-dracula-gray uppercase animate-pulse">
        Cargando QuestFest...
      </span>
    </div>
  );
}
