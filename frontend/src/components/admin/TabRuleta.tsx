'use client';
import { useState } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';

export default function TabRuleta() {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [recompensa, setRecompensa] = useState(100);

  const handleAdd = async () => {
    if (!titulo || !descripcion) return toast.error('Rellena los campos');
    const toastId = toast.loading('Añadiendo misión...');
    try {
      await api.post('/api/admin/roulette', { titulo, descripcion, recompensa });
      toast.success('Añadida al bombo', { id: toastId });
      setTitulo(''); setDescripcion(''); setRecompensa(100);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Error al añadir', { id: toastId });
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 animate-fadeIn">
      <div className="bg-dracula-card rounded-2xl p-4 border border-dracula-gray/20">
        <h2 className="text-lg font-bold mb-4 text-[#ffb86c] flex items-center gap-2"><Plus size={20}/> Añadir al Bombo</h2>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título de la Misión" className="w-full bg-black/50 border border-dracula-gray/20 rounded-xl p-3 text-sm text-dracula-light focus:border-[#ffb86c] outline-none mb-3 transition-colors" />
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción..." className="w-full bg-black/50 border border-dracula-gray/20 rounded-xl p-3 text-sm text-dracula-light focus:border-[#ffb86c] outline-none h-20 mb-3 resize-none transition-colors" />
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-bold text-dracula-gray">Recompensa:</span>
          <input type="number" value={recompensa} onChange={e => setRecompensa(parseInt(e.target.value))} className="flex-1 bg-black/50 border border-dracula-gray/20 rounded-xl p-3 text-sm text-dracula-light outline-none focus:border-[#ffb86c]" />
        </div>
        <button onClick={handleAdd} className="w-full bg-[#ffb86c] hover:bg-[#ffb86c]/80 text-dracula-base p-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors">
          Añadir Misión
        </button>
      </div>

      <div className="bg-dracula-card rounded-2xl p-4 border border-dracula-gray/20 opacity-50">
        <h2 className="text-lg font-bold mb-2 text-dracula-gray flex items-center gap-2">Destinos de Hoy</h2>
        <p className="text-xs text-dracula-gray">Proximamente se conectará con el historial diario de tiradas.</p>
      </div>
    </div>
  );
}
