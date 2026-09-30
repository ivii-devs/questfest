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

import { useState } from 'react';
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
  previewData?: DailySummaryData | null;
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
    <div className="animate-fadeIn fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="bg-dracula-base border-dracula-purple scale-in-center relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border-2 shadow-[0_0_30px_rgba(189,147,249,0.2)]">
        {/* Confeti estético de fondo (Simulado con gradientes) */}
        <div className="from-dracula-purple/20 pointer-events-none absolute top-0 left-0 h-32 w-full bg-gradient-to-b to-transparent" />

        {/* --- CABECERA --- */}
        <div className="border-dracula-gray/20 relative z-10 border-b p-5 text-center">
          <div className="bg-dracula-purple/20 text-dracula-purple mx-auto mb-3 flex h-14 w-14 animate-pulse items-center justify-center rounded-full shadow-[0_0_15px_rgba(189,147,249,0.4)]">
            <Flame size={28} />
          </div>
          <h2 className="text-dracula-light text-xl font-black tracking-wide uppercase">
            Boletín Informativo
          </h2>
          {previewData.phase && (
            <p className="text-dracula-purple mt-1 text-xs font-bold tracking-widest uppercase">
              Resumen de la {previewData.phase}
            </p>
          )}
        </div>

        {/* --- CUERPO: LAS 6 ESTADÍSTICAS --- */}
        <div className="relative z-10 flex max-h-[50vh] flex-col gap-3 overflow-y-auto p-5">
          {/* 1. Primero en el ranking */}
          {previewData.firstPlace && (
            <div className="bg-dracula-card border-dracula-yellow/20 flex items-center gap-3 rounded-xl border p-3">
              <div className="bg-dracula-yellow/10 text-dracula-yellow rounded-lg p-2">
                <Trophy size={18} />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-dracula-gray text-[10px] font-bold uppercase">
                  Líder Actual
                </span>
                <span className="text-dracula-light text-sm font-bold">
                  @{previewData.firstPlace.name}{' '}
                  <span className="text-dracula-yellow text-xs">
                    ({previewData.firstPlace.points} QC)
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* 2. Último en el ranking */}
          {previewData.lastPlace && (
            <div className="bg-dracula-card border-dracula-red/20 flex items-center gap-3 rounded-xl border p-3">
              <div className="bg-dracula-red/10 text-dracula-red rounded-lg p-2">
                <TrendingDown size={18} />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-dracula-gray text-[10px] font-bold uppercase">
                  Farolillo Rojo
                </span>
                <span className="text-dracula-light text-sm font-bold">
                  @{previewData.lastPlace.name}{' '}
                  <span className="text-dracula-red text-xs">
                    ({previewData.lastPlace.points} QC)
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* 3 & 4. Apuestas y Misiones */}
          {(previewData.mostBetsWon || previewData.mostMissions) && (
            <div className="grid grid-cols-2 gap-3">
              {previewData.mostBetsWon && (
                <div className="bg-dracula-card border-dracula-gray/20 flex flex-col gap-1.5 rounded-xl border p-3 text-center">
                  <Dice5 size={16} className="text-dracula-yellow mx-auto" />
                  <span className="text-dracula-gray text-[10px] leading-tight font-bold uppercase">
                    Más Acertado
                  </span>
                  <span className="text-dracula-light text-xs font-bold">
                    @{previewData.mostBetsWon.name}
                  </span>
                  <span className="text-dracula-yellow bg-dracula-base rounded py-0.5 text-[10px]">
                    {previewData.mostBetsWon.count} Plenos
                  </span>
                </div>
              )}
              {previewData.mostMissions && (
                <div className="bg-dracula-card border-dracula-gray/20 flex flex-col gap-1.5 rounded-xl border p-3 text-center">
                  <Target size={16} className="text-dracula-green mx-auto" />
                  <span className="text-dracula-gray text-[10px] leading-tight font-bold uppercase">
                    Más Misiones
                  </span>
                  <span className="text-dracula-light text-xs font-bold">
                    @{previewData.mostMissions.name}
                  </span>
                  <span className="text-dracula-green bg-dracula-base rounded py-0.5 text-[10px]">
                    {previewData.mostMissions.count} Completadas
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 5. Duelos */}
          {previewData.duelWinner && (
            <div className="bg-dracula-card border-dracula-gray/20 flex items-center gap-3 rounded-xl border p-3">
              <div className="bg-dracula-red/10 text-dracula-red rounded-lg p-2">
                <Swords size={18} />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-dracula-gray text-[10px] font-bold uppercase">
                  Destrozó en un Duelo
                </span>
                <span className="text-dracula-light text-sm font-bold">
                  @{previewData.duelWinner.name}{' '}
                  <span className="text-dracula-gray text-xs font-normal">
                    vs @{previewData.duelWinner.opponent}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* 6. Economía (Mayor Ganador / Perdedor) */}
          {(previewData.biggestWinner || previewData.biggestLoser) && (
            <div className="bg-dracula-card border-dracula-gray/20 flex gap-3 rounded-xl border p-3">
              {previewData.biggestWinner && (
                <div className="border-dracula-gray/20 flex flex-1 flex-col items-center justify-center border-r pr-2">
                  <span className="text-dracula-gray mb-1 text-[10px] font-bold uppercase">
                    Se Forró
                  </span>
                  <span className="text-dracula-light text-xs font-bold">
                    @{previewData.biggestWinner.name}
                  </span>
                  <span className="text-dracula-green mt-0.5 flex items-center gap-1 text-xs font-black">
                    <TrendingUp size={12} /> {previewData.biggestWinner.amount}
                  </span>
                </div>
              )}
              {previewData.biggestLoser && (
                <div className="flex flex-1 flex-col items-center justify-center pl-2">
                  <span className="text-dracula-gray mb-1 text-[10px] font-bold uppercase">
                    Se Arruinó
                  </span>
                  <span className="text-dracula-light text-xs font-bold">
                    @{previewData.biggestLoser.name}
                  </span>
                  <span className="text-dracula-red mt-0.5 flex items-center gap-1 text-xs font-black">
                    <TrendingDown size={12} /> {previewData.biggestLoser.amount}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- PIE: BOTÓN DE CIERRE --- */}
        <div className="border-dracula-gray/20 bg-dracula-base z-10 border-t p-4">
          <button
            onClick={handleClose}
            className="bg-dracula-purple text-dracula-base flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black tracking-widest uppercase shadow-[0_4px_0_rgba(139,233,253,0.5)] transition-all active:translate-y-1 active:shadow-[0_0px_0_rgba(139,233,253,0.5)]"
          >
            ¡A por la siguiente noche! <X size={18} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}
