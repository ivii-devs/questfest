'use client';

import React from 'react';
import { Moon, Sun, Laptop, Palette, Sparkles, Check } from 'lucide-react';
import { useTheme, ColorPalette } from '@/context/ThemeContext';

/**
 * Catálogo descriptivo de las Paletas Dinámicas (Multisección).
 * Cada paleta asigna una identidad cromática única a los paneles clave:
 * Feed (Social), Apuestas (Juego), Misiones (Progreso) y Duelos (Combate).
 */
const DYNAMIC_PALETTES: {
  id: ColorPalette;
  name: string;
  previewColors: string[];
}[] = [
  {
    id: 'default',
    name: 'QuestFest Clásico',
    previewColors: ['#bd93f9', '#f1fa8c', '#50fa7b', '#ff5555'],
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neón',
    previewColors: ['#d946ef', '#facc15', '#22c55e', '#f43f5e'],
  },
  {
    id: 'sunset',
    name: 'Sunset Atardecer',
    previewColors: ['#6366f1', '#f59e0b', '#10b981', '#ea580c'],
  },
  {
    id: 'pastel',
    name: 'Retro Pastel',
    previewColors: ['#c084fc', '#fde047', '#86efac', '#fda4af'],
  },
];

/**
 * Catálogo descriptivo de las Paletas Monocromáticas (Minimal Accent).
 * Unifican el color de acento en toda la aplicación para una experiencia más sobria y homogénea.
 */
const MONO_PALETTES: {
  id: ColorPalette;
  name: string;
  color: string;
}[] = [
  { id: 'mono-amethyst', name: 'Amatista', color: '#a855f7' },
  { id: 'mono-sapphire', name: 'Zafiro', color: '#38bdf8' },
  { id: 'mono-emerald', name: 'Esmeralda', color: '#34d399' },
  { id: 'mono-gold', name: 'Oro Real', color: '#fbbf24' },
  { id: 'mono-crimson', name: 'Carmesí', color: '#f87171' },
];

/**
 * Tarjeta de Control de Tema y Paleta Cromática.
 *
 * Permite al usuario seleccionar:
 * 1. El modo de iluminación (Oscuro, Claro o Automático del Sistema).
 * 2. La paleta cromática bajo el Modelo Híbrido (Multisección o Monocromática).
 *
 * Todo el componente emplea respuestas hápticas visuales elásticas (.btn-press)
 * y respeta las variables de diseño de QuestFest.
 */
export default function ThemeSettingsCard() {
  const { mode, palette, setMode, setPalette } = useTheme();

  return (
    <div className="bg-dracula-card border-dracula-gray/20 space-y-6 rounded-2xl border p-4 shadow-xl sm:p-5">
      {/* Cabecera del bloque de Apariencia */}
      <div className="flex items-center gap-3">
        <div className="bg-dracula-purple/10 text-dracula-purple rounded-xl p-2.5">
          <Palette size={22} />
        </div>
        <div>
          <h3 className="text-dracula-light text-base leading-snug font-bold">
            Apariencia y Tema
          </h3>
          <p className="text-dracula-gray text-xs">
            Personaliza el modo de luz y la paleta cromática de QuestFest
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECCIÓN 1: SELECTOR DE MODO (SEGMENTED CONTROL)          */}
      {/* ======================================================== */}
      <div className="space-y-2">
        <label className="text-dracula-gray block text-[11px] font-bold tracking-wider uppercase">
          Modo de Iluminación
        </label>
        <div className="bg-dracula-base/70 border-dracula-gray/20 grid grid-cols-3 gap-2 rounded-xl border p-1.5">
          {/* Opción Oscuro */}
          <button
            type="button"
            onClick={() => setMode('dark')}
            className={`btn-press flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 select-none ${
              mode === 'dark'
                ? 'bg-dracula-card text-dracula-purple border-dracula-purple/30 border shadow-md'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            <Moon size={15} />
            <span>Oscuro</span>
          </button>

          {/* Opción Claro */}
          <button
            type="button"
            onClick={() => setMode('light')}
            className={`btn-press flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 select-none ${
              mode === 'light'
                ? 'bg-dracula-card text-dracula-yellow border-dracula-yellow/30 border shadow-md'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            <Sun size={15} />
            <span>Claro</span>
          </button>

          {/* Opción Sistema */}
          <button
            type="button"
            onClick={() => setMode('system')}
            className={`btn-press flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 select-none ${
              mode === 'system'
                ? 'bg-dracula-card text-dracula-cyan border-dracula-cyan/30 border shadow-md'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            <Laptop size={15} />
            <span>Sistema</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECCIÓN 2: PALETAS DINÁMICAS (MULTI-SECCIÓN)             */}
      {/* ======================================================== */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-dracula-gray text-[11px] font-bold tracking-wider uppercase">
            Colección Dinámica
          </label>
          <span className="text-dracula-purple flex items-center gap-1 text-[10px] font-semibold">
            <Sparkles size={11} /> Identidad visual por panel
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {DYNAMIC_PALETTES.map((p) => {
            const isSelected = palette === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPalette(p.id)}
                className={`btn-press relative w-full rounded-xl border p-3 text-left transition-all duration-200 select-none ${
                  isSelected
                    ? 'bg-dracula-base/90 border-dracula-purple ring-dracula-purple/30 shadow-md ring-1'
                    : 'bg-dracula-base/40 border-dracula-gray/20 hover:border-dracula-gray/40'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-dracula-light text-xs font-bold">
                    {p.name}
                  </span>
                  {isSelected && (
                    <span className="bg-dracula-purple text-dracula-base flex h-4 w-4 items-center justify-center rounded-full">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </div>

                {/* 4 puntos representativos: Social, Apuestas, Misiones, Duelos */}
                <div className="border-dracula-gray/10 flex items-center gap-1.5 border-t pt-2">
                  {p.previewColors.map((color, idx) => (
                    <span
                      key={idx}
                      className="h-3.5 w-3.5 rounded-full shadow-inner ring-1 ring-black/20"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <span className="text-dracula-gray ml-1 text-[9px]">
                    Feed • Bets • Quests • Duels
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECCIÓN 3: PALETAS MONOCROMÁTICAS (MINIMAL ACCENT)       */}
      {/* ======================================================== */}
      <div className="border-dracula-gray/15 space-y-2.5 border-t pt-1">
        <label className="text-dracula-gray block text-[11px] font-bold tracking-wider uppercase">
          Colección Monocromática
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {MONO_PALETTES.map((p) => {
            const isSelected = palette === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPalette(p.id)}
                className={`btn-press flex items-center gap-2 rounded-xl border p-2 text-xs font-bold transition-all duration-200 select-none ${
                  isSelected
                    ? 'bg-dracula-base/90 border-dracula-light ring-dracula-light/30 text-dracula-light shadow-md ring-1'
                    : 'bg-dracula-base/40 border-dracula-gray/20 hover:border-dracula-gray/40 text-dracula-gray hover:text-dracula-light'
                }`}
              >
                <span
                  className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-black/20"
                  style={{ backgroundColor: p.color }}
                >
                  {isSelected && (
                    <Check size={10} className="text-white" strokeWidth={3} />
                  )}
                </span>
                <span className="truncate text-[11px]">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
