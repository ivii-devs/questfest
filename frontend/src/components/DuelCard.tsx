'use client';

/**
 * ============================================================================
 * COMPONENTE VISUAL DE TARJETA DE DUELO (DuelCard - Dumb Component)
 * ============================================================================
 * Representa la tarjeta presentacional de un reto 1v1 tanto en curso como histórico.
 * No realiza llamadas directas a Axios; delega las mutaciones en callbacks
 * o en la capa de servicios tipada de duelos.
 * ============================================================================
 */

import React from 'react';
import { Swords, Check, ShieldX, Trophy, Clock, Scale } from 'lucide-react';
import { formatSpanishDate } from '@/lib/formatters';
import { acceptDuel, rejectDuel } from '@/services/duelsService';
import { DueloModel } from '@/types';
import toast from 'react-hot-toast';

export interface DuelCardProps {
  duel: DueloModel;
  currentUser: string;
  onResolve?: (duel: DueloModel) => void;
  onAction?: () => void;
  onAccept?: (id: number) => Promise<void>;
  onReject?: (id: number) => Promise<void>;
  readOnly?: boolean;
  showBadge?: boolean;
}

export default function DuelCard({
  duel,
  currentUser,
  onResolve,
  onAction,
  onAccept,
  onReject,
  readOnly = false,
  showBadge = false,
}: DuelCardProps) {
  const isMyDuel =
    duel.challenger === currentUser || duel.challenged === currentUser;
  const isCompletedOrPenalized =
    duel.status.includes('completed') || duel.status.includes('penalized');

  const handleAcceptClick = async () => {
    try {
      if (onAccept) {
        await onAccept(duel.id);
      } else {
        await acceptDuel(duel.id);
      }
      toast.success('Reto aceptado');
      onAction?.();
    } catch {
      toast.error('Error al aceptar (¿Sin fondos?)');
    }
  };

  const handleRejectClick = async () => {
    try {
      if (onReject) {
        await onReject(duel.id);
      } else {
        await rejectDuel(duel.id);
      }
      toast.success('Has rechazado, cobarde. Tribunal avisado.');
      onAction?.();
    } catch {
      toast.error('Error al rechazar');
    }
  };

  if (isCompletedOrPenalized) {
    const iWon = duel.winner === currentUser;
    const iLost =
      isMyDuel && !iWon && duel.status === 'completed' && Boolean(duel.winner);
    const isPenalized = duel.status.includes('penalized');
    const isTieOrCanceled = duel.status === 'completed' && !duel.winner;

    return (
      <article
        className={`relative overflow-hidden rounded-xl border p-4 ${
          iWon
            ? 'bg-dracula-green/5 border-dracula-green/30'
            : iLost
              ? 'bg-dracula-red/5 border-dracula-red/30'
              : isPenalized
                ? 'bg-dracula-purple/5 border-dracula-purple/30'
                : 'bg-dracula-base border-dracula-gray/20 opacity-80'
        }`}
      >
        <div className="mb-3 flex flex-col">
          {duel.fecha_creacion && (
            <div className="text-dracula-gray mb-1 text-right text-[10px] font-bold">
              {formatSpanishDate(duel.fecha_creacion)}
            </div>
          )}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {showBadge && (
                <span className="bg-dracula-red/20 text-dracula-red border-dracula-red/30 shrink-0 rounded border px-2 py-1 text-[10px] font-black tracking-widest uppercase">
                  ⚔️ Duelo
                </span>
              )}
              <span className="text-dracula-gray mt-1 text-[10px] leading-tight font-bold tracking-widest uppercase">
                {duel.game}
              </span>
            </div>
            <span className="text-dracula-yellow bg-dracula-card border-dracula-yellow/20 ml-2 rounded border px-2 py-1 text-xs font-black">
              💰 {duel.wager}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div
            className={`flex items-center gap-1.5 ${
              isTieOrCanceled
                ? 'text-dracula-gray font-semibold'
                : duel.winner === duel.challenger
                  ? 'text-dracula-light font-bold'
                  : 'text-dracula-gray line-through'
            }`}
          >
            {duel.winner === duel.challenger && (
              <Trophy size={14} className="text-dracula-yellow" />
            )}
            {duel.challenger === currentUser ? 'Tú' : duel.challenger}
          </div>
          <span className="text-dracula-red text-[10px] font-black italic">
            VS
          </span>
          <div
            className={`flex items-center gap-1.5 ${
              isTieOrCanceled
                ? 'text-dracula-gray font-semibold'
                : duel.winner === duel.challenged
                  ? 'text-dracula-light font-bold'
                  : 'text-dracula-gray line-through'
            }`}
          >
            {duel.challenged === currentUser ? 'Tú' : duel.challenged}
            {duel.winner === duel.challenged && (
              <Trophy size={14} className="text-dracula-yellow" />
            )}
          </div>
        </div>

        {duel.status === 'completed' && (iWon || iLost) && (
          <div
            className={`mt-3 rounded py-1 text-center text-xs font-bold ${
              iWon
                ? 'text-dracula-green bg-dracula-green/10'
                : 'text-dracula-red bg-dracula-red/10'
            }`}
          >
            {iWon ? `+💰 ${duel.wager}` : `-💰 ${duel.wager}`}
          </div>
        )}

        {isPenalized && (
          <div className="text-dracula-base bg-dracula-purple mt-3 rounded py-1.5 text-center text-xs font-bold">
            <Scale size={14} className="mr-1 inline" /> Anulado por el Tribunal.
            Multas aplicadas.
          </div>
        )}

        {isTieOrCanceled && (
          <div className="text-dracula-gray bg-dracula-gray/10 border-dracula-gray/20 mt-3 rounded border py-1.5 text-center text-xs font-bold">
            Empate / Cancelado. Se han devuelto los tokens.
          </div>
        )}
      </article>
    );
  }

  // Active Duel
  let statusBadge;
  if (duel.status === 'pending') {
    statusBadge = (
      <>
        <Clock size={12} className="text-dracula-yellow" />{' '}
        <span className="text-dracula-yellow">Pendiente</span>
      </>
    );
  } else if (duel.status === 'accepted') {
    statusBadge = (
      <>
        <Swords size={12} className="text-dracula-red animate-pulse" />{' '}
        <span className="text-dracula-red">En Batalla</span>
      </>
    );
  } else {
    statusBadge = (
      <>
        <Scale size={12} className="text-[#8be9fd]" />{' '}
        <span className="text-[#8be9fd]">
          Tribunal Admin{' '}
          {duel.status === 'validation_winner' && duel.reported_resolution
            ? (() => {
                if (duel.reported_resolution.includes(':')) {
                  const [reporter, outcome] =
                    duel.reported_resolution.split(':');
                  const reporterName =
                    reporter === 'challenger'
                      ? duel.challenger
                      : duel.challenged;
                  const outcomeText =
                    outcome === 'draw'
                      ? 'Empate'
                      : outcome === 'challenger'
                        ? duel.challenger
                        : duel.challenged;
                  return ` (El jugador ${reporterName} reporta: ${outcomeText})`;
                }
                return ` (Informado: ${
                  duel.reported_resolution === 'draw'
                    ? 'Empate'
                    : duel.reported_resolution === 'challenger'
                      ? duel.challenger
                      : duel.challenged
                })`;
              })()
            : ''}
        </span>
      </>
    );
  }

  const isCurrentUserChallenged =
    duel.isCurrentUserChallenged ??
    duel.is_current_user_challenged ??
    duel.challenged === currentUser;

  return (
    <article
      className={`relative overflow-hidden rounded-xl border p-4 shadow-sm ${
        duel.status.includes('validation')
          ? 'bg-dracula-card/50 border-[#8be9fd]/30'
          : 'bg-dracula-card border-dracula-gray/10'
      }`}
    >
      <div className="bg-dracula-base/80 border-dracula-gray/20 absolute top-0 right-0 flex items-center gap-1 rounded-bl-xl border-b border-l px-3 py-1 text-[10px] font-bold tracking-wider uppercase">
        {showBadge && (
          <span className="text-dracula-red mr-1 tracking-widest">
            ⚔️ DUELO |
          </span>
        )}
        {statusBadge}
      </div>
      {duel.fecha_creacion && (
        <div className="bg-dracula-base/80 border-dracula-gray/20 text-dracula-gray absolute top-0 left-0 rounded-br-xl border-r border-b px-3 py-1 text-[10px] font-bold">
          {formatSpanishDate(duel.fecha_creacion)}
        </div>
      )}

      <div
        className={`mt-4 mb-4 flex items-center justify-between ${
          duel.status.includes('validation') ? 'opacity-50' : ''
        }`}
      >
        <div className="flex flex-1 flex-col items-center gap-1">
          {duel.challenger_avatar ? (
            <img
              src={duel.challenger_avatar}
              alt={duel.challenger}
              className={`h-12 w-12 rounded-full border-2 object-cover ${
                duel.challenger === currentUser
                  ? 'border-dracula-purple'
                  : 'border-dracula-gray/30'
              }`}
            />
          ) : (
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-bold ${
                duel.challenger === currentUser
                  ? 'border-dracula-purple text-dracula-purple bg-dracula-purple/10'
                  : 'border-dracula-gray/30 text-dracula-light bg-dracula-base'
              }`}
            >
              {duel.challenger.charAt(0).toUpperCase()}
            </div>
          )}
          <span
            className={`text-sm ${
              duel.challenger === currentUser
                ? 'text-dracula-purple font-black'
                : 'text-dracula-light font-semibold'
            }`}
          >
            {duel.challenger === currentUser ? 'Tú' : duel.challenger}
          </span>
        </div>

        <div className="flex flex-col items-center px-2">
          <span className="text-dracula-red text-xl font-black italic">VS</span>
          <span className="bg-dracula-base text-dracula-yellow border-dracula-yellow/20 mt-1 rounded border px-2 py-1 text-xs font-bold">
            💰 {duel.wager}
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center gap-1">
          {duel.challenged_avatar ? (
            <img
              src={duel.challenged_avatar}
              alt={duel.challenged}
              className={`h-12 w-12 rounded-full border-2 object-cover ${
                duel.challenged === currentUser
                  ? 'border-dracula-purple'
                  : 'border-dracula-gray/30'
              }`}
            />
          ) : (
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-bold ${
                duel.challenged === currentUser
                  ? 'border-dracula-purple text-dracula-purple bg-dracula-purple/10'
                  : 'border-dracula-gray/30 text-dracula-light bg-dracula-base'
              }`}
            >
              {duel.challenged.charAt(0).toUpperCase()}
            </div>
          )}
          <span
            className={`text-sm ${
              duel.challenged === currentUser
                ? 'text-dracula-purple font-black'
                : 'text-dracula-light font-semibold'
            }`}
          >
            {duel.challenged === currentUser ? 'Tú' : duel.challenged}
          </span>
        </div>
      </div>

      <div
        className={`bg-dracula-base text-dracula-light border-dracula-gray/20 mb-3 rounded-lg border p-3 text-center text-sm ${
          duel.status.includes('validation') ? 'opacity-50' : ''
        }`}
      >
        <span className="text-dracula-gray mb-1 block text-[10px] font-semibold tracking-widest uppercase">
          El Reto
        </span>
        {duel.game}
      </div>

      {!readOnly && (
        <>
          {duel.status === 'pending' && isCurrentUserChallenged && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleAcceptClick}
                className="text-dracula-base bg-dracula-green flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold shadow hover:opacity-90"
              >
                <Check size={16} /> Aceptar
              </button>
              <button
                onClick={handleRejectClick}
                className="text-dracula-red bg-dracula-red/10 border-dracula-red/30 hover:bg-dracula-red/20 flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-bold"
              >
                <ShieldX size={16} /> Rechazar
              </button>
            </div>
          )}
          {duel.status === 'accepted' && isMyDuel && (
            <button
              onClick={() => onResolve?.(duel)}
              className="text-dracula-base bg-dracula-purple flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold shadow-[0_0_10px_rgba(189,147,249,0.3)] hover:opacity-90"
            >
              <Trophy size={16} /> Informar Resultado
            </button>
          )}
        </>
      )}

      {duel.status === 'pending' && !isCurrentUserChallenged && (
        <div className="text-dracula-gray bg-dracula-base border-dracula-gray/10 rounded-lg border p-2 text-center text-xs font-semibold">
          Esperando a que {duel.challenged} acepte el duelo...
        </div>
      )}

      {duel.status === 'accepted' && !isMyDuel && (
        <div className="text-dracula-red bg-dracula-red/5 border-dracula-red/10 animate-pulse rounded-lg border p-2 text-center text-xs font-semibold">
          ¡Batalla en proceso! Sangre en la arena...
        </div>
      )}

      {duel.status === 'validation_winner' && (
        <div className="rounded-lg border border-[#8be9fd]/20 bg-[#8be9fd]/10 p-2 text-center text-xs font-semibold text-[#8be9fd]">
          Esperando que el Admin confirme el ganador y reparta los tokens.
        </div>
      )}

      {duel.status === 'validation_rejected' && (
        <div className="rounded-lg border border-[#8be9fd]/20 bg-[#8be9fd]/10 p-2 text-center text-xs font-semibold text-[#8be9fd]">
          Duelo rechazado. El Admin está decidiendo si hay multas.
        </div>
      )}
    </article>
  );
}
