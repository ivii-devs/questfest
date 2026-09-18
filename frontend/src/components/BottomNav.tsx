'use client';

import { useState, useEffect } from 'react';
import { Home, Target, Swords, Dice5, Trophy, BarChart2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import api from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';

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
  const [hasNewPosts, setHasNewPosts] = useState(false);

  // Ocultar la barra en vistas fuera de un grupo o de configuración/perfil global
  const isExcludedPath = 
    pathname.startsWith('/groups') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/join') ||
    pathname.startsWith('/offline') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/perfil');

  useEffect(() => {
    // Si no hay usuario logueado, no hay grupo activo o estamos en vistas excluidas/cargando, no hacemos polling
    if (!user || !activeGroup || authLoading || groupsLoading || isExcludedPath) return;

    // Si estamos en la página del feed, marcamos que no hay posts pendientes
    if (pathname === '/') {
      setHasNewPosts(false);
    }

    const checkLatestPost = async () => {
      try {
        if (pathname === '/') return; 
        
        const params = activeGroup ? { group_id: activeGroup.id } : {};
        const res = await api.get('/api/feed/latest-id', { params });
        const latestId = res.data;
        
        const lastSeenIdStr = localStorage.getItem(`last_seen_post_id_${activeGroup?.id || 'global'}`);
        const lastSeenId = lastSeenIdStr ? parseInt(lastSeenIdStr, 10) : 0;
        
        if (latestId > lastSeenId) {
          setHasNewPosts(true);
        } else {
          setHasNewPosts(false);
        }
      } catch {
        // Fallo silencioso de polling
      }
    };

    checkLatestPost();
    const interval = setInterval(checkLatestPost, 15000);
    return () => clearInterval(interval);
  }, [user, pathname, activeGroup, isExcludedPath, authLoading, groupsLoading]);

  // Ocultamos la barra en vistas excluidas, durante la fase de carga inicial,
  // o si el usuario no tiene un grupo activo seleccionado (evitando parpadeos en el arranque).
  if (isExcludedPath || authLoading || groupsLoading || !user || !activeGroup) {
    return null;
  }

  // Comprobamos si el usuario es administrador en el grupo actualmente seleccionado
  const isGroupAdmin = activeGroup?.rol === 'admin';

  // Definición base de las 6 pestañas con sus identidades cromáticas de panel
  const baseItems = [
    { name: 'Feed', icon: Home, path: '/', colorClass: 'text-dracula-purple', bgClass: 'bg-dracula-purple/20' },
    { name: 'Ranking', icon: Trophy, path: '/ranking', colorClass: 'text-dracula-yellow', bgClass: 'bg-dracula-yellow/20' },
    { name: 'Apuestas', icon: Dice5, path: '/bets', colorClass: 'text-dracula-yellow', bgClass: 'bg-dracula-yellow/20' },
    { name: 'Misiones', icon: Target, path: '/missions', colorClass: 'text-dracula-green', bgClass: 'bg-dracula-green/20' },
    { name: 'Duelos', icon: Swords, path: '/duels', colorClass: 'text-dracula-red', bgClass: 'bg-dracula-red/20' },
    { name: 'Stats', icon: BarChart2, path: '/stats', colorClass: 'text-dracula-cyan', bgClass: 'bg-dracula-cyan/20' },
  ];

  // Si es administrador del grupo, inyectamos la 7ª pestaña: Admin
  const navItems = isGroupAdmin
    ? [...baseItems, { name: 'Admin', icon: ShieldCheck, path: '/admin', colorClass: 'text-dracula-purple', bgClass: 'bg-dracula-purple/20' }]
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
    <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[94%] max-w-lg bottom-nav-glass backdrop-blur-2xl border rounded-full z-50 select-none transition-colors duration-300">
      <div className={`flex justify-between items-center ${navItems.length === 7 ? 'px-2 py-1.5' : 'px-3 py-1.5'}`}>
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.name}
              href={item.path}
              aria-label={item.name}
              className={`flex flex-col items-center justify-center gap-0.5 relative flex-1 py-1 px-1 rounded-2xl transition-all duration-150 ease-out active:scale-90 select-none ${
                isActive
                  ? `${item.colorClass} font-black`
                  : 'text-dracula-gray hover:text-dracula-light'
              }`}
            >
              {/* Píldora luminosa de fondo para la pestaña activa */}
              {isActive && (
                <span className={`absolute inset-0 ${item.bgClass} rounded-xl -z-10 shadow-sm`} />
              )}

              <item.icon
                size={navItems.length === 7 ? 20 : 22}
                className={isActive ? item.colorClass : ''}
              />

              {/* Indicador de nuevos posts no leídos en el feed */}
              {item.path === '/' && hasNewPosts && !isActive && (
                <span className="absolute top-1 right-2 w-2 h-2 bg-dracula-red rounded-full border border-dracula-base animate-pulse shadow-md"></span>
              )}

              <span className={`tracking-tight text-center leading-none ${
                navItems.length === 7 ? 'text-[9px]' : 'text-[10px]'
              }`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
