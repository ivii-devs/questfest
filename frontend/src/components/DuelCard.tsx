'use client';

import { Swords, Check, ShieldX, Trophy, Clock, Scale } from 'lucide-react';
import { formatSpanishDate } from '@/lib/formatters';
import api from '@/lib/axios';
import toast from 'react-hot-toast';



export default function DuelCard({ duel, currentUser, onResolve, onAction, readOnly = false, showBadge = false }: any) {
  const isMyDuel = duel.challenger === currentUser || duel.challenged === currentUser;
  const isCompletedOrPenalized = duel.status.includes('completed') || duel.status.includes('penalized');

  if (isCompletedOrPenalized) {
    const iWon = duel.winner === currentUser;
    const iLost = isMyDuel && !iWon && duel.status === 'completed' && duel.winner;
    const isPenalized = duel.status.includes('penalized');
    const isTieOrCanceled = duel.status === 'completed' && !duel.winner;

    return (
      <article className={`p-4 rounded-xl border relative overflow-hidden ${iWon ? 'bg-dracula-green/5 border-dracula-green/30' : iLost ? 'bg-dracula-red/5 border-dracula-red/30' : isPenalized ? 'bg-dracula-purple/5 border-dracula-purple/30' : 'bg-dracula-base border-dracula-gray/20 opacity-80'}`}>
        <div className="flex flex-col mb-3">
          {duel.fecha_creacion && (
            <div className="text-right text-[10px] font-bold text-dracula-gray mb-1">
              {formatSpanishDate(duel.fecha_creacion)}
            </div>
          )}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              {showBadge && (
                <span className="bg-dracula-red/20 text-dracula-red text-[10px] font-black uppercase px-2 py-1 rounded tracking-widest border border-dracula-red/30 shrink-0">
                  ⚔️ Duelo
                </span>
              )}
              <span className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest leading-tight mt-1">
                {duel.game}
              </span>
            </div>
            <span className="text-xs font-black text-dracula-yellow bg-dracula-card px-2 py-1 rounded border border-dracula-yellow/20 ml-2">
              💰 {duel.wager}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className={`flex items-center gap-1.5 ${isTieOrCanceled ? 'text-dracula-gray font-semibold' : duel.winner === duel.challenger ? 'text-dracula-light font-bold' : 'text-dracula-gray line-through'}`}>
            {duel.winner === duel.challenger && <Trophy size={14} className="text-dracula-yellow" />}
            {duel.challenger === currentUser ? 'Tú' : duel.challenger}
          </div>
          <span className="text-dracula-red text-[10px] font-black italic">VS</span>
          <div className={`flex items-center gap-1.5 ${isTieOrCanceled ? 'text-dracula-gray font-semibold' : duel.winner === duel.challenged ? 'text-dracula-light font-bold' : 'text-dracula-gray line-through'}`}>
            {duel.challenged === currentUser ? 'Tú' : duel.challenged}
            {duel.winner === duel.challenged && <Trophy size={14} className="text-dracula-yellow" />}
          </div>
        </div>

        {duel.status === 'completed' && (iWon || iLost) && (
          <div className={`mt-3 text-center text-xs font-bold py-1 rounded ${iWon ? 'text-dracula-green bg-dracula-green/10' : 'text-dracula-red bg-dracula-red/10'}`}>
            {iWon ? `+💰 ${duel.wager}` : `-💰 ${duel.wager}`}
          </div>
        )}

        {isPenalized && (
          <div className="mt-3 text-center text-xs font-bold py-1.5 rounded text-dracula-base bg-dracula-purple">
            <Scale size={14} className="inline mr-1" /> Anulado por el Tribunal. Multas aplicadas.
          </div>
        )}

        {isTieOrCanceled && (
          <div className="mt-3 text-center text-xs font-bold py-1.5 rounded text-dracula-gray bg-dracula-gray/10 border border-dracula-gray/20">
            Empate / Cancelado. Se han devuelto los tokens.
          </div>
        )}
      </article>
    );
  }

  // Active Duel
  let StatusBadge;
  if (duel.status === 'pending') {
    StatusBadge = <><Clock size={12} className="text-dracula-yellow" /> <span className="text-dracula-yellow">Pendiente</span></>;
  } else if (duel.status === 'accepted') {
    StatusBadge = <><Swords size={12} className="text-dracula-red animate-pulse" /> <span className="text-dracula-red">En Batalla</span></>;
  } else {
    StatusBadge = (
      <>
        <Scale size={12} className="text-[#8be9fd]" />{' '}
        <span className="text-[#8be9fd]">
          Tribunal Admin{' '}
          {duel.status === 'validation_winner' && duel.reported_resolution
            ? (() => {
                if (duel.reported_resolution.includes(':')) {
                  const [reporter, outcome] = duel.reported_resolution.split(':');
                  const reporterName = reporter === 'challenger' ? duel.challenger : duel.challenged;
                  const outcomeText = outcome === 'draw' ? 'Empate' : outcome === 'challenger' ? duel.challenger : duel.challenged;
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

  return (
    <article className={`p-4 rounded-xl border relative overflow-hidden shadow-sm ${duel.status.includes('validation') ? 'bg-dracula-card/50 border-[#8be9fd]/30' : 'bg-dracula-card border-dracula-gray/10'}`}>
      <div className="absolute top-0 right-0 bg-dracula-base/80 px-3 py-1 rounded-bl-xl text-[10px] font-bold border-l border-b border-dracula-gray/20 flex items-center gap-1 uppercase tracking-wider">
        {showBadge && <span className="text-dracula-red mr-1 tracking-widest">⚔️ DUELO |</span>}
        {StatusBadge}
      </div>
      {duel.fecha_creacion && (
        <div className="absolute top-0 left-0 bg-dracula-base/80 px-3 py-1 rounded-br-xl text-[10px] font-bold border-r border-b border-dracula-gray/20 text-dracula-gray">
          {formatSpanishDate(duel.fecha_creacion)}
        </div>
      )}

        <div className={`flex justify-between items-center mt-4 mb-4 ${duel.status.includes('validation') ? 'opacity-50' : ''}`}>
          <div className="flex flex-col items-center gap-1 flex-1">
            {duel.challenger_avatar ? (
              <img src={duel.challenger_avatar} alt={duel.challenger} className={`w-12 h-12 rounded-full border-2 object-cover ${duel.challenger === currentUser ? 'border-dracula-purple' : 'border-dracula-gray/30'}`} />
            ) : (
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${duel.challenger === currentUser ? 'border-dracula-purple text-dracula-purple bg-dracula-purple/10' : 'border-dracula-gray/30 text-dracula-light bg-dracula-base'}`}>
                {duel.challenger.charAt(0).toUpperCase()}
              </div>
            )}
            <span className={`text-sm ${duel.challenger === currentUser ? 'font-black text-dracula-purple' : 'font-semibold text-dracula-light'}`}>
              {duel.challenger === currentUser ? 'Tú' : duel.challenger}
            </span>
          </div>

          <div className="flex flex-col items-center px-2">
            <span className="text-dracula-red font-black italic text-xl">VS</span>
            <span className="bg-dracula-base text-dracula-yellow font-bold text-xs px-2 py-1 rounded mt-1 border border-dracula-yellow/20">
              💰 {duel.wager}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1 flex-1">
            {duel.challenged_avatar ? (
              <img src={duel.challenged_avatar} alt={duel.challenged} className={`w-12 h-12 rounded-full border-2 object-cover ${duel.challenged === currentUser ? 'border-dracula-purple' : 'border-dracula-gray/30'}`} />
            ) : (
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${duel.challenged === currentUser ? 'border-dracula-purple text-dracula-purple bg-dracula-purple/10' : 'border-dracula-gray/30 text-dracula-light bg-dracula-base'}`}>
                {duel.challenged.charAt(0).toUpperCase()}
              </div>
            )}
            <span className={`text-sm ${duel.challenged === currentUser ? 'font-black text-dracula-purple' : 'font-semibold text-dracula-light'}`}>
              {duel.challenged === currentUser ? 'Tú' : duel.challenged}
            </span>
          </div>
        </div>

      <div className={`bg-dracula-base rounded-lg p-3 text-center text-sm text-dracula-light border border-dracula-gray/20 mb-3 ${duel.status.includes('validation') ? 'opacity-50' : ''}`}>
        <span className="text-dracula-gray font-semibold uppercase text-[10px] tracking-widest block mb-1">El Reto</span>
        {duel.game}
      </div>

      {!readOnly && (
        <>
          {duel.status === 'pending' && duel.isCurrentUserChallenged && (
            <div className="flex gap-2 mt-2">
              <button onClick={async () => { try { await api.post(`/api/duelos/${duel.id}/action?action=accept`); toast.success('Reto aceptado'); onAction?.(); } catch { toast.error('Error al aceptar (¿Sin fondos?)'); } }} className="flex-1 py-2.5 rounded-lg font-bold text-xs text-dracula-base bg-dracula-green hover:opacity-90 flex items-center justify-center gap-1.5 shadow">
                <Check size={16} /> Aceptar
              </button>
              <button onClick={async () => { try { await api.post(`/api/duelos/${duel.id}/action?action=reject`); toast.success('Has rechazado, cobarde. Tribunal avisado.'); onAction?.(); } catch { toast.error('Error al rechazar'); } }} className="flex-1 py-2.5 rounded-lg font-bold text-xs text-dracula-red bg-dracula-red/10 border border-dracula-red/30 hover:bg-dracula-red/20 flex items-center justify-center gap-1.5">
                <ShieldX size={16} /> Rechazar
              </button>
            </div>
          )}
          {duel.status === 'accepted' && isMyDuel && (
            <button onClick={() => onResolve?.(duel)} className="w-full py-2.5 rounded-lg font-bold text-xs text-dracula-base bg-dracula-purple hover:opacity-90 flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(189,147,249,0.3)]">
              <Trophy size={16} /> Informar Resultado
            </button>
          )}
        </>
      )}

      {duel.status === 'pending' && !duel.isCurrentUserChallenged && (
        <div className="text-center text-xs font-semibold text-dracula-gray bg-dracula-base p-2 rounded-lg border border-dracula-gray/10">
          Esperando a que {duel.challenged} acepte el duelo...
        </div>
      )}

      {duel.status === 'accepted' && !isMyDuel && (
        <div className="text-center text-xs font-semibold text-dracula-red bg-dracula-red/5 p-2 rounded-lg border border-dracula-red/10 animate-pulse">
          ¡Batalla en proceso! Sangre en la arena...
        </div>
      )}

      {duel.status === 'validation_winner' && (
        <div className="text-center text-xs font-semibold text-[#8be9fd] bg-[#8be9fd]/10 p-2 rounded-lg border border-[#8be9fd]/20">
          Esperando que el Admin confirme el ganador y reparta los tokens.
        </div>
      )}

      {duel.status === 'validation_rejected' && (
        <div className="text-center text-xs font-semibold text-[#8be9fd] bg-[#8be9fd]/10 p-2 rounded-lg border border-[#8be9fd]/20">
          Duelo rechazado. El Admin está decidiendo si hay multas.
        </div>
      )}
    </article>
  );
}
