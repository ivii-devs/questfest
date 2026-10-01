'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart2,
  Trophy,
  Target,
  Dice5,
  Swords,
  TrendingUp,
  TrendingDown,
  History,
  Clock,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import PullToRefresh from '@/components/PullToRefresh';
import { formatSpanishDate } from '@/lib/formatters';
import Link from 'next/link';

/**
 * Página de Estadísticas e Historial aislada por Grupo (/stats).
 *
 * Cumple con el requisito arquitectónico del proyecto:
 * En cada grupo, un miembro cuenta con esta pestaña dedicada para consultar
 * su resumen de actividad y su historial de transacciones (Ledger de doble partida),
 * garantizando que las estadísticas y la economía de QuestCoins no se mezclen entre grupos.
 */
interface TransactionItem {
  id: number | string;
  type: string;
  amount: number;
  concept: string;
  date: string;
  balance?: number;
}

export default function GroupStatsPage() {
  const { user } = useAuth();
  const { activeGroup } = useGroup();

  const [activeTab, setActiveTab] = useState<'resumen' | 'historial'>(
    'resumen'
  );
  const [isLoading, setIsLoading] = useState(true);

  const [stats, setStats] = useState({
    missionsCompleted: 0,
    betsWon: 0,
    duelsWon: 0,
    betsActive: 0,
    betsLost: 0,
    tokensActive: 0,
    tokensWon: 0,
    tokensLost: 0,
    duelsLost: 0,
    duelsActive: 0,
  });
  const [ranking, setRanking] = useState<number>(0);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  /**
   * Carga las estadísticas y transacciones del usuario filtradas estrictamente
   * por el ID del grupo activo mediante el parámetro de consulta ?group_id.
   */
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const params = activeGroup ? { group_id: activeGroup.id } : {};

      const [statsRes, rankRes, txRes] = await Promise.all([
        api.get('/api/auth/me/stats', { params }),
        api.get('/api/auth/me/ranking', { params }),
        api.get('/api/auth/me/transactions', { params }),
      ]);

      setStats(statsRes.data);
      setRanking(rankRes.data.rankingPosition || 0);
      setTransactions(txRes.data || []);
    } catch (error) {
      console.error('[GroupStatsPage] Error al cargar estadísticas:', error);
      toast.error('Error al cargar datos del grupo');
    } finally {
      setIsLoading(false);
    }
  }, [user, activeGroup]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!activeGroup) {
    return (
      <div className="app-shell-page text-dracula-light flex flex-col items-center justify-center bg-black p-6 text-center select-none">
        <Info size={36} className="text-dracula-purple mb-3" />
        <h2 className="mb-1 text-lg font-black uppercase">
          No hay un grupo activo seleccionado
        </h2>
        <p className="text-dracula-gray mb-4 max-w-xs text-xs">
          Selecciona un grupo desde el Hub de Bienvenida para consultar su
          historial y estadísticas.
        </p>
        <Link
          href="/groups"
          className="bg-dracula-purple text-dracula-base btn-press rounded-xl px-5 py-2 text-xs font-black uppercase"
        >
          Ir al Hub de Grupos
        </Link>
      </div>
    );
  }

  return (
    <div className="app-shell-page text-dracula-light bg-black select-none">
      {/* Cabecera de la Página con soporte de Área Segura (iPhone notch) */}
      <header className="bg-dracula-base/95 border-dracula-gray/20 pt-safe-top app-shell-header z-40 flex-shrink-0 border-b px-4 pb-3 backdrop-blur-md select-none">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BarChart2 size={26} className="text-dracula-cyan" />
            <div>
              <h1 className="text-dracula-light text-lg font-black tracking-wide uppercase">
                Estadísticas
              </h1>
              <span className="text-dracula-gray block text-[10px] font-bold">
                {activeGroup?.nombre || 'Comunidad'}
              </span>
            </div>
          </div>
          <Link
            href="/groups"
            className="text-dracula-gray hover:text-dracula-light bg-dracula-card border-dracula-gray/20 btn-press rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors"
          >
            Cambiar Grupo
          </Link>
        </div>

        {/* Selector de Pestañas: Resumen vs Historial */}
        <div className="bg-dracula-card border-dracula-gray/20 flex rounded-xl border p-1">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`btn-press flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
              activeTab === 'resumen'
                ? 'bg-dracula-purple text-dracula-base shadow-md'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            <BarChart2 size={15} />
            <span>Resumen</span>
          </button>

          <button
            onClick={() => setActiveTab('historial')}
            className={`btn-press flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
              activeTab === 'historial'
                ? 'bg-dracula-purple text-dracula-base shadow-md'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            <History size={15} />
            <span>Historial ({transactions.length})</span>
          </button>
        </div>
      </header>

      <PullToRefresh onRefresh={fetchData}>
        <main className="app-shell-scroll p-4 pb-28">
          <div className="from-dracula-card to-dracula-base border-dracula-purple/30 relative mb-4 overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-dracula-gray mb-1 block text-[11px] font-bold tracking-wider uppercase">
                  Tu Saldo en este Grupo
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-dracula-yellow text-3xl font-black">
                    {activeGroup.saldo_grupo}
                  </span>
                  <span className="text-dracula-yellow/80 text-sm font-bold">
                    QuestCoins
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-dracula-gray mb-1 block text-[10px] font-bold tracking-wider uppercase">
                  Posición Ranking
                </span>
                <div className="bg-dracula-base/90 border-dracula-purple/40 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 shadow-md">
                  <Trophy size={16} className="text-dracula-purple" />
                  <span className="text-dracula-light text-base font-black">
                    #{ranking > 0 ? ranking : '-'}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-dracula-gray/20 text-dracula-gray mt-4 flex items-center justify-between border-t pt-3 text-xs font-semibold">
              <span className="flex items-center gap-1">
                <ShieldCheck size={14} className="text-dracula-green" />
                Rol:{' '}
                <strong className="text-dracula-light uppercase">
                  {activeGroup.rol}
                </strong>
              </span>
              <span>
                Comunidad: <strong>{activeGroup.nombre}</strong>
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="border-dracula-purple h-8 w-8 animate-spin rounded-full border-3 border-t-transparent"></div>
              <span className="text-dracula-gray text-xs font-bold">
                Cargando métricas...
              </span>
            </div>
          ) : activeTab === 'resumen' ? (
            /* --- SUB-PESTAÑA 1: RESUMEN DE ACTIVIDAD --- */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Misiones Completadas */}
                <div className="bg-dracula-card border-dracula-gray/20 flex items-center gap-3 rounded-2xl border p-4">
                  <div className="bg-dracula-green/10 text-dracula-green shrink-0 rounded-xl p-2.5">
                    <Target size={22} />
                  </div>
                  <div>
                    <span className="text-dracula-light block text-xl font-black">
                      {stats.missionsCompleted}
                    </span>
                    <span className="text-dracula-gray text-[10px] font-bold tracking-wider uppercase">
                      Misiones Hechas
                    </span>
                  </div>
                </div>

                {/* Apuestas Ganadas */}
                <div className="bg-dracula-card border-dracula-gray/20 flex items-center gap-3 rounded-2xl border p-4">
                  <div className="bg-dracula-yellow/10 text-dracula-yellow shrink-0 rounded-xl p-2.5">
                    <Dice5 size={22} />
                  </div>
                  <div>
                    <span className="text-dracula-light block text-xl font-black">
                      {stats.betsWon}
                    </span>
                    <span className="text-dracula-gray text-[10px] font-bold tracking-wider uppercase">
                      Apuestas Ganadas
                    </span>
                  </div>
                </div>

                {/* Duelos Ganados */}
                <div className="bg-dracula-card border-dracula-gray/20 flex items-center gap-3 rounded-2xl border p-4">
                  <div className="bg-dracula-red/10 text-dracula-red shrink-0 rounded-xl p-2.5">
                    <Swords size={22} />
                  </div>
                  <div>
                    <span className="text-dracula-light block text-xl font-black">
                      {stats.duelsWon}
                    </span>
                    <span className="text-dracula-gray text-[10px] font-bold tracking-wider uppercase">
                      Duelos Ganados
                    </span>
                  </div>
                </div>

                {/* Apuestas Perdidas */}
                <div className="bg-dracula-card border-dracula-gray/20 flex items-center gap-3 rounded-2xl border p-4">
                  <div className="bg-dracula-gray/10 text-dracula-gray shrink-0 rounded-xl p-2.5">
                    <TrendingDown size={22} />
                  </div>
                  <div>
                    <span className="text-dracula-light block text-xl font-black">
                      {stats.betsLost}
                    </span>
                    <span className="text-dracula-gray text-[10px] font-bold tracking-wider uppercase">
                      Apuestas Perdidas
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance Histórico del Grupo */}
              <div className="bg-dracula-card border-dracula-gray/20 space-y-3 rounded-2xl border p-4">
                <span className="text-dracula-gray block text-xs font-bold tracking-wider uppercase">
                  Rendimiento de Tokens en este Grupo
                </span>
                <div className="border-dracula-gray/20 flex items-center justify-between border-b py-2">
                  <span className="text-dracula-light flex items-center gap-2 text-xs">
                    <TrendingUp size={16} className="text-dracula-green" />{' '}
                    Total Ganado
                  </span>
                  <span className="text-dracula-green text-xs font-black">
                    +{stats.tokensWon || 0} QC
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-dracula-light flex items-center gap-2 text-xs">
                    <TrendingDown size={16} className="text-dracula-red" />{' '}
                    Total Perdido
                  </span>
                  <span className="text-dracula-red text-xs font-black">
                    -{stats.tokensLost || 0} QC
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* --- SUB-PESTAÑA 2: HISTORIAL DE TRANSACCIONES (LEDGER) --- */
            <div className="space-y-2.5">
              {transactions.length === 0 ? (
                <div className="bg-dracula-card/60 border-dracula-gray/20 rounded-2xl border p-6 py-12 text-center">
                  <Clock size={28} className="text-dracula-gray mx-auto mb-2" />
                  <p className="text-dracula-gray text-xs">
                    No hay transacciones registradas en este grupo todavía.
                  </p>
                </div>
              ) : (
                transactions.map((tx) => {
                  const isIncome = tx.amount > 0 || tx.type === 'income';
                  return (
                    <div
                      key={tx.id}
                      className="bg-dracula-card border-dracula-gray/20 hover:border-dracula-gray/40 flex items-center justify-between gap-3 rounded-xl border p-3.5 shadow-sm transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`shrink-0 rounded-xl p-2 ${
                            isIncome
                              ? 'bg-dracula-green/10 text-dracula-green'
                              : 'bg-dracula-red/10 text-dracula-red'
                          }`}
                        >
                          {isIncome ? (
                            <TrendingUp size={18} />
                          ) : (
                            <TrendingDown size={18} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-dracula-light truncate text-xs font-bold">
                            {tx.concept}
                          </p>
                          <span className="text-dracula-gray text-[10px]">
                            {formatSpanishDate(tx.date)}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span
                          className={`text-sm font-black ${
                            isIncome ? 'text-dracula-green' : 'text-dracula-red'
                          }`}
                        >
                          {isIncome ? `+${tx.amount}` : tx.amount} QC
                        </span>
                        {tx.balance !== undefined && (
                          <span className="text-dracula-gray block text-[10px]">
                            Saldo: {tx.balance}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </main>
      </PullToRefresh>
    </div>
  );
}
