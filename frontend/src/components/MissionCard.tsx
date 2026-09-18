import { Camera, CheckCircle, Dna, ThumbsDown, ThumbsUp, User, X } from 'lucide-react';
import { formatSpanishDate } from '@/lib/formatters';

interface MissionCardProps {
  mission: any;
  mode: 'active' | 'proposed' | 'closed';
  onCompleteClick?: (mission: any) => void;
  onVote?: (id: string, voteType: 'up' | 'down') => void;
}

export default function MissionCard({ mission, mode, onCompleteClick, onVote }: MissionCardProps) {
  if (mode === 'active') {
    const isFull =
      mission.max_completions !== null &&
      mission.max_completions !== undefined &&
      mission.completed_by &&
      mission.completed_by.length >= mission.max_completions;
      
    const cardBorder = mission.is_roulette
      ? 'border-[#ffb86c] shadow-[0_0_20px_rgba(255,184,108,0.4)] relative overflow-hidden'
      : 'border-dracula-gray/10';
    const titleColor = mission.is_roulette
      ? 'text-[#ffb86c]'
      : 'text-dracula-light';

    return (
      <article className={`bg-dracula-card p-4 rounded-xl border ${cardBorder} transition-all hover:border-dracula-gray/30`}>
        {mission.is_roulette && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffb86c]/10 rounded-bl-full -z-0 blur-xl"></div>
        )}
        <div className="flex justify-between items-start mb-2 relative z-10">
          <h2 className={`text-lg font-bold leading-tight pr-2 flex items-center gap-2 ${titleColor}`}>
            {mission.is_roulette && <Dna size={18} className="animate-pulse" />}
            {mission.title}
          </h2>
          <div className="flex flex-col items-end shrink-0 gap-1">
            {mission.createdAt && (
              <span className="text-[10px] text-dracula-gray font-semibold">
                {mission.is_roulette ? 'Aceptada a las: ' : ''}{formatSpanishDate(mission.createdAt)}
              </span>
            )}
            <span className="font-bold text-dracula-yellow bg-dracula-base px-2 py-1 rounded-lg text-sm border border-dracula-yellow/20">
              💰 {mission.reward}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2 flex-wrap relative z-10">
          <span className="text-[10px] font-bold uppercase text-dracula-gray bg-dracula-base px-2 py-1 rounded border border-dracula-gray/20 capitalize">
            {mission.phase?.replace('-', ' ')}
          </span>
          {mission.is_roulette && (
            <span className="text-[10px] font-bold uppercase text-[#282a36] bg-gradient-to-r from-[#ffb86c] to-[#ff79c6] px-2 py-1 rounded shadow-lg animate-pulse">
              Reto Exclusivo de Ruleta
            </span>
          )}
          {mission.max_completions !== null && mission.max_completions !== undefined && (
            <span className="text-[10px] font-bold text-dracula-gray">
              Cupo: {mission.completed_by?.length || 0}/{mission.max_completions}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[10px] font-bold text-dracula-purple uppercase tracking-wider mb-3">
          <User size={12} /> Propuesto por @{mission.author}
        </div>
        <p className="text-dracula-gray text-sm mb-4">{mission.description}</p>

        <button
          onClick={() => onCompleteClick && onCompleteClick(mission)}
          className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            mission.user_has_completed
              ? 'bg-dracula-purple/20 text-dracula-purple border border-dracula-purple/30 cursor-not-allowed'
              : mission.user_is_pending
              ? 'bg-dracula-yellow/20 text-dracula-yellow border border-dracula-yellow/50 cursor-not-allowed'
              : isFull
              ? 'bg-dracula-base text-dracula-gray border border-dracula-gray/20 cursor-not-allowed'
              : mission.is_roulette
              ? 'bg-[#ffb86c] text-dracula-base hover:opacity-90 shadow-[0_0_10px_rgba(255,184,108,0.4)]'
              : 'bg-dracula-green text-dracula-base hover:opacity-90 shadow-[0_0_10px_rgba(80,250,123,0.3)]'
          }`}
          disabled={mission.user_has_completed || mission.user_is_pending || isFull}
        >
          {mission.user_has_completed ? (
            <>
              <CheckCircle size={18} /> ¡Completada!
            </>
          ) : mission.user_is_pending ? (
            <>
              <CheckCircle size={18} /> Pendiente de validación por el tribunal
            </>
          ) : isFull ? (
            <>
              <X size={18} /> Cupo Lleno
            </>
          ) : (
            <>
              <Camera size={18} /> Reclamar Recompensa
            </>
          )}
        </button>
      </article>
    );
  }

  if (mode === 'proposed') {
    return (
      <article className="bg-dracula-card p-4 rounded-xl border border-dracula-gray/20 transition-all hover:border-dracula-gray/40">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-bold text-dracula-light">{mission.title}</h3>
          <div className="flex flex-col items-end shrink-0 gap-1">
            {mission.createdAt && (
              <span className="text-[10px] text-dracula-gray font-semibold">
                {formatSpanishDate(mission.createdAt)}
              </span>
            )}
            <span className="font-bold text-dracula-yellow bg-dracula-base px-2 py-0.5 rounded text-xs border border-dracula-yellow/20">
              💰 {mission.reward}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] font-bold text-dracula-purple uppercase tracking-wider mb-3">
          <User size={12} /> Propuesto por @{mission.author}
        </div>

        <p className="text-sm text-dracula-gray mb-4">{mission.description}</p>

        <div className="flex items-center justify-end gap-2 border-t border-dracula-gray/10 pt-3 mt-1">
          <button
            onClick={() => onVote && onVote(mission.id, 'up')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 ${
              mission.user_vote === 'up'
                ? 'bg-dracula-green/20 text-dracula-green border border-dracula-green/50'
                : 'bg-dracula-base text-dracula-gray border border-dracula-gray/20 hover:text-dracula-green hover:border-dracula-green/50'
            }`}
          >
            <ThumbsUp size={14} /> {mission.upvotes || 0}
          </button>
          <button
            onClick={() => onVote && onVote(mission.id, 'down')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 ${
              mission.user_vote === 'down'
                ? 'bg-dracula-red/20 text-dracula-red border border-dracula-red/50'
                : 'bg-dracula-base text-dracula-gray border border-dracula-gray/20 hover:text-dracula-red hover:border-dracula-red/50'
            }`}
          >
            <ThumbsDown size={14} /> {mission.downvotes || 0}
          </button>
        </div>
      </article>
    );
  }

  if (mode === 'closed') {
    return (
      <article className="bg-dracula-card p-4 rounded-xl border border-dracula-gray/10 opacity-85 transition-opacity hover:opacity-100">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-sm font-bold text-dracula-light leading-tight">{mission.title}</h3>
          <div className="flex flex-col items-end shrink-0 gap-1">
            {mission.createdAt && (
              <span className="text-[10px] text-dracula-gray font-semibold">
                {formatSpanishDate(mission.createdAt)}
              </span>
            )}
            <span className="bg-dracula-base text-dracula-gray px-2 py-1 rounded text-[10px] font-bold uppercase border border-dracula-gray/20 capitalize whitespace-nowrap ml-2">
              {mission.phase?.replace('-', ' ')}
            </span>
          </div>
        </div>

        <p className="text-xs text-dracula-gray mb-3">{mission.description}</p>

        <div className="bg-dracula-base p-3 rounded-lg border border-dracula-gray/20">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] text-dracula-gray block uppercase font-bold tracking-wider">
              Completada por
            </span>
            <span className="font-bold text-dracula-yellow bg-dracula-card px-2 py-0.5 rounded text-xs border border-dracula-yellow/20">
              💰 {mission.reward}
            </span>
          </div>
          
          {mission.completed_by && mission.completed_by.length > 0 ? (
            <div className="flex flex-col gap-3">
              {mission.completed_by.map((c: any, idx: number) => (
                <div key={idx} className="flex flex-col gap-1 border-b border-dracula-gray/10 pb-2 last:border-0 last:pb-0">
                  <span className="text-xs font-bold text-dracula-purple">@{c.username}</span>
                  {c.proof_text && (
                    <div className="bg-dracula-card p-2 rounded text-xs text-dracula-light italic relative mt-1 mb-1 border border-dracula-gray/20">
                      <div className="absolute -left-[5px] top-3 w-2 h-2 bg-dracula-card border-l border-t border-dracula-gray/20 transform -rotate-45"></div>
                      "{c.proof_text}"
                    </div>
                  )}
                  {c.proof_image_url && (
                    <div className="mt-1">
                      {c.proof_image_url.match(/\.(mp4|webm|ogg)$/i) || c.proof_image_url.includes('video') ? (
                        <video src={c.proof_image_url} controls className="w-full h-32 object-cover rounded border border-dracula-gray/20" />
                      ) : (
                        <img src={c.proof_image_url} alt="Prueba" className="w-full h-32 object-cover rounded border border-dracula-gray/20" />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs font-semibold text-dracula-gray">Nadie</span>
          )}
        </div>

        <div className="flex justify-between items-center text-xs mt-3 font-semibold border-t border-dracula-gray/10 pt-2">
          {mission.user_completed ? (
            <span className="text-dracula-green flex items-center gap-1">
              <CheckCircle size={14} /> ¡Reclamaste los +💰 {mission.reward}!
            </span>
          ) : (
            <span className="text-dracula-gray flex items-center gap-1">
              <X size={14} /> No llegaste a completarla
            </span>
          )}
        </div>
      </article>
    );
  }

  return null;
}
