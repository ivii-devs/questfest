'use client';

/**
 * ============================================================================
 * PESTAÑA DEL TRIBUNAL DE DUELOS (TabDuelos)
 * ============================================================================
 * Permite a los administradores arbitrar y resolver duelos en conflicto:
 * - Declarar ganador al retador o al retado.
 * - Declarar empate / anular el reto con reembolso de tokens.
 * - Aplicar sanciones y multas en QuestCoins por conducta antideportiva.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { Trophy, Scale } from 'lucide-react';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import { useGroup } from '@/context/GroupContext';

interface AdminDuelItem {
  id: number;
  challenger: string;
  challenged: string;
  wager: number;
  game: string;
  status: string;
  reported_resolution?: string | null;
}

export default function TabDuelos() {
  const { activeGroup } = useGroup();
  const [duels, setDuels] = useState<AdminDuelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [penalizeAmounts, setPenalizeAmounts] = useState<
    Record<number, number | ''>
  >({});
  const [motivoMultas, setMotivoMultas] = useState<Record<number, string>>({});

  const fetchDuels = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<AdminDuelItem[]>('/api/admin/duels', {
        params: activeGroup?.id ? { group_id: activeGroup.id } : {},
      });
      setDuels(res.data || []);
    } catch {
      toast.error('Error al cargar duelos');
    } finally {
      setLoading(false);
    }
  }, [activeGroup]);

  useEffect(() => {
    fetchDuels();
  }, [fetchDuels]);

  const resolveDuel = async (
    duelId: number,
    resolution: 'challenger' | 'challenged' | 'draw',
    penalize: string = 'none',
    penalizeAmount: number = 0,
    motivoMulta: string = ''
  ) => {
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
      motivo_multa: motivoMulta,
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

  const pendingDuels = duels.filter(
    (d) =>
      d.status === 'validation_winner' ||
      d.status === 'validation_rejected' ||
      d.status === 'accepted'
  );

  if (loading) {
    return (
      <div className="text-dracula-gray p-8 text-center">
        Cargando duelos...
      </div>
    );
  }

  return (
    <div className="animate-fadeIn p-4">
      <h2 className="text-dracula-light mb-6 flex items-center gap-2 text-xl font-bold">
        <Scale className="text-[#8be9fd]" /> Tribunal de Duelos
      </h2>

      {pendingDuels.length === 0 ? (
        <div className="border-dracula-gray/20 bg-dracula-card/50 rounded-xl border p-8 text-center">
          <p className="text-dracula-gray">
            No hay duelos pendientes de resolución.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingDuels.map((duel) => (
            <article
              key={duel.id}
              className="bg-dracula-card border-dracula-gray/20 relative overflow-hidden rounded-xl border p-4"
            >
              <div className="bg-dracula-base/80 border-dracula-gray/20 absolute top-0 right-0 flex items-center gap-1 rounded-bl-xl border-b border-l px-3 py-1 text-[10px] font-bold uppercase">
                <span
                  className={
                    duel.status === 'validation_winner'
                      ? 'text-dracula-green'
                      : duel.status === 'validation_rejected'
                        ? 'text-dracula-red'
                        : 'text-dracula-yellow'
                  }
                >
                  {duel.status === 'validation_winner'
                    ? 'Validar Ganador'
                    : duel.status === 'validation_rejected'
                      ? 'Validar Rechazo'
                      : 'En Curso'}
                </span>
              </div>

              <div className="mt-2 mb-4 flex items-center justify-between">
                <div className="flex-1 text-center">
                  <div className="text-dracula-purple text-sm font-bold">
                    {duel.challenger}
                  </div>
                  <div className="text-dracula-gray text-[10px] uppercase">
                    Retador
                  </div>
                </div>
                <div className="px-4 text-center">
                  <div className="text-dracula-red font-black italic">VS</div>
                  <div className="text-dracula-yellow bg-dracula-base border-dracula-yellow/20 mt-1 rounded border px-2 py-1 text-xs font-bold">
                    💰 {duel.wager}
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-dracula-light text-sm font-bold">
                    {duel.challenged}
                  </div>
                  <div className="text-dracula-gray text-[10px] uppercase">
                    Retado
                  </div>
                </div>
              </div>

              <div className="bg-dracula-base text-dracula-light border-dracula-gray/20 mb-4 rounded-lg border p-3 text-center text-sm">
                <span className="text-dracula-gray mb-1 block text-[10px] font-bold uppercase">
                  El Reto
                </span>
                {duel.game}
              </div>

              {duel.reported_resolution && (
                <div className="text-dracula-yellow bg-dracula-yellow/10 border-dracula-yellow/20 mb-4 rounded-lg border p-2 text-center text-xs font-semibold">
                  {(() => {
                    if (duel.reported_resolution.includes(':')) {
                      const [reporter, outcome] =
                        duel.reported_resolution.split(':');
                      const reporterName =
                        reporter === 'challenger'
                          ? duel.challenger
                          : duel.challenged;
                      const outcomeText =
                        outcome === 'draw'
                          ? 'Empate'
                          : outcome === 'challenger'
                            ? duel.challenger
                            : duel.challenged;
                      return (
                        <>
                          El jugador{' '}
                          <span className="mx-1 font-black text-[#8be9fd]">
                            {reporterName}
                          </span>{' '}
                          reporta:{' '}
                          <span className="ml-1 font-bold">{outcomeText}</span>
                        </>
                      );
                    }
                    return duel.reported_resolution === 'draw' ? (
                      'El jugador reporta un Empate'
                    ) : (
                      <>
                        El jugador reporta victoria de:{' '}
                        <span className="ml-1 text-sm font-black text-[#8be9fd]">
                          {duel.reported_resolution === 'challenger'
                            ? duel.challenger
                            : duel.challenged}
                        </span>
                      </>
                    );
                  })()}
                </div>
              )}

              {duel.status === 'validation_rejected' && (
                <div className="text-dracula-red bg-dracula-red/10 border-dracula-red/20 mb-4 rounded-lg border p-2 text-center text-xs font-semibold">
                  El jugador retado ha rechazado este duelo por ser imposible o
                  por cobardía.
                </div>
              )}

              <div className="border-dracula-gray/20 mt-4 flex flex-col gap-2 border-t pt-4">
                <div className="mb-2 flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-dracula-gray mb-1 block text-center text-[10px] font-bold tracking-widest uppercase">
                        Multa (Tokens)
                      </label>
                      <TokenAmountInput
                        placeholder="0"
                        min={1}
                        value={penalizeAmounts[duel.id] ?? ''}
                        onChange={(val) =>
                          setPenalizeAmounts({
                            ...penalizeAmounts,
                            [duel.id]: val,
                          })
                        }
                        className="bg-dracula-base text-dracula-red border-dracula-gray/20 focus:border-dracula-red w-full rounded-lg border py-2 pr-2 pl-9 text-sm font-bold focus:outline-none"
                      />
                    </div>
                    <div className="flex-[2]">
                      <label className="text-dracula-gray mb-1 block text-center text-[10px] font-bold tracking-widest uppercase">
                        Motivo Multa
                      </label>
                      <input
                        type="text"
                        placeholder="Motivo de la penalización"
                        value={motivoMultas[duel.id] ?? ''}
                        onChange={(e) =>
                          setMotivoMultas({
                            ...motivoMultas,
                            [duel.id]: e.target.value,
                          })
                        }
                        className="bg-dracula-base text-dracula-light border-dracula-gray/20 focus:border-dracula-red w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() =>
                        resolveDuel(
                          duel.id,
                          'draw',
                          'challenger',
                          Number(penalizeAmounts[duel.id] || 0),
                          motivoMultas[duel.id] || ''
                        )
                      }
                      className="bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border-dracula-red/30 flex-1 rounded-lg border py-2 text-xs font-bold transition-colors"
                    >
                      Multar al Retador
                    </button>
                    <button
                      onClick={() =>
                        resolveDuel(
                          duel.id,
                          'draw',
                          'challenged',
                          Number(penalizeAmounts[duel.id] || 0),
                          motivoMultas[duel.id] || ''
                        )
                      }
                      className="bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border-dracula-red/30 flex-1 rounded-lg border py-2 text-xs font-bold transition-colors"
                    >
                      Multar al Retado
                    </button>
                  </div>
                </div>

                {duel.status === 'validation_rejected' ? (
                  <button
                    onClick={() => resolveDuel(duel.id, 'draw', 'none', 0)}
                    className="bg-dracula-gray/10 hover:bg-dracula-gray/20 text-dracula-light border-dracula-gray/20 w-full rounded-lg border py-2 text-xs font-bold transition-colors"
                  >
                    Aceptar Rechazo (Anular)
                  </button>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolveDuel(duel.id, 'challenger')}
                        className="bg-dracula-purple/20 hover:bg-dracula-purple/30 text-dracula-purple border-dracula-purple/30 flex flex-1 items-center justify-center gap-1 rounded-lg border py-2 text-xs font-bold transition-colors"
                      >
                        <Trophy size={14} /> Gana {duel.challenger}
                      </button>
                      <button
                        onClick={() => resolveDuel(duel.id, 'challenged')}
                        className="bg-dracula-green/20 hover:bg-dracula-green/30 text-dracula-green border-dracula-green/30 flex flex-1 items-center justify-center gap-1 rounded-lg border py-2 text-xs font-bold transition-colors"
                      >
                        <Trophy size={14} /> Gana {duel.challenged}
                      </button>
                    </div>
                    <button
                      onClick={() => resolveDuel(duel.id, 'draw')}
                      className="bg-dracula-gray/10 hover:bg-dracula-gray/20 text-dracula-light border-dracula-gray/20 w-full rounded-lg border py-2 text-xs font-bold transition-colors"
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
