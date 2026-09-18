'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error capturado por React Error Boundary:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-black text-dracula-light flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-dracula-card p-8 rounded-2xl border border-dracula-red/30 shadow-2xl max-w-md w-full flex flex-col items-center gap-6 animate-fadeIn">
        <div className="p-4 bg-dracula-red/10 text-dracula-red rounded-full">
          <AlertTriangle size={48} />
        </div>
        
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-black uppercase tracking-wider text-dracula-light">
            Algo no ha salido como esperábamos
          </h1>
          <p className="text-xs text-dracula-gray leading-relaxed">
            Se ha producido un error inesperado al cargar esta sección. No te preocupes, tus QuestCoins y datos están a salvo.
          </p>
        </div>

        <button
          onClick={() => reset()}
          className="w-full bg-dracula-red text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <RefreshCw size={16} /> Intentar de nuevo
        </button>
      </div>
    </main>
  );
}
