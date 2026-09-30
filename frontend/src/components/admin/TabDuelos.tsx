'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { Trophy, Scale } from 'lucide-react';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import { useGroup } from '@/context/GroupContext';

export default function TabDuelos() {
  const { activeGroup } = useGroup();
  const [duels, setDuels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [penalizeAmounts, setPenalizeAmounts] = useState<Record<number, number | ''>>({});
  const [motivoMultas, setMotivoMultas] = useState<Record<number, string>>({});

  const fetchDuels = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/admin/duels', {
        params: activeGroup?.id ? { group_id: activeGroup.id } : {}
      });
      setDuels(res.data);
    } catch {
      toast.error('Error al cargar duelos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuels();
  }, [activeGroup?.id]);

  const resolveDuel = async (duelId: number, resolution: 'challenger' | 'challenged' | 'draw', penalize: string = 'none', penalizeAmount: number = 0, motivoMulta: string = '') => {
    if (penalize !== 'none') {
      if (penalizeAmount <= 0 || !motivoMulta.trim()) {
        toast.error('Debes indicar un importe y un concepto para la multa');
        return;
      }
    }

    const action = api.patch(`/api/admin/duels/${duelId}/resolve`, { 
      resolution, 
      penalize,
      penalize_amount: penalizeAmount,
      motivo_multa: motivoMulta
    });

    toast.promise(action, {
      loading: 'Resolviendo duelo...',
      success: () => {
        fetchDuels();
        return 'Duelo resuelto correctamente';
      },
      error: 'Error al resolver el duelo',
    });
  };

  const pendingDuels = duels.filter(d => 
    d.status === 'validation_winner' || d.status === 'validation_rejected' || d.status === 'accepted'
  );

  if (loading) {
    return <div className="text-center p-8 text-dracula-gray">Cargando duelos...</div>;
  }

  return (
    <div className="p-4 animate-fadeIn">
      <h2 className="text-xl font-bold text-dracula-light mb-6 flex items-center gap-2">
        <Scale className="text-[#8be9fd]" /> Tribunal de Duelos
      </h2>

      {pendingDuels.length === 0 ? (
        <div className="text-center p-8 border border-dracula-gray/20 rounded-xl bg-dracula-card/50">
          <p className="text-dracula-gray">No hay duelos pendientes de resolución.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingDuels.map(duel => (
            <article key={duel.id} className="bg-dracula-card rounded-xl p-4 border border-dracula-gray/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-dracula-base/80 px-3 py-1 rounded-bl-xl text-[10px] font-bold border-l border-b border-dracula-gray/20 flex items-center gap-1 uppercase">
                <span className={duel.status === 'validation_winner' ? 'text-dracula-green' : duel.status === 'validation_rejected' ? 'text-dracula-red' : 'text-dracula-yellow'}>
                  {duel.status === 'validation_winner' ? 'Validar Ganador' : duel.status === 'validation_rejected' ? 'Validar Rechazo' : 'En Curso'}
                </span>
              </div>

              <div className="flex justify-between items-center mb-4 mt-2">
                <div className="text-center flex-1">
                  <div className="text-sm font-bold text-dracula-purple">{duel.challenger}</div>
                  <div className="text-[10px] text-dracula-gray uppercase">Retador</div>
                </div>
                <div className="px-4 text-center">
                  <div className="text-dracula-red font-black italic">VS</div>
                  <div className="text-xs font-bold text-dracula-yellow bg-dracula-base px-2 py-1 rounded mt-1 border border-dracula-yellow/20">
                    💰 {duel.wager}
                  </div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-sm font-bold text-dracula-light">{duel.challenged}</div>
                  <div className="text-[10px] text-dracula-gray uppercase">Retado</div>
                </div>
              </div>

              <div className="bg-dracula-base p-3 rounded-lg text-center text-sm text-dracula-light mb-4 border border-dracula-gray/20">
                <span className="block text-[10px] text-dracula-gray uppercase font-bold mb-1">El Reto</span>
                {duel.game}
              </div>

              {duel.reported_resolution && (
                <div className="mb-4 text-center text-xs font-semibold text-dracula-yellow bg-dracula-yellow/10 p-2 rounded-lg border border-dracula-yellow/20">
                  {(() => {
                    if (duel.reported_resolution.includes(':')) {
                      const [reporter, outcome] = duel.reported_resolution.split(':');
                      const reporterName = reporter === 'challenger' ? duel.challenger : duel.challenged;
                      const outcomeText = outcome === 'draw' ? 'Empate' : outcome === 'challenger' ? duel.challenger : duel.challenged;
                      return <>El jugador <span className="font-black text-[#8be9fd] mx-1">{reporterName}</span> reporta: <span className="font-bold ml-1">{outcomeText}</span></>;
                    }
                    return duel.reported_resolution === 'draw' ? (
                      'El jugador reporta un Empate'
                    ) : (
                      <>
                        El jugador reporta victoria de: <span className="font-black text-[#8be9fd] text-sm ml-1">{duel.reported_resolution === 'challenger' ? duel.challenger : duel.challenged}</span>
                      </>
                    );
                  })()}
                </div>
              )}

              {duel.status === 'validation_rejected' && (
                <div className="mb-4 text-center text-xs font-semibold text-dracula-red bg-dracula-red/10 p-2 rounded-lg border border-dracula-red/20">
                  El jugador retado ha rechazado este duelo por ser imposible o por cobardía.
                </div>
              )}

              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-dracula-gray/20">
                <div className="flex flex-col gap-1.5 mb-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest block text-center mb-1">
                        Multa (Tokens)
                      </label>
                      <TokenAmountInput 
                        placeholder="0" 
                        min={1}
                        value={penalizeAmounts[duel.id] ?? ''}
                        onChange={(val) => setPenalizeAmounts({...penalizeAmounts, [duel.id]: val})}
                        className="w-full bg-dracula-base rounded-lg py-2 pl-9 pr-2 text-sm font-bold text-dracula-red border border-dracula-gray/20 focus:outline-none focus:border-dracula-red"
                      />
                    </div>
                    <div className="flex-[2]">
                      <label className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest block text-center mb-1">
                        Motivo Multa
                      </label>
                      <input 
                        type="text" 
                        placeholder="Motivo de la penalización" 
                        value={motivoMultas[duel.id] ?? ''}
                        onChange={(e) => setMotivoMultas({...motivoMultas, [duel.id]: e.target.value})}
                        className="w-full bg-dracula-base rounded-lg py-2 px-3 text-sm text-dracula-light border border-dracula-gray/20 focus:outline-none focus:border-dracula-red"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button 
                      onClick={() => resolveDuel(duel.id, 'draw', 'challenger', Number(penalizeAmounts[duel.id] || 0), motivoMultas[duel.id] || '')}
                      className="flex-1 py-2 bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border border-dracula-red/30 rounded-lg text-xs font-bold transition-colors"
                    >
                      Multar al Retador
                    </button>
                    <button 
                      onClick={() => resolveDuel(duel.id, 'draw', 'challenged', Number(penalizeAmounts[duel.id] || 0), motivoMultas[duel.id] || '')}
                      className="flex-1 py-2 bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border border-dracula-red/30 rounded-lg text-xs font-bold transition-colors"
                    >
                      Multar al Retado
                    </button>
                  </div>
                </div>

                {duel.status === 'validation_rejected' ? (
                  <button 
                    onClick={() => resolveDuel(duel.id, 'draw', 'none', 0)}
                    className="w-full py-2 bg-dracula-gray/10 hover:bg-dracula-gray/20 text-dracula-light border border-dracula-gray/20 rounded-lg text-xs font-bold transition-colors"
                  >
                    Aceptar Rechazo (Anular)
                  </button>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => resolveDuel(duel.id, 'challenger')}
                        className="flex-1 py-2 bg-dracula-purple/20 hover:bg-dracula-purple/30 text-dracula-purple border border-dracula-purple/30 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        <Trophy size={14} /> Gana {duel.challenger}
                      </button>
                      <button 
                        onClick={() => resolveDuel(duel.id, 'challenged')}
                        className="flex-1 py-2 bg-dracula-green/20 hover:bg-dracula-green/30 text-dracula-green border border-dracula-green/30 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        <Trophy size={14} /> Gana {duel.challenged}
                      </button>
                    </div>
                    <button 
                      onClick={() => resolveDuel(duel.id, 'draw')}
                      className="w-full py-2 bg-dracula-gray/10 hover:bg-dracula-gray/20 text-dracula-light border border-dracula-gray/20 rounded-lg text-xs font-bold transition-colors"
                    >
                      Anular / Empate
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
