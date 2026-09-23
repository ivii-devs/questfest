'use client';
import { useState, useRef } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { Megaphone, Upload, Send } from 'lucide-react';

export default function TabSistema() {
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
      const res = await api.post('/api/admin/upload-media', fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      setMediaUrl(res.data.url);
      toast.success('Archivo subido', { id: toastId });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Error al subir', { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleLanzar = async () => {
    if (!content.trim()) return toast.error('Escribe algo');
    const toastId = toast.loading('Lanzando anuncio...');
    try {
      await api.post('/api/admin/announcements', { contenido: content, media_url: mediaUrl || null });
      toast.success('Anuncio lanzado', { id: toastId });
      setContent('');
      setMediaUrl('');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Error al lanzar', { id: toastId });
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 animate-fadeIn">
      <div className="bg-dracula-card rounded-2xl p-4 border border-dracula-gray/20">
        <h2 className="text-lg font-bold mb-4 text-dracula-gray flex items-center gap-2"><Megaphone size={20}/> Lanzar Anuncio del Sistema</h2>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full bg-black/50 border border-dracula-gray/20 rounded-xl p-3 text-sm text-dracula-light focus:outline-none focus:border-dracula-gray transition-colors resize-none h-32 mb-4"
          placeholder="Mensaje del comunicado..."
        />
        
        {mediaUrl && (
          <div className="mb-4 relative rounded-xl overflow-hidden h-40 bg-black/50 border border-dracula-gray/20">
            <img src={mediaUrl} className="w-full h-full object-cover" alt="Media" />
            <button onClick={() => setMediaUrl('')} className="absolute top-2 right-2 bg-dracula-red text-white p-1 rounded-full text-xs font-bold w-6 h-6 flex items-center justify-center">X</button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input type="file" ref={fileRef} className="hidden" accept="image/*,video/*" onChange={handleUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex-1 bg-dracula-gray/20 hover:bg-dracula-gray/30 text-dracula-light p-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors">
            <Upload size={18} /> {uploading ? 'Subiendo...' : 'Adjuntar Media'}
          </button>
          <button onClick={handleLanzar} className="flex-1 bg-dracula-gray hover:bg-dracula-light text-dracula-base p-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors">
            <Send size={18} /> Lanzar
          </button>
        </div>
      </div>
    </div>
  );
}
