'use client';

/**
 * ============================================================================
 * MODAL DE RULETA DIARIA SERVER-DRIVEN: QuestFest PWA
 * ============================================================================
 * Minijuego diario de asignación aleatoria de misiones secretas.
 *
 * Principio de Diseño Seguro:
 * - **Server-Driven RNG**: La petición POST a '/api/ruleta/spin' se dispara primero.
 *   El servidor selecciona la misión y confirma que el jugador no haya tirado hoy.
 * - **Animación Cosmética**: Los nombres rotan en pantalla durante 3 segundos (30 ciclos)
 *   simulando tensión, pero el resultado ya está sellado por la base de datos.
 * - **Persistencia Local**: Tras la confirmación, se guarda la marca `roulette_spun_YYYY-MM-DD`
 *   en localStorage para optimizar la experiencia táctil y evitar avisos repetitivos.
 * ============================================================================
 */

import { useState } from 'react';
import { Dna, X, Sparkles, Target } from 'lucide-react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

// Opciones ficticias para generar la ilusión de ruleta mecánica
const FAKE_OPTIONS = [
  'El Aguador',
  'Cámara Oculta',
  'DJ de Guardia',
  'El Infiltrado',
  'Desafio Estrategico',
  'El Cuentacuentos',
  'Abrazo Sorpresa',
];

export interface RouletteResult {
  id: number | string;
  title: string;
  description: string;
  reward: number;
}

interface RouletteModalProps {
  onClose: () => void;
}

export default function RouletteModal({ onClose }: RouletteModalProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [currentDisplay, setCurrentDisplay] = useState('¿Qué te tocará?');
  const [isAccepting, setIsAccepting] = useState(false);

  /**
   * Ejecuta la tirada diaria.
   * 1. Solicita al backend el resultado con verificación de cuota diaria.
   * 2. Inicia la animación de rotación de texto mientras el usuario espera la revelación.
   */
  const startSpin = async () => {
    setIsSpinning(true);
    let missionData: RouletteResult | null = null;
    try {
      const res = await api.post('/api/ruleta/spin');
      missionData = res.data;
    } catch (error: unknown) {
      setIsSpinning(false);
      const err = error as {
        response?: {
          status?: number;
          data?: { detail?: string | Array<{ msg: string }> };
        };
      };
      const detail = err.response?.data?.detail;
      const errorMsg =
        Array.isArray(detail) && detail.length > 0
          ? detail[0].msg
          : typeof detail === 'string'
            ? detail
            : 'Error al tirar de la ruleta';
      toast.error(errorMsg);

      // Si ya tiró en el día actual, sincronizamos la clave local defensiva
      if (err.response?.status === 400 && errorMsg.includes('Ya has tirado')) {
        const todayStr = new Date().toISOString().split('T')[0];
        localStorage.setItem(`roulette_spun_${todayStr}`, 'true');
      }
      return;
    }

    if (!missionData) return;
    const resolvedData = missionData;

    // 2. Efecto visual de rotación simulada (3 segundos)
    let spins = 0;
    const maxSpins = 30;
    const intervalTime = 100;

    const spinInterval = setInterval(() => {
      const randomTitle =
        FAKE_OPTIONS[Math.floor(Math.random() * FAKE_OPTIONS.length)];
      setCurrentDisplay(randomTitle);
      spins++;

      if (spins >= maxSpins) {
        clearInterval(spinInterval);
        setResult(resolvedData);
        setCurrentDisplay(resolvedData.title);
        setIsSpinning(false);

        // Registro de tirada diaria consumida
        const todayStr = new Date().toISOString().split('T')[0];
        localStorage.setItem(`roulette_spun_${todayStr}`, 'true');
      }
    }, intervalTime);
  };

  /**
   * Confirma la aceptación del reto y lo transfiere formalmente al tablón de misiones del usuario.
   */
  const handleAccept = async () => {
    if (!result || isAccepting) return;
    setIsAccepting(true);
    const toastId = toast.loading('Aceptando misión...');
    try {
      await api.post(`/api/ruleta/accept/${result.id}`);
      toast.success('¡Misión añadida a tu tablón!', { id: toastId });
      onClose();
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { detail?: string | Array<{ msg: string }> } };
      };
      const detail = err.response?.data?.detail;
      const errorMsg =
        Array.isArray(detail) && detail.length > 0
          ? detail[0].msg
          : typeof detail === 'string'
            ? detail
            : 'Error al aceptar';
      toast.error(errorMsg, { id: toastId });
      setIsAccepting(false);
    }
  };

  return (
    <div className="animate-fadeIn fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <div className="bg-dracula-base relative flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border-2 border-[#ffb86c] text-center shadow-[0_0_50px_rgba(255,184,108,0.2)]">
        {/* Decoración superior */}
        <div className="flex flex-col items-center justify-center border-b border-[#ffb86c]/30 bg-[#ffb86c]/20 py-6">
          <div className="text-dracula-base mb-2 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-[#ffb86c] shadow-[0_0_20px_rgba(255,184,108,0.6)]">
            <Dna size={32} />
          </div>
          <h2 className="text-dracula-light text-xl font-black tracking-widest uppercase">
            Ruleta Diaria
          </h2>
        </div>

        {/* Pantalla de la Ruleta */}
        <div className="flex min-h-[220px] flex-col items-center justify-center p-8">
          {result ? (
            <div className="animate-bounceIn flex w-full flex-col items-center">
              <span className="mb-2 text-[10px] font-bold tracking-widest text-[#ffb86c] uppercase">
                Tu misión exclusiva:
              </span>
              <span className="text-dracula-light mb-3 text-2xl leading-tight font-black">
                {result.title}
              </span>

              {/* Nueva caja descriptiva */}
              <div className="bg-dracula-card/60 border-dracula-gray/20 w-full rounded-xl border p-4 shadow-inner">
                <p className="text-dracula-light text-sm leading-relaxed font-medium italic">
                  &ldquo;{result.description}&rdquo;
                </p>
                <div className="text-dracula-yellow bg-dracula-base border-dracula-yellow/20 mt-2 rounded border py-1 text-xs font-bold">
                  Recompensa: 💰 {result.reward} QuestCoins
                </div>
              </div>

              <span className="text-dracula-gray mt-4 max-w-[250px] text-[10px] font-bold tracking-wider uppercase">
                Añadida a tu tablón de misiones.
              </span>
            </div>
          ) : (
            <div
              className={`text-2xl font-black transition-all ${
                isSpinning
                  ? 'scale-110 text-[#ffb86c] blur-[1px]'
                  : 'text-dracula-gray text-xl'
              }`}
            >
              {currentDisplay}
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="border-dracula-gray/20 bg-dracula-card/50 border-t p-5">
          {!result ? (
            <button
              onClick={startSpin}
              disabled={isSpinning}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 font-black tracking-widest uppercase transition-all ${
                isSpinning
                  ? 'bg-dracula-gray/20 text-dracula-gray cursor-not-allowed'
                  : 'text-dracula-base bg-[#ffb86c] shadow-[0_4px_0_rgba(200,140,80,1)] hover:opacity-90 active:translate-y-1 active:shadow-none'
              }`}
            >
              <Sparkles size={20} />{' '}
              {isSpinning ? 'Girando...' : 'Girar Ruleta'}
            </button>
          ) : (
            <button
              onClick={handleAccept}
              disabled={isAccepting}
              className="bg-dracula-green text-dracula-base flex w-full items-center justify-center gap-2 rounded-xl py-4 font-black tracking-widest uppercase shadow-[0_4px_0_rgba(80,200,120,1)] hover:opacity-90 active:translate-y-1 active:shadow-none disabled:opacity-50"
            >
              <Target size={20} />{' '}
              {isAccepting ? 'Aceptando...' : '¡Acepto el Reto!'}
            </button>
          )}
        </div>

        {/* Botón cerrar si se arrepiente antes de tirar */}
        {!isSpinning && !result && (
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-red absolute top-4 right-4 transition-colors"
          >
            <X size={24} />
          </button>
        )}
      </div>
    </div>
  );
}
