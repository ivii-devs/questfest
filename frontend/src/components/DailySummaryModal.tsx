'use client';

/**
 * ============================================================================
 * MODAL DE BOLETÍN INFORMATIVO MATUTINO: QuestFest PWA
 * ============================================================================
 * Tarjeta de condecoraciones y estadísticas destacadas del día anterior.
 * 
 * Se activa condicionalmente a partir de la hora configurada por el tribunal (ej: 12:00)
 * o mediante proyección forzada en el panel administrativo (`forceOpen`).
 * 
 * Estadísticas reflejadas:
 * 1. Líder Actual (primero en la clasificación general de tokens).
 * 2. Farolillo Rojo (último lugar con menos recursos).
 * 3. Más Acertado (rey de las apuestas predictivas).
 * 4. Más Misiones (jugador con más retos completados).
 * 5. Destrozó en un Duelo (victoria destacada en combate PvP).
 * 6. Se Forró vs Se Arruinó (mayores variaciones económicas de la jornada).
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import {
  Trophy,
  TrendingDown,
  Dice5,
  Target,
  Swords,
  TrendingUp,
  X,
  Flame,
} from 'lucide-react';

export interface StatUser {
  name: string;
  points?: number;
  count?: number;
  amount?: string;
}

export interface DuelStat {
  name: string;
  opponent: string;
}

export interface DailySummaryData {
  phase?: string;
  firstPlace?: StatUser;
  lastPlace?: StatUser;
  mostBetsWon?: StatUser;
  mostMissions?: StatUser;
  duelWinner?: DuelStat;
  biggestWinner?: StatUser;
  biggestLoser?: StatUser;
}

export type DailyStats = DailySummaryData;

export interface DailySummaryModalProps {
  forceOpen?: boolean;
  previewData?: DailySummaryData;
  onClosePreview?: () => void;
}

export default function DailySummaryModal({
  forceOpen,
  previewData,
  onClosePreview,
}: DailySummaryModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => {
    if (onClosePreview) {
      return onClosePreview();
    }
    setIsOpen(false);
  };

  const isVisible = forceOpen ?? isOpen;
  if (!isVisible || !previewData) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-dracula-base w-full max-w-sm rounded-2xl shadow-[0_0_30px_rgba(189,147,249,0.2)] border-2 border-dracula-purple overflow-hidden flex flex-col relative scale-in-center">
        {/* Confeti estético de fondo (Simulado con gradientes) */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-dracula-purple/20 to-transparent pointer-events-none" />

        {/* --- CABECERA --- */}
        <div className="p-5 text-center relative z-10 border-b border-dracula-gray/20">
          <div className="mx-auto bg-dracula-purple/20 w-14 h-14 rounded-full flex items-center justify-center mb-3 text-dracula-purple shadow-[0_0_15px_rgba(189,147,249,0.4)] animate-pulse">
            <Flame size={28} />
          </div>
          <h2 className="text-xl font-black text-dracula-light uppercase tracking-wide">
            Boletín Informativo
          </h2>
          {previewData.phase && (
            <p className="text-xs text-dracula-purple font-bold mt-1 uppercase tracking-widest">
              Resumen de la {previewData.phase}
            </p>
          )}
        </div>

        {/* --- CUERPO: LAS 6 ESTADÍSTICAS --- */}
        <div className="p-5 flex flex-col gap-3 overflow-y-auto max-h-[50vh] relative z-10">
          {/* 1. Primero en el ranking */}
          {previewData.firstPlace && (
            <div className="flex items-center gap-3 bg-dracula-card p-3 rounded-xl border border-dracula-yellow/20">
              <div className="bg-dracula-yellow/10 p-2 rounded-lg text-dracula-yellow">
                <Trophy size={18} />
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-[10px] text-dracula-gray uppercase font-bold">Líder Actual</span>
                <span className="text-sm font-bold text-dracula-light">
                  @{previewData.firstPlace.name} <span className="text-xs text-dracula-yellow">({previewData.firstPlace.points} QC)</span>
                </span>
              </div>
            </div>
          )}

          {/* 2. Último en el ranking */}
          {previewData.lastPlace && (
            <div className="flex items-center gap-3 bg-dracula-card p-3 rounded-xl border border-dracula-red/20">
              <div className="bg-dracula-red/10 p-2 rounded-lg text-dracula-red">
                <TrendingDown size={18} />
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-[10px] text-dracula-gray uppercase font-bold">Farolillo Rojo</span>
                <span className="text-sm font-bold text-dracula-light">
                  @{previewData.lastPlace.name} <span className="text-xs text-dracula-red">({previewData.lastPlace.points} QC)</span>
                </span>
              </div>
            </div>
          )}

          {/* 3 & 4. Apuestas y Misiones */}
          {(previewData.mostBetsWon || previewData.mostMissions) && (
            <div className="grid grid-cols-2 gap-3">
              {previewData.mostBetsWon && (
                <div className="flex flex-col gap-1.5 bg-dracula-card p-3 rounded-xl border border-dracula-gray/20 text-center">
                  <Dice5 size={16} className="text-dracula-yellow mx-auto" />
                  <span className="text-[10px] text-dracula-gray uppercase font-bold leading-tight">Más Acertado</span>
                  <span className="text-xs font-bold text-dracula-light">@{previewData.mostBetsWon.name}</span>
                  <span className="text-[10px] text-dracula-yellow bg-dracula-base rounded py-0.5">{previewData.mostBetsWon.count} Plenos</span>
                </div>
              )}
              {previewData.mostMissions && (
                <div className="flex flex-col gap-1.5 bg-dracula-card p-3 rounded-xl border border-dracula-gray/20 text-center">
                  <Target size={16} className="text-dracula-green mx-auto" />
                  <span className="text-[10px] text-dracula-gray uppercase font-bold leading-tight">Más Misiones</span>
                  <span className="text-xs font-bold text-dracula-light">@{previewData.mostMissions.name}</span>
                  <span className="text-[10px] text-dracula-green bg-dracula-base rounded py-0.5">{previewData.mostMissions.count} Completadas</span>
                </div>
              )}
            </div>
          )}

          {/* 5. Duelos */}
          {previewData.duelWinner && (
            <div className="flex items-center gap-3 bg-dracula-card p-3 rounded-xl border border-dracula-gray/20">
              <div className="bg-dracula-red/10 p-2 rounded-lg text-dracula-red">
                <Swords size={18} />
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-[10px] text-dracula-gray uppercase font-bold">Destrozó en un Duelo</span>
                <span className="text-sm font-bold text-dracula-light">
                  @{previewData.duelWinner.name} <span className="text-xs text-dracula-gray font-normal">vs @{previewData.duelWinner.opponent}</span>
                </span>
              </div>
            </div>
          )}

          {/* 6. Economía (Mayor Ganador / Perdedor) */}
          {(previewData.biggestWinner || previewData.biggestLoser) && (
            <div className="flex gap-3 bg-dracula-card p-3 rounded-xl border border-dracula-gray/20">
              {previewData.biggestWinner && (
                <div className="flex-1 flex flex-col items-center justify-center border-r border-dracula-gray/20 pr-2">
                  <span className="text-[10px] text-dracula-gray uppercase font-bold mb-1">Se Forró</span>
                  <span className="text-xs font-bold text-dracula-light">@{previewData.biggestWinner.name}</span>
                  <span className="text-xs font-black text-dracula-green flex items-center gap-1 mt-0.5">
                    <TrendingUp size={12} /> {previewData.biggestWinner.amount}
                  </span>
                </div>
              )}
              {previewData.biggestLoser && (
                <div className="flex-1 flex flex-col items-center justify-center pl-2">
                  <span className="text-[10px] text-dracula-gray uppercase font-bold mb-1">Se Arruinó</span>
                  <span className="text-xs font-bold text-dracula-light">@{previewData.biggestLoser.name}</span>
                  <span className="text-xs font-black text-dracula-red flex items-center gap-1 mt-0.5">
                    <TrendingDown size={12} /> {previewData.biggestLoser.amount}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- PIE: BOTÓN DE CIERRE --- */}
        <div className="p-4 border-t border-dracula-gray/20 bg-dracula-base z-10">
          <button
            onClick={handleClose}
            className="w-full py-3.5 bg-dracula-purple text-dracula-base text-sm font-black uppercase tracking-widest rounded-xl shadow-[0_4px_0_rgba(139,233,253,0.5)] active:shadow-[0_0px_0_rgba(139,233,253,0.5)] active:translate-y-1 transition-all flex items-center justify-center gap-2"
          >
            ¡A por la siguiente noche! <X size={18} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}
