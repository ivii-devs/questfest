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
    <main className="text-dracula-light flex min-h-screen flex-col items-center justify-center bg-black p-6 text-center">
      <div className="bg-dracula-card border-dracula-red/30 animate-fadeIn flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border p-8 shadow-2xl">
        <div className="bg-dracula-red/10 text-dracula-red rounded-full p-4">
          <AlertTriangle size={48} />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-dracula-light text-xl font-black tracking-wider uppercase">
            Algo no ha salido como esperábamos
          </h1>
          <p className="text-dracula-gray text-xs leading-relaxed">
            Se ha producido un error inesperado al cargar esta sección. No te
            preocupes, tus QuestCoins y datos están a salvo.
          </p>
        </div>

        <button
          onClick={() => reset()}
          className="bg-dracula-red flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all hover:opacity-90"
        >
          <RefreshCw size={16} /> Intentar de nuevo
        </button>
      </div>
    </main>
  );
}
