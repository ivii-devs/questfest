'use client';

import { useEffect } from 'react';
import {
  Home,
  Target,
  Swords,
  Dice5,
  Trophy,
  BarChart2,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import { useNotificationStore } from '@/store/useNotificationStore';

/**
 * Barra de navegación inferior (BottomNav) adaptada a la arquitectura Multi-Grupo.
 *
 * Reglas de visibilidad y estructura:
 * 1. Oculta en páginas globales: /groups (Welcome Hub), /login, /register, /join.
 * 2. Para miembros estándar dentro de un grupo (6 pestañas):
 *    [Feed, Ranking, Apuestas, Misiones, Duelos, Estadísticas]
 * 3. Para administradores del grupo activo (7 pestañas):
 *    [Feed, Ranking, Apuestas, Misiones, Duelos, Estadísticas, Admin]
 *
 * Esta configuración sitúa el acceso al panel administrativo a un toque de distancia
 * para los líderes de grupo, mientras preserva una experiencia despejada para los demás.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { activeGroup, loading: groupsLoading } = useGroup();
  const hasUnreadPost = useNotificationStore((state) => state.hasUnreadPost);

  // Ocultar la barra en vistas fuera de un grupo o de configuración/perfil global
  const isExcludedPath =
    pathname.startsWith('/groups') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/join') ||
    pathname.startsWith('/offline') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/perfil');

  // Si estamos en la página del feed, marcar inmediatamente como visto
  useEffect(() => {
    if (pathname === '/feed' && activeGroup?.id) {
      const latestPostId = useNotificationStore.getState().latestPostId;
      useNotificationStore
        .getState()
        .markGroupFeedSeen(activeGroup.id, latestPostId);
    }
  }, [pathname, activeGroup?.id]);

  const hasNewPosts = hasUnreadPost && pathname !== '/feed';

  // Ocultamos la barra en vistas excluidas, durante la fase de carga inicial en frío,
  // o si el usuario no tiene un grupo activo seleccionado.
  // CRÍTICO: Si activeGroup ya está presente en memoria, una revalidación en segundo plano
  // jamás debe desmontar la barra inferior para evitar parpadeos al navegar entre pestañas.
  if (
    isExcludedPath ||
    authLoading ||
    (!activeGroup && groupsLoading) ||
    !user ||
    !activeGroup
  ) {
    return null;
  }

  // Comprobamos si el usuario es administrador en el grupo actualmente seleccionado
  const isGroupAdmin = activeGroup?.rol === 'admin';

  // Definición base de las 6 pestañas con sus identidades cromáticas de panel
  const baseItems = [
    {
      name: 'Feed',
      icon: Home,
      path: '/feed',
      colorClass: 'text-dracula-purple',
      bgClass: 'bg-dracula-purple/20',
    },
    {
      name: 'Ranking',
      icon: Trophy,
      path: '/ranking',
      colorClass: 'text-dracula-yellow',
      bgClass: 'bg-dracula-yellow/20',
    },
    {
      name: 'Apuestas',
      icon: Dice5,
      path: '/bets',
      colorClass: 'text-dracula-yellow',
      bgClass: 'bg-dracula-yellow/20',
    },
    {
      name: 'Misiones',
      icon: Target,
      path: '/missions',
      colorClass: 'text-dracula-green',
      bgClass: 'bg-dracula-green/20',
    },
    {
      name: 'Duelos',
      icon: Swords,
      path: '/duels',
      colorClass: 'text-dracula-red',
      bgClass: 'bg-dracula-red/20',
    },
    {
      name: 'Stats',
      icon: BarChart2,
      path: '/stats',
      colorClass: 'text-dracula-cyan',
      bgClass: 'bg-dracula-cyan/20',
    },
  ];

  // Si es administrador del grupo, inyectamos la 7ª pestaña: Admin
  const navItems = isGroupAdmin
    ? [
        ...baseItems,
        {
          name: 'Admin',
          icon: ShieldCheck,
          path: '/admin',
          colorClass: 'text-dracula-purple',
          bgClass: 'bg-dracula-purple/20',
        },
      ]
    : baseItems;

  return (
    /*
     * Tab Bar Flotante Liquid Glass Adaptativa (iOS 26/27 Aesthetics):
     * - Píldora redondeada ('rounded-full') suspendida a ras del margen inferior ('bottom-3').
     * - Relleno simétrico y compacto ('py-1.5') sin bandas ni márgenes inferiores sobrantes.
     * - Efecto de cristal líquido adaptativo:
     *   - En Modo Oscuro: cristal ahumado oscuro con borde refractivo blanco sutil.
     *   - En Modo Claro: cristal esmerilado blanco nieve (frosted glass) con sombra ambiental suave.
     * - Píldora activa con microinteracción táctil elástica ('active:scale-90') y resplandor armonizado.
     */
    <nav className="bottom-nav-glass fixed bottom-3 left-1/2 z-50 w-[94%] max-w-lg -translate-x-1/2 rounded-full border backdrop-blur-2xl transition-colors duration-300 select-none">
      <div
        className={`flex items-center justify-between ${navItems.length === 7 ? 'px-2 py-1.5' : 'px-3 py-1.5'}`}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.name}
              href={item.path}
              aria-label={item.name}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 transition-all duration-150 ease-out select-none active:scale-90 ${
                isActive
                  ? `${item.colorClass} font-black`
                  : 'text-dracula-gray hover:text-dracula-light'
              }`}
            >
              {/* Píldora luminosa de fondo para la pestaña activa */}
              {isActive && (
                <span
                  className={`absolute inset-0 ${item.bgClass} -z-10 rounded-xl shadow-sm`}
                />
              )}

              <item.icon
                size={navItems.length === 7 ? 20 : 22}
                className={isActive ? item.colorClass : ''}
              />

              {/* Indicador de nuevos posts no leídos en el feed */}
              {item.path === '/feed' && hasNewPosts && !isActive && (
                <span className="bg-dracula-red border-dracula-base absolute top-1 right-2 h-2 w-2 animate-pulse rounded-full border shadow-md"></span>
              )}

              <span
                className={`text-center leading-none tracking-tight ${
                  navItems.length === 7 ? 'text-[9px]' : 'text-[10px]'
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
