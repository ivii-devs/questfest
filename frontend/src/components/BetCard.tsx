'use client';

/**
 * ============================================================================
 * COMPONENTE VISUAL DE TARJETA DE APUESTA (BetCard)
 * ============================================================================
 * Representa visualmente una apuesta en cualquiera de sus tres estados:
 * propuesta (en votación), abierta (mercado activo) y cerrada (resuelta).
 * ============================================================================
 */

import React from 'react';
import { CheckCircle, User, ThumbsUp, ThumbsDown, Dice5 } from 'lucide-react';
import { formatSpanishDate } from '@/lib/formatters';
import { ApuestaResponse, BetOption } from '@/types';

export interface BetCardProps {
  bet: ApuestaResponse;
  onOpenBetModal?: (bet: ApuestaResponse) => void;
  onVote?: (id: string, voteType: 'up' | 'down') => void;
  readOnly?: boolean;
  showBadge?: boolean;
}

export default function BetCard({
  bet,
  onOpenBetModal,
  onVote,
  readOnly = false,
  showBadge = false,
}: BetCardProps) {
  if (bet.estado === 'propuesta') {
    return (
      <article className="bg-dracula-card border-dracula-gray/20 rounded-xl border p-4">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="text-dracula-light text-base leading-snug font-bold">
            {bet.title}
          </h3>
        </div>
        <div className="text-dracula-purple mb-3 flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase">
          <User size={12} /> Sugerida{' '}
          {bet.createdAt ? formatSpanishDate(bet.createdAt) : ''} por @
          {bet.creator}
        </div>
        <div className="bg-dracula-base border-dracula-gray/10 mb-4 rounded-lg border p-3">
          <span className="text-dracula-gray mb-2 block text-[10px] font-bold uppercase">
            Opciones propuestas:
          </span>
          <ul className="flex flex-col gap-1.5">
            {bet.options &&
              bet.options.map((betOption: BetOption, index: number) => (
                <li
                  key={betOption.id || index}
                  className="text-dracula-light flex justify-between text-xs"
                >
                  <span>- {betOption.text}</span>
                  <span className="text-dracula-yellow font-mono">
                    x{Number(betOption.multiplier).toFixed(2)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
        {!readOnly && onVote && (
          <div className="border-dracula-gray/10 flex items-center justify-end gap-2 border-t pt-3">
            <button
              onClick={() => onVote(bet.id, 'up')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                bet.user_vote === 'up'
                  ? 'bg-dracula-green/20 text-dracula-green border-dracula-green/50 border'
                  : 'bg-dracula-base text-dracula-gray border-dracula-gray/20 hover:text-dracula-green border'
              }`}
            >
              <ThumbsUp size={14} /> {bet.upvotes || 0}
            </button>
            <button
              onClick={() => onVote(bet.id, 'down')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                bet.user_vote === 'down'
                  ? 'bg-dracula-red/20 text-dracula-red border-dracula-red/50 border'
                  : 'bg-dracula-base text-dracula-gray border-dracula-gray/20 hover:text-dracula-red border'
              }`}
            >
              <ThumbsDown size={14} /> {bet.downvotes || 0}
            </button>
          </div>
        )}
      </article>
    );
  }

  if (bet.estado === 'abierta') {
    return (
      <article className="bg-dracula-card border-dracula-gray/10 flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <h2 className="text-dracula-light text-base leading-snug font-bold">
            {bet.title}
          </h2>
          <span className="bg-dracula-base text-dracula-gray border-dracula-gray/20 ml-2 rounded border px-2 py-1 text-[10px] font-bold whitespace-nowrap capitalize uppercase">
            {bet.phase ? bet.phase.replace('-', ' ') : 'General'}
          </span>
        </div>
        <span className="text-dracula-gray mt-1 mb-2 flex items-center gap-1 text-xs font-semibold">
          <User size={12} /> Aprobada{' '}
          {bet.approvedAt ? formatSpanishDate(bet.approvedAt) : ''}. Sugerida
          por @{bet.creator}
        </span>
        <div className="mt-1 flex flex-col gap-2">
          {bet.options?.map((betOption: BetOption) => {
            const isUserPick = bet.userVotedOptionId === betOption.id;
            return (
              <div
                key={betOption.id}
                className={`bg-dracula-base flex items-center justify-between rounded-lg border p-3 ${
                  isUserPick
                    ? 'border-dracula-purple shadow-[0_0_10px_rgba(189,147,249,0.1)]'
                    : 'border-dracula-gray/10'
                }`}
              >
                <span
                  className={`flex items-center gap-2 text-sm font-semibold ${
                    isUserPick ? 'text-dracula-purple' : 'text-dracula-light'
                  }`}
                >
                  {isUserPick && <CheckCircle size={14} />} {betOption.text}
                </span>
                <span className="bg-dracula-card text-dracula-yellow border-dracula-yellow/20 rounded border px-2 py-1 font-mono text-xs font-bold">
                  x{Number(betOption.multiplier).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
        {bet.userVotedOptionId ? (
          <div className="bg-dracula-purple/10 border-dracula-purple/20 mt-1 flex items-center justify-between rounded-lg border p-3 text-xs">
            <span className="text-dracula-gray font-medium">
              Tu Apuesta: 💰{' '}
              <span className="text-dracula-light font-bold">
                {bet.userBetAmount} QC
              </span>
            </span>
            <span className="text-dracula-green font-bold">
              Ganancia est: 💰{' '}
              {(
                (bet.userBetAmount || 0) *
                (Number(
                  bet.options?.find(
                    (option) => option.id === bet.userVotedOptionId
                  )?.multiplier
                ) || 0)
              ).toFixed(0)}{' '}
              QC
            </span>
          </div>
        ) : (
          !readOnly &&
          onOpenBetModal && (
            <button
              onClick={() => onOpenBetModal(bet)}
              className="bg-dracula-yellow text-dracula-base hover:bg-opacity-90 mt-1 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold shadow-md transition-all"
            >
              <Dice5 size={16} /> Apostar
            </button>
          )
        )}
      </article>
    );
  }

  // Cerrada
  return (
    <article className="bg-dracula-card border-dracula-gray/10 flex flex-col gap-2 rounded-xl border p-4 opacity-85">
      <div className="flex items-start justify-between">
        <div className="flex flex-1 items-center gap-2">
          {showBadge && (
            <span className="bg-dracula-purple/20 text-dracula-purple border-dracula-purple/30 shrink-0 rounded border px-2 py-1 text-[10px] font-black tracking-widest uppercase">
              🎲 Apuesta
            </span>
          )}
          <h3 className="text-dracula-light text-sm leading-tight font-bold">
            {bet.title}
          </h3>
        </div>
        <span className="bg-dracula-base text-dracula-gray border-dracula-gray/20 ml-2 rounded border px-2 py-1 text-[10px] font-bold whitespace-nowrap capitalize uppercase">
          {bet.phase ? bet.phase.replace('-', ' ') : 'General'}
        </span>
      </div>
      <span className="text-dracula-gray mt-1 flex items-center gap-1 text-[10px] font-semibold">
        {bet.approvedAt
          ? formatSpanishDate(bet.approvedAt)
          : bet.createdAt
            ? formatSpanishDate(bet.createdAt)
            : ''}
      </span>
      <div className="bg-dracula-base border-dracula-gray/20 mt-2 flex items-center justify-between rounded-lg border p-2">
        <div>
          <span className="text-dracula-gray block text-[10px] font-bold tracking-wider uppercase">
            Apostaste por
          </span>
          <span className="text-dracula-light text-xs font-semibold">
            {(bet.userBetAmount || 0) > 0
              ? bet.options?.find(
                  (option) => option.id === bet.userVotedOptionId
                )?.text || '???'
              : '-'}
          </span>
        </div>
        <div>
          <span className="text-dracula-gray block text-[10px] font-bold tracking-wider uppercase">
            Ganador
          </span>
          <span className="text-dracula-light text-xs font-semibold">
            {bet.winningOption}{' '}
            {bet.multiplier ? `(x${Number(bet.multiplier).toFixed(2)})` : ''}
          </span>
        </div>
      </div>
      {(bet.userBetAmount || 0) > 0 ? (
        <div className="border-dracula-gray/10 mt-1 flex items-center justify-between border-t pt-2 text-xs font-semibold">
          <span className="text-dracula-gray">
            Apostaste: 💰 {bet.userBetAmount} QC
          </span>
          {bet.userWon ? (
            <span className="text-dracula-green flex items-center gap-1">
              ¡Ganaste! +💰 {bet.profit} QC
            </span>
          ) : (
            <span className="text-dracula-red flex items-center gap-1">
              Perdiste -{bet.userBetAmount} QC
            </span>
          )}
        </div>
      ) : (
        <div className="text-dracula-gray border-dracula-gray/10 mt-1 border-t pt-3 pb-1 text-center text-xs font-semibold">
          No participaste en esta apuesta
        </div>
      )}
    </article>
  );
}
