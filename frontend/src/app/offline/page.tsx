'use client';

import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <main className="min-h-screen bg-black text-dracula-light flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-dracula-card p-8 rounded-2xl border border-dracula-purple/20 shadow-2xl max-w-md w-full flex flex-col items-center gap-6 animate-fadeIn">
        <div className="p-4 bg-dracula-purple/10 text-dracula-purple rounded-full">
          <WifiOff size={48} />
        </div>
        
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black uppercase tracking-wider text-dracula-light">
            Sin Conexión a Internet
          </h1>
          <p className="text-xs text-dracula-gray leading-relaxed">
            Parece que te has quedado sin cobertura o datos móviles. Comprueba tu conexión para seguir disfrutando de las misiones, retos y quinielas de QuestFest.
          </p>
        </div>

        <button
          onClick={handleReload}
          className="w-full bg-dracula-purple text-dracula-base font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <RefreshCw size={16} /> Reintentar Conexión
        </button>
      </div>
    </main>
  );
}
