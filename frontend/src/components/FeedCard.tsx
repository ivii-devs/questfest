'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Dice5,
  Target,
  Swords,
  X
} from 'lucide-react';
import api from '@/lib/axios';
import { FeedCardProps } from '@/types/feed';

function FeedCardComponent({ post, onRefresh }: FeedCardProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [fullScreenMedia, setFullScreenMedia] = useState<string | null>(null);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setIsSubmittingReply(true);
    try {
      await api.post(`/api/feed/${post.id}/reply`, { content: replyText.trim(), media_url: null });
      setReplyText('');
      setIsReplying(false);
      onRefresh();
    } catch (error) {
      console.error('Error enviando respuesta:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  let Icon = MessageSquare;
  let tintColor = 'border-dracula-purple/20 bg-dracula-purple/5';
  let badgeColor = 'bg-dracula-purple text-dracula-base';

  if (post.type === 'bet') {
    Icon = Dice5;
    tintColor = 'border-dracula-yellow/20 bg-dracula-yellow/5';
    badgeColor = 'bg-dracula-yellow text-dracula-base';
  }
  if (post.type === 'mission') {
    Icon = Target;
    tintColor = 'border-dracula-green/20 bg-dracula-green/5';
    badgeColor = 'bg-dracula-green text-dracula-base';
  }
  if (post.type === 'duel') {
    Icon = Swords;
    tintColor = 'border-dracula-red/20 bg-dracula-red/5';
    badgeColor = 'bg-dracula-red text-dracula-base';
  }

  const isVideo = (url?: string | null) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.includes('/video/upload/');
  };

  return (
    <article
      className={`p-4 rounded-xl border flex flex-col gap-3 transition-colors bg-dracula-card ${tintColor}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          {/* Avatar con Badge */}
          <div className="relative shrink-0">
            {post.author_avatar_url ? (
              <img
                src={post.author_avatar_url}
                alt={`Avatar de ${post.author}`}
                className="w-10 h-10 rounded-full object-cover border border-dracula-gray/30"
                width={40}
                height={40}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-dracula-gray/20 flex items-center justify-center font-black text-dracula-light shrink-0">
                {post.author ? post.author.substring(0, 2).toUpperCase() : 'U'}
              </div>
            )}
            <div className={`absolute -bottom-1 -right-1 p-1 rounded-full ${badgeColor} border-2 border-dracula-card`}>
              <Icon size={10} />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-dracula-light">{post.author}</span>
              {post.es_sistema && (
                <span className="text-[10px] bg-dracula-purple/20 text-dracula-purple px-1.5 py-0.5 rounded font-black uppercase">
                  Sistema
                </span>
              )}
            </div>
            <span className="text-xs text-dracula-gray">{post.exactTime || post.time_ago}</span>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <p className="text-sm text-dracula-light whitespace-pre-line leading-relaxed">{post.contenido}</p>

      {/* Media adjunta */}
      {post.media_url && (
        <div className="mt-1 rounded-lg overflow-hidden border border-dracula-gray/20 bg-black/40 aspect-video relative">
          {isVideo(post.media_url) ? (
            <video src={post.media_url} controls className="w-full h-full object-cover" />
          ) : (
            <img
              src={post.media_url}
              alt="Media de la publicación"
              className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
              onClick={() => setFullScreenMedia(post.media_url || null)}
            />
          )}
        </div>
      )}

      {/* Respuestas / Hilo */}
      {post.replies && post.replies.length > 0 && (
        <div className="mt-2 pl-4 border-l-2 border-dracula-purple/30 flex flex-col gap-2">
          {post.replies.map((reply) => (
            <div key={reply.id} className="text-xs text-dracula-light bg-dracula-base/40 p-2.5 rounded-lg border border-dracula-gray/10">
              <span className="font-bold text-dracula-purple mr-1.5">@{reply.author}:</span>
              <span>{reply.contenido}</span>
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-4 pt-2 border-t border-dracula-gray/10 text-dracula-gray text-xs">
        <button
          onClick={() => setIsReplying(!isReplying)}
          className="flex items-center gap-1.5 hover:text-dracula-purple transition-colors p-1"
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
            placeholder="Escribe tu respuesta..."
            aria-label="Escribe tu respuesta"
            className="flex-1 bg-dracula-base text-xs text-dracula-light px-3 py-2 rounded-lg border border-dracula-purple/30 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleReply()}
          />
          <button
            onClick={handleReply}
            disabled={!replyText.trim() || isSubmittingReply}
            aria-label="Enviar respuesta"
            className="bg-dracula-purple text-dracula-base px-3 py-2 rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-30"
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
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullScreenMedia(null)}
        >
          <button
            onClick={() => setFullScreenMedia(null)}
            aria-label="Cerrar modal de imagen"
            className="absolute top-4 right-4 text-white p-2 rounded-full bg-black/50 hover:bg-black"
          >
            <X size={24} />
          </button>
          <img src={fullScreenMedia} alt="Imagen ampliada" className="max-w-full max-h-full rounded-lg object-contain" />
        </div>
      )}
    </article>
  );
}

// Memoizar el componente comparando por ID y longitud de respuestas para evitar re-renders innecesarios
export const FeedCard = React.memo(FeedCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.contenido === nextProps.post.contenido &&
    (prevProps.post.replies?.length || 0) === (nextProps.post.replies?.length || 0)
  );
});

export default FeedCard;
