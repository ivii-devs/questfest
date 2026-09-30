/**
 * ============================================================================
 * SERVICIO DEL MURO SOCIAL Y COTILLEOS (feedService)
 * ============================================================================
 * Encapsula la obtención de publicaciones, respuestas a hilos,
 * subida de archivos multimedia y polling de novedades.
 * ============================================================================
 */

import api from '@/lib/axios';
import {
  FeedPostResponse,
  FeedReplyResponse,
  CreatePostPayload,
} from '@/types';

/**
 * Obtiene las publicaciones del muro social ordenadas cronológicamente con soporte de cursor.
 */
export async function fetchFeedPosts(
  groupId?: number,
  cursorId?: number,
  limit: number = 15
): Promise<FeedPostResponse[]> {
  const response = await api.get<FeedPostResponse[]>('/api/feed/', {
    params: {
      limit,
      ...(groupId ? { group_id: groupId } : {}),
      ...(cursorId ? { cursor_id: cursorId } : {}),
    },
  });
  return response.data;
}

/**
 * Publica un nuevo mensaje en el feed social del grupo activo.
 */
export async function createPost(
  payload: CreatePostPayload
): Promise<{ message: string; post_id: number }> {
  const response = await api.post<{ message: string; post_id: number }>(
    '/api/feed/',
    payload
  );
  return response.data;
}

/**
 * Publica una respuesta en un hilo de conversación de un post existente.
 */
export async function replyToPost(
  postId: number,
  content: string,
  mediaUrl?: string | null
): Promise<FeedReplyResponse> {
  const response = await api.post<{ message: string; reply_id: number }>(
    `/api/feed/${postId}/reply`,
    {
      content,
      media_url: mediaUrl || null,
    }
  );
  return {
    id: response.data.reply_id,
    author: '',
    contenido: content,
    media_url: mediaUrl || null,
  };
}

/**
 * Consulta el ID de la publicación más reciente para verificar novedades de forma ligera.
 */
export async function checkLatestPostId(groupId?: number): Promise<number> {
  const posts = await fetchFeedPosts(groupId, undefined, 1);
  return posts.length > 0 ? posts[0].id : 0;
}

/**
 * Sube un archivo de imagen o vídeo al servidor para su almacenamiento en Cloudinary.
 */
export async function uploadMedia(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<{ secure_url: string }>(
    '/api/upload/image',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return response.data.secure_url;
}
