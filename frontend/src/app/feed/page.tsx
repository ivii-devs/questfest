'use client';

/**
 * ============================================================================
 * PÁGINA DEL MURO SOCIAL COMUNITARIO (Feed): QuestFest PWA
 * ============================================================================
 * Vista central de publicaciones e interacciones de la comunidad activa (/feed).
 *
 * Componentes clave integrados:
 * 1. App Shell Inmersivo: Cabecera fija con selector rápido de grupo (`GroupSwitcher`),
 *    área central de desplazamiento independiente (`app-shell-scroll`) y barra inferior.
 * 2. Gesto Táctil Pull-to-Refresh: Permite refrescar publicaciones y saldo deslizando hacia abajo.
 * 3. Banner Server-Driven de Ruleta Diaria: Indica si el jugador tiene su tirada diaria
 *    disponible o si ya fue utilizada hoy.
 * 4. Infinite Scroll con Sentinel: Carga fluida de más publicaciones conforme el usuario desciende.
 * 5. Guarda de Seguridad: Si el usuario no tiene un grupo activo seleccionado, lo redirige
 *    inmediatamente al Welcome Hub (`/groups`).
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Dna, ChevronRight, Home } from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';
import CreatePostForm from '@/components/CreatePostForm';
import FeedCard from '@/components/FeedCard';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import { useFeedStream } from '@/hooks/useFeedStream';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import GroupSwitcher from '@/components/groups/GroupSwitcher';
import { useRouter } from 'next/navigation';

// Carga perezosa (Dynamic Imports) para reducir el bundle inicial
const BalanceNotificationModal = dynamic(
  () => import('@/components/BalanceNotificationModal'),
  { ssr: false }
);
const RouletteModal = dynamic(() => import('@/components/RouletteModal'), {
  ssr: false,
});

export default function FeedPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const { activeGroup, groups, loading: groupsLoading } = useGroup();
  const {
    posts,
    hasMore,
    isLoadingMore,
    error,
    fetchInitialPosts,
    loadMorePosts,
  } = useFeedStream(user, activeGroup?.id);
  const { lastElementRef } = useInfiniteScroll(
    isLoadingMore,
    hasMore,
    loadMorePosts
  );

  // Redirigir al Hub si no hay grupo activo seleccionado o el usuario no pertenece a ningún grupo
  useEffect(() => {
    if (!authLoading && !groupsLoading) {
      if (!user) {
        router.replace('/login');
      } else if (!activeGroup || groups.length === 0) {
        router.replace('/groups');
      }
    }
  }, [authLoading, groupsLoading, user, activeGroup, groups.length, router]);

  // Estado del Modal de Ruleta
  const [isRouletteModalOpen, setIsRouletteModalOpen] = useState(false);
  const [hasSpunToday, setHasSpunToday] = useState(false);

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const spun = localStorage.getItem(`roulette_spun_${todayStr}`);
    if (spun) setHasSpunToday(true);
  }, [isRouletteModalOpen]);

  // Si la autenticación o los grupos están en carga inicial en frío, o no hay grupo activo,
  // mostramos el marco de espera neutro del App Shell para prevenir cualquier parpadeo de contenido (FOUC).
  if (authLoading || (!activeGroup && groupsLoading) || !activeGroup) {
    return (
      <div className="text-dracula-light fixed inset-0 flex h-[100dvh] w-full flex-col items-center justify-center bg-[var(--theme-app-bg)] select-none">
        <div className="border-dracula-purple/30 border-t-dracula-purple mb-4 h-10 w-10 animate-spin rounded-full border-3" />
        <span className="text-dracula-gray animate-pulse text-xs font-bold tracking-widest uppercase">
          Cargando QuestFest...
        </span>
      </div>
    );
  }

  return (
    <div className="app-shell-page text-dracula-light bg-black">
      {/* Modales cargados dinámicamente bajo demanda */}
      <BalanceNotificationModal />

      {isRouletteModalOpen && (
        <RouletteModal onClose={() => setIsRouletteModalOpen(false)} />
      )}

      {/* Cabecera Principal del Feed (App Shell - Capa Superior Fija) */}
      <header className="bg-dracula-base/95 app-shell-header border-dracula-gray/20 pt-safe-top z-40 flex flex-shrink-0 items-center justify-between border-b px-4 pb-3 backdrop-blur-md select-none">
        <div className="flex items-center gap-2.5">
          <Home size={26} className="text-dracula-purple" />
          <div>
            <h1 className="text-dracula-light text-lg font-black tracking-wide uppercase">
              Feed
            </h1>
            <span className="text-dracula-gray block text-[10px] font-bold">
              {activeGroup?.nombre || 'Comunidad'}
            </span>
          </div>
        </div>
        <GroupSwitcher />
      </header>

      {/* Contenido desplazable interno aislado con soporte de Pull to Refresh */}
      <PullToRefresh
        onRefresh={async () => {
          await Promise.all([fetchInitialPosts(), refreshProfile()]);
        }}
      >
        <main className="app-shell-scroll pb-28">
          {/* Banner de la Ruleta Diaria */}
          <section className="mx-4 mt-4 pt-4">
            <button
              onClick={() => setIsRouletteModalOpen(true)}
              aria-label="Abrir la ruleta diaria de misiones"
              className={`w-full transform rounded-xl border p-0.5 text-left shadow-lg transition-all hover:scale-[1.01] ${
                hasSpunToday
                  ? 'bg-dracula-card border-dracula-gray/20 opacity-70'
                  : 'animate-pulse bg-gradient-to-r from-[#ffb86c] to-[#ff79c6]'
              }`}
            >
              <div className="bg-dracula-base flex items-center justify-between rounded-[10px] p-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-full p-2 ${
                      hasSpunToday
                        ? 'bg-dracula-gray/10 text-dracula-gray'
                        : 'bg-[#ffb86c]/20 text-[#ffb86c]'
                    }`}
                  >
                    <Dna size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-dracula-light text-sm font-black tracking-wide uppercase">
                      {hasSpunToday
                        ? 'Ruleta Diaria Consultada'
                        : 'Misión Especial Disponible'}
                    </span>
                    <span className="text-dracula-gray text-[10px] font-semibold">
                      {hasSpunToday
                        ? 'Ya has reclamado tu reto de hoy. Vuelve mañana.'
                        : 'Toca aquí para girar el bombo de retos exclusivos.'}
                    </span>
                  </div>
                </div>
                <ChevronRight
                  className={
                    hasSpunToday ? 'text-dracula-gray' : 'text-[#ffb86c]'
                  }
                  size={20}
                />
              </div>
            </button>
          </section>

          {/* Formulario para publicar nuevo reto/mensaje */}
          <section className="mx-4 mt-4">
            <CreatePostForm
              user={user}
              onPostCreated={fetchInitialPosts}
              groupId={activeGroup.id}
            />
          </section>

          {/* Mensaje de error de API si falla la conexión */}
          {error && (
            <div className="bg-dracula-red/10 border-dracula-red/30 text-dracula-red mx-4 mt-4 flex items-center justify-between rounded-lg border p-3 text-xs">
              <span>{error}</span>
              <button
                onClick={fetchInitialPosts}
                className="bg-dracula-red rounded px-2 py-1 text-[10px] font-bold text-white hover:opacity-90"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Lista de Publicaciones en el Feed */}
          <section className="flex flex-col gap-4 p-4">
            {posts.map((post, index) => (
              <div
                key={post.id}
                ref={index === posts.length - 1 ? lastElementRef : null}
              >
                <FeedCard post={post} onRefresh={fetchInitialPosts} />
              </div>
            ))}

            {isLoadingMore && (
              <div className="text-dracula-purple animate-pulse py-4 text-center text-xs font-bold">
                Cargando más retos y misiones...
              </div>
            )}
          </section>
        </main>
      </PullToRefresh>
    </div>
  );
}
