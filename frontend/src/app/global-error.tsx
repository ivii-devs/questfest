'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  reset,
}: {
  error?: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="bg-black text-dracula-light min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-dracula-card p-8 rounded-2xl border border-dracula-red/30 shadow-2xl max-w-md w-full flex flex-col items-center gap-6">
          <div className="p-4 bg-dracula-red/10 text-dracula-red rounded-full">
            <AlertTriangle size={48} />
          </div>
          
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-black uppercase tracking-wider text-dracula-light">
              Error Crítico de Aplicación
            </h1>
            <p className="text-xs text-dracula-gray leading-relaxed">
              Ocurrió un error global en la plataforma QuestFest. Por favor, reinicia la aplicación.
            </p>
          </div>

          <button
            onClick={() => reset()}
            className="w-full bg-dracula-red text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw size={16} /> Reiniciar Aplicación
          </button>
        </div>
      </body>
    </html>
  );
}
