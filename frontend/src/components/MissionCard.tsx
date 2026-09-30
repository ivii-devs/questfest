'use client';

/**
 * ============================================================================
 * COMPONENTE VISUAL DE TARJETA DE MISIÓN (MissionCard)
 * ============================================================================
 * Representa visualmente una misión en sus modos activo, propuesto (votación)
 * y cerrado (completada o expirada).
 * ============================================================================
 */

import React from 'react';
import {
  Camera,
  CheckCircle,
  Dna,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from 'lucide-react';
import { formatSpanishDate } from '@/lib/formatters';
import { MisionResponse, MissionCompletedByItem } from '@/types';

export interface MissionCardProps {
  mission: MisionResponse;
  mode: 'active' | 'proposed' | 'closed';
  onCompleteClick?: (mission: MisionResponse) => void;
  onVote?: (id: string | number, voteType: 'up' | 'down') => void;
}

export default function MissionCard({
  mission,
  mode,
  onCompleteClick,
  onVote,
}: MissionCardProps) {
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
      <article
        className={`bg-dracula-card rounded-xl border p-4 ${cardBorder} hover:border-dracula-gray/30 transition-all`}
      >
        {mission.is_roulette && (
          <div className="absolute top-0 right-0 -z-0 h-32 w-32 rounded-bl-full bg-[#ffb86c]/10 blur-xl"></div>
        )}
        <div className="relative z-10 mb-2 flex items-start justify-between">
          <h2
            className={`flex items-center gap-2 pr-2 text-lg leading-tight font-bold ${titleColor}`}
          >
            {mission.is_roulette && <Dna size={18} className="animate-pulse" />}
            {mission.title}
          </h2>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {mission.createdAt && (
              <span className="text-dracula-gray text-[10px] font-semibold">
                {mission.is_roulette ? 'Aceptada a las: ' : ''}
                {formatSpanishDate(mission.createdAt)}
              </span>
            )}
            <span className="text-dracula-yellow bg-dracula-base border-dracula-yellow/20 rounded-lg border px-2 py-1 text-sm font-bold">
              💰 {mission.reward}
            </span>
          </div>
        </div>

        <div className="relative z-10 mb-2 flex flex-wrap items-center gap-2">
          <span className="text-dracula-gray bg-dracula-base border-dracula-gray/20 rounded border px-2 py-1 text-[10px] font-bold capitalize uppercase">
            {mission.phase ? mission.phase.replace('-', ' ') : 'General'}
          </span>
          {mission.is_roulette && (
            <span className="animate-pulse rounded bg-gradient-to-r from-[#ffb86c] to-[#ff79c6] px-2 py-1 text-[10px] font-bold text-[#282a36] uppercase shadow-lg">
              Reto Exclusivo de Ruleta
            </span>
          )}
          {mission.max_completions !== null &&
            mission.max_completions !== undefined && (
              <span className="text-dracula-gray text-[10px] font-bold">
                Cupo: {mission.completed_by?.length || 0}/
                {mission.max_completions}
              </span>
            )}
        </div>

        <div className="text-dracula-purple mb-3 flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase">
          <User size={12} /> Propuesto por @{mission.author || 'QuestFest'}
        </div>
        <p className="text-dracula-gray mb-4 text-sm">{mission.description}</p>

        <button
          onClick={() => onCompleteClick && onCompleteClick(mission)}
          className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition-all ${
            mission.user_has_completed
              ? 'bg-dracula-purple/20 text-dracula-purple border-dracula-purple/30 cursor-not-allowed border'
              : mission.user_is_pending
                ? 'bg-dracula-yellow/20 text-dracula-yellow border-dracula-yellow/50 cursor-not-allowed border'
                : isFull
                  ? 'bg-dracula-base text-dracula-gray border-dracula-gray/20 cursor-not-allowed border'
                  : mission.is_roulette
                    ? 'text-dracula-base bg-[#ffb86c] shadow-[0_0_10px_rgba(255,184,108,0.4)] hover:opacity-90'
                    : 'bg-dracula-green text-dracula-base shadow-[0_0_10px_rgba(80,250,123,0.3)] hover:opacity-90'
          }`}
          disabled={Boolean(
            mission.user_has_completed || mission.user_is_pending || isFull
          )}
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
      <article className="bg-dracula-card border-dracula-gray/20 hover:border-dracula-gray/40 rounded-xl border p-4 transition-all">
        <div className="mb-1 flex items-start justify-between">
          <h3 className="text-dracula-light text-lg font-bold">
            {mission.title}
          </h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {mission.createdAt && (
              <span className="text-dracula-gray text-[10px] font-semibold">
                {formatSpanishDate(mission.createdAt)}
              </span>
            )}
            <span className="text-dracula-yellow bg-dracula-base border-dracula-yellow/20 rounded border px-2 py-0.5 text-xs font-bold">
              💰 {mission.reward}
            </span>
          </div>
        </div>

        <div className="text-dracula-purple mb-3 flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase">
          <User size={12} /> Propuesto por @{mission.author || 'Jugador'}
        </div>

        <p className="text-dracula-gray mb-4 text-sm">{mission.description}</p>

        <div className="border-dracula-gray/10 mt-1 flex items-center justify-end gap-2 border-t pt-3">
          <button
            onClick={() => onVote && onVote(mission.id, 'up')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all hover:scale-105 ${
              mission.user_vote === 'up'
                ? 'bg-dracula-green/20 text-dracula-green border-dracula-green/50 border'
                : 'bg-dracula-base text-dracula-gray border-dracula-gray/20 hover:text-dracula-green hover:border-dracula-green/50 border'
            }`}
          >
            <ThumbsUp size={14} /> {mission.upvotes || 0}
          </button>
          <button
            onClick={() => onVote && onVote(mission.id, 'down')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all hover:scale-105 ${
              mission.user_vote === 'down'
                ? 'bg-dracula-red/20 text-dracula-red border-dracula-red/50 border'
                : 'bg-dracula-base text-dracula-gray border-dracula-gray/20 hover:text-dracula-red hover:border-dracula-red/50 border'
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
      <article className="bg-dracula-card border-dracula-gray/10 rounded-xl border p-4 opacity-85 transition-opacity hover:opacity-100">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="text-dracula-light text-sm leading-tight font-bold">
            {mission.title}
          </h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {mission.createdAt && (
              <span className="text-dracula-gray text-[10px] font-semibold">
                {formatSpanishDate(mission.createdAt)}
              </span>
            )}
            <span className="bg-dracula-base text-dracula-gray border-dracula-gray/20 ml-2 rounded border px-2 py-1 text-[10px] font-bold whitespace-nowrap capitalize uppercase">
              {mission.phase ? mission.phase.replace('-', ' ') : 'General'}
            </span>
          </div>
        </div>

        <p className="text-dracula-gray mb-3 text-xs">{mission.description}</p>

        <div className="bg-dracula-base border-dracula-gray/20 rounded-lg border p-3">
          <div className="mb-2 flex items-start justify-between">
            <span className="text-dracula-gray block text-[10px] font-bold tracking-wider uppercase">
              Completada por
            </span>
            <span className="text-dracula-yellow bg-dracula-card border-dracula-yellow/20 rounded border px-2 py-0.5 text-xs font-bold">
              💰 {mission.reward}
            </span>
          </div>

          {mission.completed_by && mission.completed_by.length > 0 ? (
            <div className="flex flex-col gap-3">
              {mission.completed_by.map((item, idx: number) => {
                const proofData: MissionCompletedByItem =
                  typeof item === 'string' ? { username: item } : item;

                return (
                  <div
                    key={idx}
                    className="border-dracula-gray/10 flex flex-col gap-1 border-b pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-dracula-purple text-xs font-bold">
                      @{proofData.username}
                    </span>
                    {proofData.proof_text && (
                      <div className="bg-dracula-card text-dracula-light border-dracula-gray/20 relative mt-1 mb-1 rounded border p-2 text-xs italic">
                        <div className="bg-dracula-card border-dracula-gray/20 absolute top-3 -left-[5px] h-2 w-2 -rotate-45 transform border-t border-l"></div>
                        &ldquo;{proofData.proof_text}&rdquo;
                      </div>
                    )}
                    {proofData.proof_image_url && (
                      <div className="mt-1">
                        {proofData.proof_image_url.match(
                          /\.(mp4|webm|ogg)$/i
                        ) || proofData.proof_image_url.includes('video') ? (
                          <video
                            src={proofData.proof_image_url}
                            controls
                            className="border-dracula-gray/20 h-32 w-full rounded border object-cover"
                          />
                        ) : (
                          <img
                            src={proofData.proof_image_url}
                            alt="Prueba"
                            className="border-dracula-gray/20 h-32 w-full rounded border object-cover"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="text-dracula-gray text-xs font-semibold">
              Nadie
            </span>
          )}
        </div>

        <div className="border-dracula-gray/10 mt-3 flex items-center justify-between border-t pt-2 text-xs font-semibold">
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
