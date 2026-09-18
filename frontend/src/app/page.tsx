'use client';

/**
 * ============================================================================
 * PÁGINA PRINCIPAL DEL MURO SOCIAL (Feed Home): QuestFest PWA
 * ============================================================================
 * Vista central de la experiencia comunitaria.
 * 
 * Componentes clave integrados:
 * 1. App Shell Inmersivo: Cabecera fija con selector rápido de grupo (`GroupSwitcher`),
 *    área central de desplazamiento independiente (`app-shell-scroll`) y barra inferior.
 * 2. Gesto Táctil Pull-to-Refresh: Permite refrescar publicaciones y saldo deslizando hacia abajo.
 * 3. Banner Server-Driven de Ruleta Diaria: Indica si el jugador tiene su tirada diaria
 *    disponible o si ya fue utilizada hoy.
 * 4. Infinite Scroll con Sentinel: Carga fluida de más publicaciones conforme el usuario desciende.
 * 5. Redirección Inteligente: Si el usuario no pertenece a ningún grupo, lo redirige
 *    inmediatamente al Welcome Hub (`/groups`).
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Dna, ChevronRight } from 'lucide-react';
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
const BalanceNotificationModal = dynamic(() => import('@/components/BalanceNotificationModal'), { ssr: false });
const RouletteModal = dynamic(() => import('@/components/RouletteModal'), { ssr: false });

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const { activeGroup, groups, loading: groupsLoading } = useGroup();
  const { posts, hasMore, isLoadingMore, error, fetchInitialPosts, loadMorePosts } = useFeedStream(user, activeGroup?.id);
  const { lastElementRef } = useInfiniteScroll(isLoadingMore, hasMore, loadMorePosts);

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

  // Si la autenticación o los grupos están cargando, o no hay grupo activo (en proceso de redirección al Hub),
  // mostramos el marco de espera neutro del App Shell para prevenir cualquier parpadeo de contenido (FOUC).
  if (authLoading || groupsLoading || !activeGroup) {
    return (
      <div className="fixed inset-0 w-full h-[100dvh] flex flex-col items-center justify-center bg-[var(--theme-app-bg)] text-dracula-light select-none">
        <div className="w-10 h-10 border-3 border-dracula-purple/30 border-t-dracula-purple rounded-full animate-spin mb-4" />
        <span className="text-xs font-bold tracking-widest text-dracula-gray uppercase animate-pulse">
          Cargando QuestFest...
        </span>
      </div>
    );
  }

  return (
    <div className="app-shell-page bg-black text-dracula-light">
      {/* Modales cargados dinámicamente bajo demanda */}
      <BalanceNotificationModal />

      {isRouletteModalOpen && (
        <RouletteModal onClose={() => setIsRouletteModalOpen(false)} />
      )}

      {/* Cabecera Principal del Feed (App Shell - Capa Superior Fija) */}
      <header className="flex-shrink-0 bg-dracula-base/95 backdrop-blur-md z-40 app-shell-header border-b border-dracula-gray/20 pt-safe-top pb-3 px-4 flex items-center justify-between select-none">
        <div>
          <h1 className="text-lg font-black text-dracula-light uppercase tracking-wide">
            Feed
          </h1>
          <span className="text-[10px] text-dracula-gray font-bold block">
            Comunidad: {activeGroup?.nombre || 'Selecciona un grupo'}
          </span>
        </div>
        <GroupSwitcher />
      </header>

      {/* Contenido desplazable interno aislado con soporte de Pull to Refresh */}
      <PullToRefresh onRefresh={async () => { await Promise.all([fetchInitialPosts(), refreshProfile()]); }}>
        <main className="app-shell-scroll pb-28">

        {/* Banner de la Ruleta Diaria */}
        <section className="mx-4 mt-4 pt-4">
          <button
            onClick={() => setIsRouletteModalOpen(true)}
            aria-label="Abrir la ruleta diaria de misiones"
            className={`w-full text-left p-0.5 rounded-xl shadow-lg transform hover:scale-[1.01] transition-all border ${
              hasSpunToday
                ? 'bg-dracula-card border-dracula-gray/20 opacity-70'
                : 'bg-gradient-to-r from-[#ffb86c] to-[#ff79c6] animate-pulse'
            }`}
          >
            <div className="bg-dracula-base rounded-[10px] p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-full ${
                    hasSpunToday
                      ? 'bg-dracula-gray/10 text-dracula-gray'
                      : 'bg-[#ffb86c]/20 text-[#ffb86c]'
                  }`}
                >
                  <Dna size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-dracula-light uppercase tracking-wide">
                    {hasSpunToday
                      ? 'Ruleta Diaria Consultada'
                      : 'Misión Especial Disponible'}
                  </span>
                  <span className="text-[10px] text-dracula-gray font-semibold">
                    {hasSpunToday
                      ? 'Ya has reclamado tu reto de hoy. Vuelve mañana.'
                      : 'Toca aquí para girar el bombo de retos exclusivos.'}
                  </span>
                </div>
              </div>
              <ChevronRight
                className={hasSpunToday ? 'text-dracula-gray' : 'text-[#ffb86c]'}
                size={20}
              />
            </div>
          </button>
        </section>

        {/* Formulario para publicar nuevo reto/mensaje */}
        <section className="mx-4 mt-4">
          <CreatePostForm user={user} onPostCreated={fetchInitialPosts} groupId={activeGroup?.id} />
        </section>

        {/* Mensaje de error de API si falla la conexión */}
        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-dracula-red/10 border border-dracula-red/30 text-dracula-red text-xs flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={fetchInitialPosts}
              className="bg-dracula-red text-white text-[10px] font-bold px-2 py-1 rounded hover:opacity-90"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Lista de Publicaciones en el Feed */}
        <section className="p-4 flex flex-col gap-4">
          {posts.map((post, index) => (
            <div key={post.id} ref={index === posts.length - 1 ? lastElementRef : null}>
              <FeedCard post={post} onRefresh={fetchInitialPosts} />
            </div>
          ))}

          {isLoadingMore && (
            <div className="text-center py-4 text-xs font-bold text-dracula-purple animate-pulse">
              Cargando más retos y misiones...
            </div>
          )}
        </section>
      </main>
    </PullToRefresh>
  </div>
  );
}
