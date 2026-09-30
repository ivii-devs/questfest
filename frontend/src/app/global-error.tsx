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
      <body className="text-dracula-light flex min-h-screen flex-col items-center justify-center bg-black p-6 text-center">
        <div className="bg-dracula-card border-dracula-red/30 flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border p-8 shadow-2xl">
          <div className="bg-dracula-red/10 text-dracula-red rounded-full p-4">
            <AlertTriangle size={48} />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-dracula-light text-xl font-black tracking-wider uppercase">
              Error Crítico de Aplicación
            </h1>
            <p className="text-dracula-gray text-xs leading-relaxed">
              Ocurrió un error global en la plataforma QuestFest. Por favor,
              reinicia la aplicación.
            </p>
          </div>

          <button
            onClick={() => reset()}
            className="bg-dracula-red flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all hover:opacity-90"
          >
            <RefreshCw size={16} /> Reiniciar Aplicación
          </button>
        </div>
      </body>
    </html>
  );
}
