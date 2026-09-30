'use client';

/**
 * ============================================================================
 * FORMULARIO DE CREACIÓN DE PUBLICACIONES (CreatePostForm)
 * ============================================================================
 * Permite a los jugadores redactar cotilleos y adjuntar imágenes o vídeos.
 * Utiliza la capa de servicios para la subida asíncrona de archivos multimedia.
 * ============================================================================
 */

import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Video, Send, X } from 'lucide-react';
import { createPost, uploadMedia } from '@/services/feedService';
import { Usuario } from '@/types';

export interface CreatePostFormProps {
  user: Usuario | null;
  onPostCreated: () => void;
  groupId?: number | null;
}

export default function CreatePostForm({
  user,
  onPostCreated,
  groupId,
}: CreatePostFormProps) {
  const [newPostText, setNewPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreatePost = async () => {
    if (!newPostText.trim() && !selectedImage) return;

    try {
      setIsUploading(true);
      let mediaUrl: string | null = null;

      if (selectedImage) {
        mediaUrl = await uploadMedia(selectedImage);
      }

      await createPost({
        content: newPostText.trim(),
        tipo: 'social',
        media_url: mediaUrl,
        group_id: groupId || undefined,
      });

      setNewPostText('');
      removeImage();
      onPostCreated();
    } catch (error) {
      console.error('Error al crear publicación:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="bg-dracula-card border-dracula-purple/20 flex flex-col gap-3 rounded-xl border p-4 shadow-lg">
      <div className="flex gap-3">
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={`Avatar de ${user.username || 'usuario'}`}
            className="border-dracula-purple/30 h-10 w-10 shrink-0 rounded-full border object-cover"
            width={40}
            height={40}
          />
        ) : (
          <div className="bg-dracula-purple text-dracula-base flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black">
            {user?.username ? user.username.substring(0, 2).toUpperCase() : 'U'}
          </div>
        )}
        <div className="flex w-full flex-col">
          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="Escribe una publicación..."
            aria-label="Contenido de la publicación"
            className="text-dracula-light placeholder-dracula-gray/50 h-14 w-full resize-none bg-transparent pt-2 text-sm focus:outline-none"
            maxLength={280}
          />

          {imagePreview && (
            <div className="group border-dracula-gray/20 relative mt-2 mb-2 aspect-video max-h-48 self-start overflow-hidden rounded-lg border">
              {selectedImage?.type.startsWith('video/') ? (
                <video
                  src={imagePreview}
                  controls
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={imagePreview}
                  alt="Vista previa del medio adjunto"
                  className="h-full w-full object-cover"
                />
              )}
              <button
                onClick={removeImage}
                aria-label="Quitar archivo adjunto"
                className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="border-dracula-gray/10 flex items-center justify-between border-t pt-3">
        <div className="text-dracula-gray flex gap-3">
          <input
            type="file"
            accept="image/*,video/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
            aria-label="Seleccionar archivo multimedia"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="hover:text-dracula-purple p-1 transition-colors"
            title="Adjuntar foto"
            aria-label="Adjuntar foto"
          >
            <ImageIcon size={18} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="hover:text-dracula-purple p-1 transition-colors"
            title="Adjuntar vídeo"
            aria-label="Adjuntar vídeo"
          >
            <Video size={18} />
          </button>
        </div>
        <button
          onClick={handleCreatePost}
          disabled={(!newPostText.trim() && !selectedImage) || isUploading}
          aria-label="Enviar publicación"
          className="bg-dracula-purple text-dracula-base flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Send size={12} /> {isUploading ? 'Subiendo...' : 'Publicar'}
        </button>
      </div>
    </section>
  );
}
