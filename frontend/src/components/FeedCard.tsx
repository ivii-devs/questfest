'use client';

/**
 * ============================================================================
 * COMPONENTE VISUAL DE TARJETA DEL FEED (FeedCard)
 * ============================================================================
 * Tarjeta pura para renderizar posts del muro social, apuestas, misiones y duelos.
 * Desacopla la lógica visual mediante funciones de configuración puras
 * y delega las respuestas en la capa de servicios o callbacks.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  MessageSquare,
  Dice5,
  Target,
  Swords,
  X,
  LucideIcon,
} from 'lucide-react';
import { replyToPost } from '@/services/feedService';
import { Post } from '@/types/feed';

export interface FeedCardProps {
  post: Post;
  onRefresh: () => void;
  onReply?: (postId: number, comment: string) => Promise<void>;
}

interface FeedVisualConfig {
  Icon: LucideIcon;
  tintColor: string;
  badgeColor: string;
}

/**
 * Función pura extraída fuera del renderizado para calcular la paleta
 * e icono semántico de la tarjeta según el tipo de publicación.
 */
export function getFeedVisualConfig(postType: string): FeedVisualConfig {
  switch (postType) {
    case 'bet':
      return {
        Icon: Dice5,
        tintColor: 'border-dracula-yellow/20 bg-dracula-yellow/5',
        badgeColor: 'bg-dracula-yellow text-dracula-base',
      };
    case 'mission':
      return {
        Icon: Target,
        tintColor: 'border-dracula-green/20 bg-dracula-green/5',
        badgeColor: 'bg-dracula-green text-dracula-base',
      };
    case 'duel':
      return {
        Icon: Swords,
        tintColor: 'border-dracula-red/20 bg-dracula-red/5',
        badgeColor: 'bg-dracula-red text-dracula-base',
      };
    default:
      return {
        Icon: MessageSquare,
        tintColor: 'border-dracula-purple/20 bg-dracula-purple/5',
        badgeColor: 'bg-dracula-purple text-dracula-base',
      };
  }
}

function FeedCardComponent({ post, onRefresh, onReply }: FeedCardProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [fullScreenMedia, setFullScreenMedia] = useState<string | null>(null);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setIsSubmittingReply(true);
    try {
      if (onReply) {
        await onReply(post.id, replyText.trim());
      } else {
        await replyToPost(post.id, replyText.trim(), null);
      }
      setReplyText('');
      setIsReplying(false);
      onRefresh();
    } catch (error) {
      console.error('Error enviando respuesta:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const { Icon, tintColor, badgeColor } = getFeedVisualConfig(post.type);

  const isVideo = (url?: string | null) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.endsWith('.mp4') ||
      lower.endsWith('.webm') ||
      lower.endsWith('.mov') ||
      lower.includes('/video/upload/')
    );
  };

  return (
    <article
      className={`bg-dracula-card flex flex-col gap-3 rounded-xl border p-4 transition-colors ${tintColor}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          {/* Avatar con Badge */}
          <div className="relative shrink-0">
            {post.author_avatar_url ? (
              <img
                src={post.author_avatar_url}
                alt={`Avatar de ${post.author}`}
                className="border-dracula-gray/30 h-10 w-10 rounded-full border object-cover"
                width={40}
                height={40}
              />
            ) : (
              <div className="bg-dracula-gray/20 text-dracula-light flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black">
                {post.author ? post.author.substring(0, 2).toUpperCase() : 'U'}
              </div>
            )}
            <div
              className={`absolute -right-1 -bottom-1 rounded-full p-1 ${badgeColor} border-dracula-card border-2`}
            >
              <Icon size={10} />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-dracula-light text-sm font-bold">
                {post.author}
              </span>
              {post.es_sistema && (
                <span className="bg-dracula-purple/20 text-dracula-purple rounded px-1.5 py-0.5 text-[10px] font-black uppercase">
                  Sistema
                </span>
              )}
            </div>
            <span className="text-dracula-gray text-xs">
              {post.exactTime || post.time_ago}
            </span>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <p className="text-dracula-light text-sm leading-relaxed whitespace-pre-line">
        {post.contenido}
      </p>

      {/* Media adjunta */}
      {post.media_url && (
        <div className="border-dracula-gray/20 relative mt-1 aspect-video overflow-hidden rounded-lg border bg-black/40">
          {isVideo(post.media_url) ? (
            <video
              src={post.media_url}
              controls
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={post.media_url}
              alt="Media de la publicación"
              className="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-95"
              onClick={() => setFullScreenMedia(post.media_url || null)}
            />
          )}
        </div>
      )}

      {/* Respuestas / Hilo */}
      {post.replies && post.replies.length > 0 && (
        <div className="border-dracula-purple/30 mt-2 flex flex-col gap-2 border-l-2 pl-4">
          {post.replies.map((reply) => (
            <div
              key={reply.id}
              className="text-dracula-light bg-dracula-base/40 border-dracula-gray/10 rounded-lg border p-2.5 text-xs"
            >
              <span className="text-dracula-purple mr-1.5 font-bold">
                @{reply.author}:
              </span>
              <span>{reply.contenido}</span>
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div className="border-dracula-gray/10 text-dracula-gray flex items-center gap-4 border-t pt-2 text-xs">
        <button
          onClick={() => setIsReplying(!isReplying)}
          className="hover:text-dracula-purple flex items-center gap-1.5 p-1 transition-colors"
          aria-label="Responder a la publicación"
        >
          <MessageSquare size={14} />
          <span>{post.replies?.length || 0} respuestas</span>
        </button>
      </div>

      {/* Formulario de respuesta */}
      {isReplying && (
        <div className="flex gap-2 pt-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Escribe una respuesta..."
            aria-label="Escribe tu respuesta"
            className="bg-dracula-base text-dracula-light border-dracula-purple/30 flex-1 rounded-lg border px-3 py-2 text-xs focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleReply()}
          />
          <button
            onClick={handleReply}
            disabled={!replyText.trim() || isSubmittingReply}
            aria-label="Enviar respuesta"
            className="bg-dracula-purple text-dracula-base rounded-lg px-3 py-2 text-xs font-bold hover:opacity-90 disabled:opacity-30"
          >
            Responder
          </button>
        </div>
      )}

      {/* Modal Pantalla Completa para Imagen */}
      {fullScreenMedia && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Imagen en pantalla completa"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFullScreenMedia(null)}
        >
          <button
            onClick={() => setFullScreenMedia(null)}
            aria-label="Cerrar modal de imagen"
            className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black"
          >
            <X size={24} />
          </button>
          <img
            src={fullScreenMedia}
            alt="Imagen ampliada"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </article>
  );
}

// Memoizar el componente comparando por ID y longitud de respuestas para evitar re-renders innecesarios
export const FeedCard = React.memo(
  FeedCardComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.post.id === nextProps.post.id &&
      prevProps.post.contenido === nextProps.post.contenido &&
      (prevProps.post.replies?.length || 0) ===
        (nextProps.post.replies?.length || 0)
    );
  }
);

export default FeedCard;
