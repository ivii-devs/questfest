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
   * Suscripción en tiempo real a Server-Sent Events (SSE) filtrados por grupo.
   * Abre un canal `EventSource` nativo que escucha:
   * - 'new_post': Inserta el post en la cabecera de la lista si no existe ya.
   * - 'new_reply': Localiza el post padre (`parent_id`) e inserta la respuesta en su array anidado.
   * 
   * Limpieza de recursos:
   * Cuando el componente se desmonta o cambia el `groupId`, se cierra inmediatamente
   * el socket `eventSource.close()` para no dejar conexiones huérfanas en el servidor.
   */
  useEffect(() => {
    fetchInitialPosts();

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const streamUrl = groupId 
      ? `${API_BASE}/api/feed/stream?group_id=${groupId}`
      : `${API_BASE}/api/feed/stream`;

    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_post') {
          const newPost: Post = {
            ...data.payload,
            exactTime: formatExactTime(data.payload.time_ago)
          };
          setPosts((prev) => {
            if (prev.some((p) => p.id === newPost.id)) return prev;
            return [newPost, ...prev];
          });
        } else if (data.type === 'new_reply') {
          const { parent_id, reply } = data.payload;
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === parent_id) {
                const existingReplyIds = new Set((p.replies || []).map((r) => r.id));
                if (existingReplyIds.has(reply.id)) return p;
                return {
                  ...p,
                  replies: [...(p.replies || []), reply]
                };
              }
              return p;
            })
          );
        }
      } catch {
        // Ignoramos silenciosamente pings o mensajes no serializables en JSON del flujo SSE
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [fetchInitialPosts, groupId]);

  return {
    posts,
    hasMore,
    isLoadingMore,
    error,
    fetchInitialPosts,
    loadMorePosts
  };
}
