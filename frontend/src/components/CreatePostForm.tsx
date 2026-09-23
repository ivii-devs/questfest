'use client';

import { useState, useRef } from 'react';
import { Image as ImageIcon, Video, Send, X } from 'lucide-react';
import api from '@/lib/axios';

interface CreatePostFormProps {
  user: any;
  onPostCreated: () => void;
  groupId?: number | null;
}

export default function CreatePostForm({ user, onPostCreated, groupId }: CreatePostFormProps) {
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
      let media_url = null;

      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);

        const uploadRes = await api.post('/api/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        media_url = uploadRes.data.secure_url;
      }

      await api.post('/api/feed/', {
        content: newPostText.trim(),
        tipo: 'social',
        media_url,
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
    <section className="bg-dracula-card p-4 rounded-xl border border-dracula-purple/20 flex flex-col gap-3 shadow-lg">
      <div className="flex gap-3">
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={`Avatar de ${user.username || 'usuario'}`}
            className="w-10 h-10 rounded-full object-cover shrink-0 border border-dracula-purple/30"
            width={40}
            height={40}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-dracula-purple flex items-center justify-center font-black text-dracula-base shrink-0">
            {user?.username ? user.username.substring(0, 2).toUpperCase() : 'U'}
          </div>
        )}
        <div className="flex flex-col w-full">
          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="Escribe una publicación..."
            aria-label="Contenido de la publicación"
            className="w-full bg-transparent text-sm text-dracula-light focus:outline-none resize-none pt-2 h-14 placeholder-dracula-gray/50"
            maxLength={280}
          />

          {imagePreview && (
            <div className="relative mt-2 mb-2 self-start group aspect-video max-h-48 overflow-hidden rounded-lg border border-dracula-gray/20">
              {selectedImage?.type.startsWith('video/') ? (
                <video src={imagePreview} controls className="w-full h-full object-cover" />
              ) : (
                <img src={imagePreview} alt="Vista previa del medio adjunto" className="w-full h-full object-cover" />
              )}
              <button
                onClick={removeImage}
                aria-label="Quitar archivo adjunto"
                className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center border-t border-dracula-gray/10 pt-3">
        <div className="flex gap-3 text-dracula-gray">
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
            className="hover:text-dracula-purple transition-colors p-1"
            title="Adjuntar foto"
            aria-label="Adjuntar foto"
          >
            <ImageIcon size={18} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="hover:text-dracula-purple transition-colors p-1"
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
          className="bg-dracula-purple text-dracula-base px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send size={12} /> {isUploading ? 'Subiendo...' : 'Publicar'}
        </button>
      </div>
    </section>
  );
}
