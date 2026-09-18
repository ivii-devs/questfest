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
  'El Aguador', 'Cámara Oculta', 'DJ de Guardia', 'El Infiltrado',
  'Rey del Chupito', 'El Cuentacuentos', 'Abrazo Sorpresa'
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
      const err = error as { response?: { status?: number; data?: { detail?: string | Array<{ msg: string }> } } };
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
      const randomTitle = FAKE_OPTIONS[Math.floor(Math.random() * FAKE_OPTIONS.length)];
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
      const err = error as { response?: { data?: { detail?: string | Array<{ msg: string }> } } };
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="bg-dracula-base w-full max-w-sm rounded-3xl shadow-[0_0_50px_rgba(255,184,108,0.2)] border-2 border-[#ffb86c] overflow-hidden flex flex-col relative text-center">
        {/* Decoración superior */}
        <div className="bg-[#ffb86c]/20 py-6 flex flex-col items-center justify-center border-b border-[#ffb86c]/30">
          <div className="w-16 h-16 bg-[#ffb86c] rounded-full flex items-center justify-center text-dracula-base shadow-[0_0_20px_rgba(255,184,108,0.6)] mb-2 animate-pulse">
            <Dna size={32} />
          </div>
          <h2 className="text-xl font-black text-dracula-light uppercase tracking-widest">
            Ruleta Diaria
          </h2>
        </div>

        {/* Pantalla de la Ruleta */}
        <div className="p-8 flex flex-col items-center justify-center min-h-[220px]">
          {result ? (
            <div className="animate-bounceIn flex flex-col items-center w-full">
              <span className="text-[10px] uppercase font-bold text-[#ffb86c] tracking-widest mb-2">
                Tu misión exclusiva:
              </span>
              <span className="text-2xl font-black text-dracula-light leading-tight mb-3">
                {result.title}
              </span>

              {/* Nueva caja descriptiva */}
              <div className="w-full bg-dracula-card/60 p-4 rounded-xl border border-dracula-gray/20 shadow-inner">
                <p className="text-sm text-dracula-light font-medium italic leading-relaxed">
                  "{result.description}"
                </p>
                <div className="mt-2 text-dracula-yellow font-bold text-xs bg-dracula-base border border-dracula-yellow/20 rounded py-1">
                  Recompensa: 💰 {result.reward} QuestCoins
                </div>
              </div>

              <span className="text-[10px] text-dracula-gray mt-4 max-w-[250px] uppercase font-bold tracking-wider">
                Añadida a tu tablón de misiones.
              </span>
            </div>
          ) : (
            <div
              className={`text-2xl font-black transition-all ${
                isSpinning
                  ? 'text-[#ffb86c] scale-110 blur-[1px]'
                  : 'text-dracula-gray text-xl'
              }`}
            >
              {currentDisplay}
            </div>
          )}
        </div>

        {/* Controles */}
        <div className="p-5 border-t border-dracula-gray/20 bg-dracula-card/50">
          {!result ? (
            <button
              onClick={startSpin}
              disabled={isSpinning}
              className={`w-full py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                isSpinning
                  ? 'bg-dracula-gray/20 text-dracula-gray cursor-not-allowed'
                  : 'bg-[#ffb86c] text-dracula-base hover:opacity-90 shadow-[0_4px_0_rgba(200,140,80,1)] active:shadow-none active:translate-y-1'
              }`}
            >
              <Sparkles size={20} />{' '}
              {isSpinning ? 'Girando...' : 'Girar Ruleta'}
            </button>
          ) : (
            <button
              onClick={handleAccept}
              disabled={isAccepting}
              className="w-full py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 bg-dracula-green text-dracula-base hover:opacity-90 shadow-[0_4px_0_rgba(80,200,120,1)] active:shadow-none active:translate-y-1 disabled:opacity-50"
            >
              <Target size={20} /> {isAccepting ? 'Aceptando...' : '¡Acepto el Reto!'}
            </button>
          )}
        </div>

        {/* Botón cerrar si se arrepiente antes de tirar */}
        {!isSpinning && !result && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-dracula-gray hover:text-dracula-red transition-colors"
          >
            <X size={24} />
          </button>
        )}
      </div>
    </div>
  );
}
