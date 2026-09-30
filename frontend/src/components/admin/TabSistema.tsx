'use client';
import { useState, useRef } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';
import { Megaphone, Upload, Send } from 'lucide-react';
import { useGroup } from '@/context/GroupContext';

export default function TabSistema() {
  const { activeGroup } = useGroup();
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const toastId = toast.loading('Subiendo archivo...');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/api/admin/upload-media', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMediaUrl(res.data.url);
      toast.success('Archivo subido', { id: toastId });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error al subir'), { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleLanzar = async () => {
    if (!content.trim()) return toast.error('Escribe algo');
    const toastId = toast.loading('Lanzando anuncio...');
    try {
      await api.post('/api/admin/announcements', {
        contenido: content,
        media_url: mediaUrl || null,
        group_id: activeGroup?.id,
      });
      toast.success('Anuncio lanzado', { id: toastId });
      setContent('');
      setMediaUrl('');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error al lanzar'), {
        id: toastId,
      });
    }
  };

  return (
    <div className="animate-fadeIn flex flex-col gap-6 p-4">
      <div className="bg-dracula-card border-dracula-gray/20 rounded-2xl border p-4">
        <h2 className="text-dracula-gray mb-4 flex items-center gap-2 text-lg font-bold">
          <Megaphone size={20} /> Lanzar Anuncio del Sistema
        </h2>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="border-dracula-gray/20 text-dracula-light focus:border-dracula-gray mb-4 h-32 w-full resize-none rounded-xl border bg-black/50 p-3 text-sm transition-colors focus:outline-none"
          placeholder="Mensaje del comunicado..."
        />

        {mediaUrl && (
          <div className="border-dracula-gray/20 relative mb-4 h-40 overflow-hidden rounded-xl border bg-black/50">
            <img
              src={mediaUrl}
              className="h-full w-full object-cover"
              alt="Media"
            />
            <button
              onClick={() => setMediaUrl('')}
              className="bg-dracula-red absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full p-1 text-xs font-bold text-white"
            >
              X
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileRef}
            className="hidden"
            accept="image/*,video/*"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-dracula-gray/20 hover:bg-dracula-gray/30 text-dracula-light flex flex-1 items-center justify-center gap-2 rounded-xl p-3 font-bold transition-colors"
          >
            <Upload size={18} /> {uploading ? 'Subiendo...' : 'Adjuntar Media'}
          </button>
          <button
            onClick={handleLanzar}
            className="bg-dracula-gray hover:bg-dracula-light text-dracula-base flex flex-1 items-center justify-center gap-2 rounded-xl p-3 font-bold transition-colors"
          >
            <Send size={18} /> Lanzar
          </button>
        </div>
      </div>
    </div>
  );
}
