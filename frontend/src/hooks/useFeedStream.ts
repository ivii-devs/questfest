/**
 * ============================================================================
 * HOOK DE STREAMING DEL FEED (useFeedStream): QuestFest
 * ============================================================================
 * Gestiona el Muro Social combinando tres estrategias complementarias:
 * 1. Carga inicial vía REST (`fetchInitialPosts`): Obtiene los primeros 15 posts.
 * 2. Paginación Infinita por Cursor (`loadMorePosts`): Solicita publicaciones
 *    más antiguas usando el ID del último post cargado (`cursor_id`).
 * 3. Actualizaciones en Vivo por Server-Sent Events (SSE): Escucha nuevos posts
 *    y respuestas en tiempo real, inyectándolos en el estado de React sin parpadeos.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import { formatSpanishDate } from '@/lib/formatters';
import { Post } from '@/types/feed';
import { User } from '@/context/AuthContext';

function formatExactTime(isoDate?: string | null) {
  if (!isoDate) return 'Ahora mismo';
  return formatSpanishDate(isoDate);
}

export function useFeedStream(user: User | null, groupId?: number | null) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carga inicial de publicaciones pertenecientes al grupo activo.
   * Guarda el ID del post más reciente en localStorage para el contador de no leídos.
   */
  const fetchInitialPosts = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const params: Record<string, string | number> = { limit: 15 };
      if (groupId) params.group_id = groupId;

      const response = await api.get('/api/feed/', { params });
      const rawPosts: Post[] = response.data;
      const mappedPosts: Post[] = rawPosts.map((p) => ({
        ...p,
        exactTime: formatExactTime(p.time_ago)
      }));
      setPosts(mappedPosts);
      if (rawPosts.length < 15) setHasMore(false);

      if (mappedPosts.length > 0 && typeof window !== 'undefined') {
        localStorage.setItem(`last_seen_post_id_${groupId || 'global'}`, mappedPosts[0].id.toString());
      }
    } catch (err: unknown) {
      console.error('Error al cargar el feed inicial:', err);
      setError('No se pudo conectar con el servidor para cargar las publicaciones.');
    }
  }, [user, groupId]);

  /**
   * Carga paginada por cursor hacia el pasado.
   * Evita duplicados filtrando con un Set de identificadores ya presentes en memoria.
   */
  const loadMorePosts = useCallback(async () => {
    if (isLoadingMore || !hasMore || posts.length === 0) return;
    const lastPostId = posts[posts.length - 1].id;

    try {
      setIsLoadingMore(true);
      const params: Record<string, string | number> = { limit: 15, cursor_id: lastPostId };
      if (groupId) params.group_id = groupId;

      const response = await api.get('/api/feed/', { params });
      const rawPosts: Post[] = response.data;
      if (rawPosts.length < 15) setHasMore(false);

      const mappedPosts: Post[] = rawPosts.map((p) => ({
        ...p,
        exactTime: formatExactTime(p.time_ago)
      }));

      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const filteredNew = mappedPosts.filter((p) => !existingIds.has(p.id));
        return [...prev, ...filteredNew];
      });
    } catch (err: unknown) {
      console.error('Error al cargar más publicaciones:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, posts, groupId]);

  /**
   * Smart Polling (Sondeo Inteligente) adaptado a entornos Serverless (Vercel):
   * En lugar de una conexión SSE persistente (que rompería por timeout en funciones serverless y
   * no compartiría memoria de eventos entre réplicas), consultamos periódicamente el endpoint
   * ultra ligero `GET /api/feed/latest-id`.
   * 
   * Estrategias de optimización de cuota (Vercel Hobby Tier - 100.000 peticiones/día):
   * 1. Page Visibility API: El sondeo se detiene inmediatamente si la pestaña no está visible (0 peticiones en segundo plano).
   * 2. Temporizador adaptativo de 15 segundos: Consumo controlado (~4 peticiones/minuto por usuario activo).
   * 3. Pausa por inactividad: Si no hay interacción (scroll, toque, movimiento) en 2 minutos, se detiene el sondeo.
   * 4. Revalidación al foco: Al regresar a la pestaña o ventana, se comprueba inmediatamente si hay publicaciones nuevas.
   */
  useEffect(() => {
    fetchInitialPosts();

    // Referencia para comparar si el último ID del servidor supera al post más reciente en memoria
    let isCancelled = false;
    let timerId: NodeJS.Timeout | null = null;
    let lastActivity = Date.now();
    const INACTIVITY_LIMIT_MS = 2 * 60 * 1000; // 2 minutos
    const POLLING_INTERVAL_MS = 15 * 1000; // 15 segundos

    // Actualizar marca de actividad del usuario
    const recordUserActivity = () => {
      lastActivity = Date.now();
    };

    const checkNewPosts = async () => {
      if (isCancelled || !user) return;

      // Si la pestaña está oculta en segundo plano, no realizamos petición
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      // Si el usuario lleva más de 2 minutos inactivo en pantalla, pausamos el sondeo
      if (Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
        return;
      }

      try {
        const params: Record<string, string | number> = {};
        if (groupId) params.group_id = groupId;

        const response = await api.get<number>('/api/feed/latest-id', { params });
        const serverLatestId = response.data;

        // Comprobamos contra el post más reciente actual
        setPosts((currentPosts) => {
          const clientLatestId = currentPosts.length > 0 ? currentPosts[0].id : 0;
          if (serverLatestId > clientLatestId) {
            // Se detectó contenido nuevo en el grupo; disparamos actualización de las publicaciones
            fetchInitialPosts();
          }
          return currentPosts;
        });
      } catch (err) {
        // En sondeos de fondo ignoramos fallos intermitentes de red para no alertar innecesariamente al usuario
        console.debug('Comprobación de novedades del feed en segundo plano:', err);
      }
    };

    // Iniciar el temporizador periódico
    timerId = setInterval(checkNewPosts, POLLING_INTERVAL_MS);

    // Escuchadores de eventos para optimización del ciclo de vida
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        recordUserActivity();
        checkNewPosts();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleVisibilityOrFocus);
      window.addEventListener('focus', handleVisibilityOrFocus);
      window.addEventListener('scroll', recordUserActivity, { passive: true });
      window.addEventListener('touchstart', recordUserActivity, { passive: true });
      window.addEventListener('mousemove', recordUserActivity, { passive: true });
      window.addEventListener('keydown', recordUserActivity, { passive: true });
    }

    return () => {
      isCancelled = true;
      if (timerId) clearInterval(timerId);
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        window.removeEventListener('focus', handleVisibilityOrFocus);
        window.removeEventListener('scroll', recordUserActivity);
        window.removeEventListener('touchstart', recordUserActivity);
        window.removeEventListener('mousemove', recordUserActivity);
        window.removeEventListener('keydown', recordUserActivity);
      }
    };
  }, [fetchInitialPosts, groupId, user]);

  return {
    posts,
    hasMore,
    isLoadingMore,
    error,
    fetchInitialPosts,
    loadMorePosts
  };
}
