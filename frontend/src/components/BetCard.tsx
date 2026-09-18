'use client';

import { CheckCircle, User, ThumbsUp, ThumbsDown, Dice5 } from 'lucide-react';
import { formatSpanishDate } from '@/lib/formatters';



export default function BetCard({ bet, onOpenBetModal, onVote, readOnly = false, showBadge = false }: any) {
  if (bet.estado === 'propuesta') {
    return (
      <article className="bg-dracula-card p-4 rounded-xl border border-dracula-gray/20">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-base font-bold text-dracula-light leading-snug">{bet.title}</h3>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-dracula-purple uppercase tracking-wider mb-3">
          <User size={12} /> Sugerida {bet.createdAt ? formatSpanishDate(bet.createdAt) : ''} por @{bet.creator}
        </div>
        <div className="bg-dracula-base p-3 rounded-lg border border-dracula-gray/10 mb-4">
          <span className="text-[10px] text-dracula-gray uppercase font-bold mb-2 block">Opciones propuestas:</span>
          <ul className="flex flex-col gap-1.5">
            {bet.options && bet.options.map((opt: any, index: number) => (
              <li key={index} className="flex justify-between text-xs text-dracula-light">
                <span>- {opt.text}</span>
                <span className="font-mono text-dracula-yellow">x{opt.multiplier.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
        {!readOnly && onVote && (
          <div className="flex items-center justify-end gap-2 border-t border-dracula-gray/10 pt-3">
            <button onClick={() => onVote(bet.id, 'up')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${bet.user_vote === 'up' ? 'bg-dracula-green/20 text-dracula-green border border-dracula-green/50' : 'bg-dracula-base text-dracula-gray border border-dracula-gray/20 hover:text-dracula-green'}`}>
              <ThumbsUp size={14} /> {bet.upvotes}
            </button>
            <button onClick={() => onVote(bet.id, 'down')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${bet.user_vote === 'down' ? 'bg-dracula-red/20 text-dracula-red border border-dracula-red/50' : 'bg-dracula-base text-dracula-gray border border-dracula-gray/20 hover:text-dracula-red'}`}>
              <ThumbsDown size={14} /> {bet.downvotes}
            </button>
          </div>
        )}
      </article>
    );
  }

  if (bet.estado === 'abierta') {
    return (
      <article className="bg-dracula-card p-4 rounded-xl border border-dracula-gray/10 flex flex-col gap-3 shadow-sm">
        <div className="flex justify-between items-start">
          <h2 className="text-base font-bold text-dracula-light leading-snug">{bet.title}</h2>
          <span className="bg-dracula-base text-dracula-gray px-2 py-1 rounded text-[10px] font-bold uppercase border border-dracula-gray/20 capitalize whitespace-nowrap ml-2">
            {bet.phase.replace('-', ' ')}
          </span>
        </div>
        <span className="text-xs text-dracula-gray font-semibold flex items-center gap-1 mt-1 mb-2">
          <User size={12} /> Aprobada {bet.approvedAt ? formatSpanishDate(bet.approvedAt) : ''}. Sugerida por @{bet.creator}
        </span>
        <div className="flex flex-col gap-2 mt-1">
          {bet.options.map((opt: any) => {
            const isUserPick = bet.userVotedOptionId === opt.id;
            return (
              <div key={opt.id} className={`p-3 rounded-lg bg-dracula-base border flex justify-between items-center ${isUserPick ? 'border-dracula-purple shadow-[0_0_10px_rgba(189,147,249,0.1)]' : 'border-dracula-gray/10'}`}>
                <span className={`text-sm font-semibold flex items-center gap-2 ${isUserPick ? 'text-dracula-purple' : 'text-dracula-light'}`}>
                  {isUserPick && <CheckCircle size={14} />} {opt.text}
                </span>
                <span className="font-mono font-bold text-xs bg-dracula-card text-dracula-yellow px-2 py-1 rounded border border-dracula-yellow/20">
                  x{opt.multiplier.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
        {bet.userVotedOptionId ? (
          <div className="bg-dracula-purple/10 border border-dracula-purple/20 rounded-lg p-3 flex justify-between items-center text-xs mt-1">
            <span className="text-dracula-gray font-medium">Tu Apuesta: 💰 <span className="font-bold text-dracula-light">{bet.userBetAmount} QC</span></span>
            <span className="text-dracula-green font-bold">Ganancia est: 💰 {(bet.userBetAmount * (bet.options.find((o: any) => o.id === bet.userVotedOptionId)?.multiplier || 0)).toFixed(0)} QC</span>
          </div>
        ) : (
          !readOnly && onOpenBetModal && (
            <button onClick={() => onOpenBetModal(bet)} className="w-full py-2.5 mt-1 rounded-lg font-bold text-sm bg-dracula-yellow text-dracula-base hover:bg-opacity-90 transition-all flex justify-center items-center gap-2 shadow-md">
              <Dice5 size={16} /> Apostar
            </button>
          )
        )}
      </article>
    );
  }

  // Cerrada
  return (
    <article className="bg-dracula-card p-4 rounded-xl border border-dracula-gray/10 flex flex-col gap-2 opacity-85">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 flex-1">
          {showBadge && (
            <span className="bg-dracula-purple/20 text-dracula-purple text-[10px] font-black uppercase px-2 py-1 rounded tracking-widest border border-dracula-purple/30 shrink-0">
              🎲 Apuesta
            </span>
          )}
          <h3 className="text-sm font-bold text-dracula-light leading-tight">{bet.title}</h3>
        </div>
        <span className="bg-dracula-base text-dracula-gray px-2 py-1 rounded text-[10px] font-bold uppercase border border-dracula-gray/20 capitalize whitespace-nowrap ml-2">
          {bet.phase.replace('-', ' ')}
        </span>
      </div>
      <span className="text-[10px] text-dracula-gray font-semibold flex items-center gap-1 mt-1">
        {bet.approvedAt ? formatSpanishDate(bet.approvedAt) : (bet.createdAt ? formatSpanishDate(bet.createdAt) : '')}
      </span>
      <div className="flex justify-between items-center mt-2 bg-dracula-base p-2 rounded-lg border border-dracula-gray/20">
        <div>
          <span className="text-[10px] text-dracula-gray block uppercase font-bold tracking-wider">Apostaste por</span>
          <span className="text-xs font-semibold text-dracula-light">{bet.userBetAmount > 0 ? (bet.options?.find((o: any) => o.id === bet.userVotedOptionId)?.text || '???') : '-'}</span>
        </div>
        <div>
          <span className="text-[10px] text-dracula-gray block uppercase font-bold tracking-wider">Ganador</span>
          <span className="text-xs font-semibold text-dracula-light">
            {bet.winningOption} {bet.multiplier ? `(x${bet.multiplier.toFixed(2)})` : ''}
          </span>
        </div>
      </div>
      {bet.userBetAmount > 0 ? (
        <div className="flex justify-between items-center text-xs mt-1 font-semibold border-t border-dracula-gray/10 pt-2">
          <span className="text-dracula-gray">Apostaste: 💰 {bet.userBetAmount} QC</span>
          {bet.userWon ? (
            <span className="text-dracula-green flex items-center gap-1">¡Ganaste! +💰 {bet.profit} QC</span>
          ) : (
            <span className="text-dracula-red flex items-center gap-1">Perdiste {-bet.userBetAmount} QC</span>
          )}
        </div>
      ) : (
        <div className="text-center text-xs font-semibold text-dracula-gray border-t border-dracula-gray/10 pt-3 mt-1 pb-1">
          No participaste en esta apuesta
        </div>
      )}
    </article>
  );
}
