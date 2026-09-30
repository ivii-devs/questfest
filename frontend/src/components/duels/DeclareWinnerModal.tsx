'use client';

/**
 * ============================================================================
 * MODAL DE REPORTE DE RESULTADO DE DUELO (DeclareWinnerModal)
 * ============================================================================
 * Permite a los contendientes declarar al ganador de un duelo 1v1.
 * Transfiere el estado a validación por el Tribunal Administrativo de QuestFest.
 * ============================================================================
 */

import React from 'react';
import { Scale, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { declareWinner } from '@/services/duelsService';
import { DueloModel } from '@/types';

export interface DeclareWinnerModalProps {
  duel: DueloModel;
  currentUser: string;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export default function DeclareWinnerModal({
  duel,
  currentUser,
  onClose,
  onSuccess,
}: DeclareWinnerModalProps) {
  const isChallenger = duel.challenger === currentUser;
  const opponent = isChallenger ? duel.challenged : duel.challenger;

  const handleResolve = async (
    resolution: 'challenger' | 'challenged' | 'draw'
  ) => {
    try {
      await declareWinner(duel.id, resolution);
      toast.success('Resultado enviado al Tribunal');
      await onSuccess();
      onClose();
    } catch {
      toast.error('Error al enviar el resultado');
    }
  };

  return (
    <div className="animate-fadeIn fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-dracula-base border-dracula-purple scale-in-center flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border-2 text-center shadow-2xl">
        <div className="bg-dracula-purple/20 border-dracula-purple/30 relative flex flex-col items-center justify-center border-b py-6">
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-red btn-press absolute top-3 right-3 transition-colors"
          >
            <X size={20} />
          </button>
          <div className="bg-dracula-purple text-dracula-base mb-2 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_0_20px_rgba(189,147,249,0.5)]">
            <Scale size={28} />
          </div>
          <h2 className="text-dracula-light text-lg font-black tracking-widest uppercase">
            Informar al Tribunal
          </h2>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <p className="text-dracula-gray text-sm font-medium">
            ¿Quién ha ganado{' '}
            <span className="text-dracula-light font-bold">
              &ldquo;{duel.game}&rdquo;
            </span>
            ? <br />
            <br />
            Al reportarlo, el duelo quedará congelado hasta que el Administrador
            confirme la victoria y mueva los{' '}
            <span className="text-dracula-yellow font-bold">
              💰 {duel.wager} tokens
            </span>
            .
          </p>

          <div className="mt-2 flex flex-col gap-3">
            <button
              onClick={() =>
                handleResolve(isChallenger ? 'challenger' : 'challenged')
              }
              className="border-dracula-green bg-dracula-green/10 text-dracula-green hover:bg-dracula-green/20 btn-press flex w-full items-center justify-center gap-2 rounded-xl border py-4 font-black tracking-wider uppercase transition-colors"
            >
              <Check size={18} /> He ganado YO
            </button>
            <button
              onClick={() =>
                handleResolve(isChallenger ? 'challenged' : 'challenger')
              }
              className="border-dracula-gray/20 bg-dracula-card text-dracula-light hover:bg-dracula-gray/30 btn-press flex w-full items-center justify-center gap-2 rounded-xl border py-4 font-black tracking-wider uppercase transition-colors"
            >
              Ha ganado {opponent}
            </button>
            <button
              onClick={() => handleResolve('draw')}
              className="text-dracula-gray hover:text-dracula-light decoration-dracula-gray/30 btn-press mt-1 w-full rounded-lg py-2 text-xs font-semibold underline"
            >
              Ha sido un empate / Se canceló
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
