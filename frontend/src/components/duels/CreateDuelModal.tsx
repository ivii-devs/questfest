'use client';

/**
 * ============================================================================
 * MODAL DE CREACIÓN DE DUELO 1V1 (CreateDuelModal)
 * ============================================================================
 * Permite seleccionar un adversario de la comunidad, definir la disciplina
 * o juego y apostar una suma de QuestCoins bloqueada en garantía.
 * ============================================================================
 */

import React, { useState } from 'react';
import { Swords, User, X } from 'lucide-react';
import toast from 'react-hot-toast';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import { createDuel } from '@/services/duelsService';

export interface CreateDuelModalProps {
  users: string[];
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  groupId?: number | null;
}

export default function CreateDuelModal({
  users,
  onClose,
  onSuccess,
  groupId,
}: CreateDuelModalProps) {
  const [challenged, setChallenged] = useState('');
  const [game, setGame] = useState('');
  const [wager, setWager] = useState<number | ''>('');

  const handleSubmit = async () => {
    if (!challenged || !game || wager === '' || wager <= 0) {
      toast.error('Rellena todos los campos correctamente');
      return;
    }
    try {
      await createDuel({
        challenged_username: challenged,
        game: game.trim(),
        wager: Number(wager),
        group_id: groupId || undefined,
      });
      toast.success('Reto lanzado con éxito');
      await onSuccess();
      onClose();
    } catch {
      toast.error('Error al lanzar el reto');
    }
  };

  return (
    <div className="animate-fadeIn fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-dracula-base border-dracula-red scale-in-center flex w-full max-w-md flex-col overflow-hidden rounded-2xl border-2 shadow-2xl">
        <div className="border-dracula-gray/20 bg-dracula-card/50 flex items-center justify-between border-b p-4">
          <h3 className="text-dracula-red flex items-center gap-2 text-sm font-bold tracking-wider uppercase">
            <Swords size={18} /> Lanzar un Reto
          </h3>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-red btn-press transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-dracula-gray flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase">
              <User size={12} /> ¿A quién retas?
            </label>
            <select
              className="bg-dracula-card text-dracula-light border-dracula-gray/20 focus:border-dracula-red w-full cursor-pointer rounded-xl border p-3 text-base focus:outline-none"
              value={challenged}
              onChange={(e) => setChallenged(e.target.value)}
            >
              <option value="" disabled>
                Selecciona a tu contrincante...
              </option>
              {users.map((friend: string) => (
                <option key={friend} value={friend}>
                  {friend}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="duel-game-name"
              className="text-dracula-gray text-[10px] font-bold tracking-widest uppercase"
            >
              ¿A qué jugáis?
            </label>
            <input
              id="duel-game-name"
              name="duelGame"
              type="text"
              className="bg-dracula-card text-dracula-light border-dracula-gray/20 focus:border-dracula-red w-full rounded-xl border p-3 text-base focus:outline-none"
              placeholder="Juego o disciplina del duelo"
              value={game}
              onChange={(e) => setGame(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="duel-wager-amount"
              className="text-dracula-gray text-[10px] font-bold tracking-widest uppercase"
            >
              Tokens en juego
            </label>
            <TokenAmountInput
              id="duel-wager-amount"
              name="duelWager"
              min={1}
              value={wager}
              onChange={setWager}
              placeholder="100"
              icon="💰"
              className="bg-dracula-card text-dracula-red border-dracula-gray/20 focus:border-dracula-red w-full rounded-xl border py-3 pr-3 pl-9 text-base font-bold focus:outline-none"
            />
          </div>
        </div>

        <div className="border-dracula-gray/20 bg-dracula-card/20 flex gap-3 border-t p-4">
          <button
            onClick={onClose}
            className="text-dracula-light bg-dracula-card hover:bg-dracula-gray/30 btn-press flex-1 rounded-xl py-3 text-xs font-bold"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="text-dracula-base bg-dracula-red btn-press flex flex-[2] items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold hover:opacity-90"
          >
            <Swords size={16} /> Confirmar Reto
          </button>
        </div>
      </div>
    </div>
  );
}
