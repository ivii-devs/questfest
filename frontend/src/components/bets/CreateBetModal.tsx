'use client';

/**
 * ============================================================================
 * MODAL DE SUGERENCIA / CREACIÓN DE APUESTAS (CreateBetModal)
 * ============================================================================
 * Permite a los jugadores proponer una nueva apuesta comunitaria
 * con validación estricta de título (>= 5 letras) y cuotas (> 1.00).
 * ============================================================================
 */

import React, { useState } from 'react';
import { MessageSquare, X, AlertCircle, Plus, Trash } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGroup } from '@/context/GroupContext';
import { createBet } from '@/services/betsService';

export interface CreateBetModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  groupId?: number;
}

export default function CreateBetModal({
  onClose,
  onSuccess,
  groupId,
}: CreateBetModalProps) {
  const { activeGroup } = useGroup();
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState([
    { text: '', multiplier: '' },
    { text: '', multiplier: '' },
  ]);

  const handleSuggest = async () => {
    if (!title || options.some((o) => !o.text || !o.multiplier)) {
      toast.error('Rellena todos los campos');
      return;
    }

    if (title.length < 5) {
      toast.error('El título debe tener al menos 5 letras');
      return;
    }

    if (options.some((o) => Number(o.multiplier) <= 1.0)) {
      toast.error('Las cuotas deben ser mayores a 1.0');
      return;
    }

    const formattedOptions = options.map((o) => ({
      text: o.text,
      multiplier: Number(o.multiplier),
    }));

    const effectiveGroupId = groupId ?? activeGroup?.id;

    const promise = createBet({
      title,
      options: formattedOptions,
      group_id: effectiveGroupId || undefined,
    });

    toast.promise(promise, {
      loading: 'Enviando sugerencia...',
      success: 'Sugerencia enviada correctamente',
      error: 'Error al enviar la sugerencia',
    });

    try {
      await promise;
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const updateOption = (
    index: number,
    field: 'text' | 'multiplier',
    value: string
  ) => {
    const newOptions = [...options];
    newOptions[index][field] = value;
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) {
      toast.error('Debe haber al menos 2 opciones');
      return;
    }
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, { text: '', multiplier: '' }]);
  };

  return (
    <div className="animate-fadeIn fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="bg-dracula-base scale-in-center flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#ffb86c]/50 shadow-2xl">
        <div className="border-dracula-gray/20 bg-dracula-card/50 sticky top-0 z-10 flex items-center justify-between border-b p-4">
          <h3 className="flex items-center gap-2 text-base font-bold text-[#ffb86c]">
            <MessageSquare size={18} /> Sugerir al Grupo
          </h3>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-red transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <div className="flex items-start gap-2 rounded-lg border border-[#ffb86c]/20 bg-[#ffb86c]/10 p-3 text-xs leading-normal font-semibold text-[#ffb86c]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>
              Las apuestas sugeridas pasarán por una fase de votación. Si a la
              gente le gusta, el Admin la aprobará.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="create-bet-title"
              className="text-dracula-gray text-[10px] font-bold tracking-widest uppercase"
            >
              Pregunta de la apuesta *
            </label>
            <input
              id="create-bet-title"
              name="betTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-dracula-card text-dracula-light border-dracula-gray/20 w-full rounded-xl border p-3 text-sm focus:border-[#ffb86c] focus:outline-none"
              placeholder="Pregunta de la apuesta..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-dracula-gray text-[10px] font-bold tracking-widest uppercase">
              Opciones sugeridas (y cuotas)
            </label>

            {options.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  id={`bet-option-${index}`}
                  name={`betOption_${index}`}
                  aria-label={`Texto de la opción ${index + 1}`}
                  type="text"
                  value={opt.text}
                  onChange={(e) => updateOption(index, 'text', e.target.value)}
                  placeholder={`Opción ${index + 1}`}
                  className="bg-dracula-card text-dracula-light border-dracula-gray/20 flex-[3] rounded-xl border p-3 text-sm focus:border-[#ffb86c] focus:outline-none"
                />
                <div className="relative flex-[1.5]">
                  <span className="text-dracula-gray absolute top-1/2 left-3 -translate-y-1/2 text-[10px] font-bold">
                    x
                  </span>
                  <input
                    id={`bet-multiplier-${index}`}
                    name={`betMultiplier_${index}`}
                    aria-label={`Multiplicador de la opción ${index + 1}`}
                    type="number"
                    step="0.01"
                    value={opt.multiplier}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      updateOption(index, 'multiplier', e.target.value)
                    }
                    className="bg-dracula-card text-dracula-cyan border-dracula-gray/20 w-full rounded-xl border py-3 pr-3 pl-7 font-mono text-sm font-bold focus:border-[#ffb86c] focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => removeOption(index)}
                  className="text-dracula-red hover:bg-dracula-red/10 border-dracula-red/20 flex items-center justify-center rounded-xl border p-3 transition-colors"
                >
                  <Trash size={16} />
                </button>
              </div>
            ))}

            <button
              onClick={addOption}
              className="mt-2 flex w-max items-center gap-1 text-left text-xs font-bold text-[#ffb86c] hover:opacity-80"
            >
              <Plus size={14} /> Añadir otra opción
            </button>
          </div>
        </div>

        <div className="border-dracula-gray/20 bg-dracula-card/20 flex gap-3 border-t p-4">
          <button
            onClick={onClose}
            className="text-dracula-light bg-dracula-card hover:bg-dracula-gray/30 flex-1 rounded-xl py-3 text-xs font-bold"
          >
            Cancelar
          </button>
          <button
            onClick={handleSuggest}
            className="text-dracula-base flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-[#ffb86c] py-3 text-xs font-bold transition-all hover:opacity-90"
          >
            Enviar Sugerencia
          </button>
        </div>
      </div>
    </div>
  );
}
