'use client';

import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <main className="text-dracula-light flex min-h-screen flex-col items-center justify-center bg-black p-6 text-center">
      <div className="bg-dracula-card border-dracula-purple/20 animate-fadeIn flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border p-8 shadow-2xl">
        <div className="bg-dracula-purple/10 text-dracula-purple rounded-full p-4">
          <WifiOff size={48} />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-dracula-light text-2xl font-black tracking-wider uppercase">
            Sin Conexión a Internet
          </h1>
          <p className="text-dracula-gray text-xs leading-relaxed">
            Parece que te has quedado sin cobertura o datos móviles. Comprueba
            tu conexión para seguir disfrutando de las misiones, retos y
            quinielas de QuestFest.
          </p>
        </div>

        <button
          onClick={handleReload}
          className="bg-dracula-purple text-dracula-base flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all hover:opacity-90"
        >
          <RefreshCw size={16} /> Reintentar Conexión
        </button>
      </div>
    </main>
  );
}
