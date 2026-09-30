'use client';

/**
 * ============================================================================
 * MODAL DE COLOCACIÓN DE APUESTAS / CUPÓN (PlaceBetModal)
 * ============================================================================
 * Permite seleccionar una opción del mercado, introducir la inversión en QC
 * y colocar el ticket de apuesta contra el balance del jugador.
 * ============================================================================
 */

import React, { useState } from 'react';
import { Dice5, X, CheckCircle } from 'lucide-react';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import { ApuestaResponse, BetOption } from '@/types';

export interface PlaceBetModalProps {
  bet: ApuestaResponse;
  selectedOptionId: string | null;
  setSelectedOptionId: (id: string) => void;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}

export default function PlaceBetModal({
  bet,
  selectedOptionId,
  setSelectedOptionId,
  onClose,
  onConfirm,
}: PlaceBetModalProps) {
  const [amount, setAmount] = useState<number | ''>('');

  return (
    <div className="animate-fadeIn fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="bg-dracula-base border-dracula-yellow/50 scale-in-center flex w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl">
        <div className="border-dracula-gray/20 bg-dracula-card/50 flex items-center justify-between border-b p-4">
          <h3 className="text-dracula-yellow flex items-center gap-2 text-base font-bold">
            <Dice5 size={18} /> Cupón de Apuesta
          </h3>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-red transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <p className="text-dracula-light text-sm leading-snug font-semibold">
            {bet.title}
          </p>
          <div className="flex flex-col gap-2">
            {bet.options?.map((betOption: BetOption) => (
              <button
                key={betOption.id}
                onClick={() => setSelectedOptionId(betOption.id)}
                className={`flex items-center justify-between rounded-lg border p-3 text-sm font-semibold transition-all ${
                  selectedOptionId === betOption.id
                    ? 'bg-dracula-yellow/10 border-dracula-yellow text-dracula-yellow'
                    : 'bg-dracula-card border-dracula-gray/10 text-dracula-light hover:border-dracula-gray/40'
                }`}
              >
                <span>{betOption.text}</span>
                <span className="font-mono text-xs opacity-80">
                  x{Number(betOption.multiplier).toFixed(2)}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-1 flex flex-col gap-1.5">
            <label
              htmlFor="bet-investment-amount"
              className="text-dracula-gray text-[10px] font-bold tracking-widest uppercase"
            >
              Inversión (Tokens)
            </label>
            <TokenAmountInput
              id="bet-investment-amount"
              name="betAmount"
              min={1}
              value={amount}
              onChange={setAmount}
              placeholder="Tokens a apostar..."
              icon="💰"
              className="bg-dracula-card text-dracula-yellow border-dracula-gray/20 focus:border-dracula-yellow w-full rounded-xl border py-3 pr-3 pl-9 text-sm font-bold focus:outline-none"
            />
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
            disabled={!selectedOptionId || !amount}
            onClick={() => onConfirm(Number(amount))}
            className={`flex flex-[2] items-center justify-center gap-1.5 rounded-xl py-3 text-xs font-bold transition-all ${
              selectedOptionId && amount
                ? 'bg-dracula-yellow text-dracula-base shadow hover:opacity-90'
                : 'bg-dracula-base text-dracula-gray border-dracula-gray/20 cursor-not-allowed border'
            }`}
          >
            <CheckCircle size={16} /> Confirmar Apuesta
          </button>
        </div>
      </div>
    </div>
  );
}
