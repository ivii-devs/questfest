'use client';
import { useState } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';
import { Plus } from 'lucide-react';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import { useGroup } from '@/context/GroupContext';

export default function TabRuleta() {
  const { activeGroup } = useGroup();
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [recompensa, setRecompensa] = useState<number | ''>(100);

  const handleAdd = async () => {
    if (!titulo || !descripcion) return toast.error('Rellena los campos');
    const toastId = toast.loading('Añadiendo misión...');
    try {
      await api.post('/api/admin/roulette', {
        titulo,
        descripcion,
        recompensa: recompensa === '' ? 100 : Number(recompensa),
        group_id: activeGroup?.id,
      });
      toast.success('Añadida al bombo', { id: toastId });
      setTitulo('');
      setDescripcion('');
      setRecompensa(100);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error al añadir'), {
        id: toastId,
      });
    }
  };

  return (
    <div className="animate-fadeIn flex flex-col gap-6 p-4">
      <div className="bg-dracula-card border-dracula-gray/20 rounded-2xl border p-4">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#ffb86c]">
          <Plus size={20} /> Añadir al Bombo
        </h2>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título de la misión"
          className="border-dracula-gray/20 text-dracula-light mb-3 w-full rounded-xl border bg-black/50 p-3 text-sm transition-colors outline-none focus:border-[#ffb86c]"
        />
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción de la misión..."
          className="border-dracula-gray/20 text-dracula-light mb-3 h-20 w-full resize-none rounded-xl border bg-black/50 p-3 text-sm transition-colors outline-none focus:border-[#ffb86c]"
        />
        <div className="mb-4 flex items-center gap-3">
          <span className="text-dracula-gray text-sm font-bold">
            Recompensa:
          </span>
          <TokenAmountInput
            min={1}
            value={recompensa}
            onChange={setRecompensa}
            placeholder="100"
            className="border-dracula-gray/20 text-dracula-light w-full rounded-xl border bg-black/50 py-2.5 pr-3 pl-10 text-sm outline-none focus:border-[#ffb86c]"
          />
        </div>
        <button
          onClick={handleAdd}
          className="text-dracula-base flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffb86c] p-3 font-bold transition-colors hover:bg-[#ffb86c]/80"
        >
          Añadir Misión
        </button>
      </div>

      <div className="bg-dracula-card border-dracula-gray/20 rounded-2xl border p-4 opacity-50">
        <h2 className="text-dracula-gray mb-2 flex items-center gap-2 text-lg font-bold">
          Destinos de Hoy
        </h2>
        <p className="text-dracula-gray text-xs">
          Próximamente se mostrará aquí el registro de tiradas de la jornada.
        </p>
      </div>
    </div>
  );
}
