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
  Info
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
export default function GroupStatsPage() {
  const { user } = useAuth();
  const { activeGroup } = useGroup();

  const [activeTab, setActiveTab] = useState<'resumen' | 'historial'>('resumen');
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
  const [transactions, setTransactions] = useState<any[]>([]);

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
      <div className="app-shell-page bg-black text-dracula-light flex flex-col items-center justify-center p-6 text-center select-none">
        <Info size={36} className="text-dracula-purple mb-3" />
        <h2 className="text-lg font-black uppercase mb-1">No hay un grupo activo seleccionado</h2>
        <p className="text-xs text-dracula-gray mb-4 max-w-xs">
          Selecciona un grupo desde el Hub de Bienvenida para consultar su historial y estadísticas.
        </p>
        <Link
          href="/groups"
          className="py-2 px-5 bg-dracula-purple text-dracula-base font-black text-xs uppercase rounded-xl btn-press"
        >
          Ir al Hub de Grupos
        </Link>
      </div>
    );
  }

  return (
    <div className="app-shell-page bg-black text-dracula-light select-none">
      {/* Cabecera de la Página con soporte de Área Segura (iPhone notch) */}
      <header className="flex-shrink-0 bg-dracula-base/95 backdrop-blur-md z-40 border-b border-dracula-gray/20 pt-safe-top pb-3 px-4 app-shell-header select-none">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <BarChart2 size={22} className="text-dracula-purple" />
            <div>
              <h1 className="text-lg font-black uppercase tracking-wide text-dracula-light">
                Estadísticas del Grupo
              </h1>
              <span className="text-[11px] text-dracula-purple font-bold">
                {activeGroup.nombre}
              </span>
            </div>
          </div>
          <Link
            href="/groups"
            className="text-[11px] font-bold text-dracula-gray hover:text-dracula-light bg-dracula-card px-2.5 py-1.5 rounded-lg border border-dracula-gray/20 transition-colors btn-press"
          >
            Cambiar Grupo
          </Link>
        </div>

        {/* Selector de Pestañas: Resumen vs Historial */}
        <div className="flex bg-dracula-card p-1 rounded-xl border border-dracula-gray/20">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 btn-press ${
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
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 btn-press ${
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
          <div className="bg-gradient-to-br from-dracula-card to-dracula-base border border-dracula-purple/30 rounded-2xl p-5 shadow-xl relative overflow-hidden mb-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-bold text-dracula-gray uppercase tracking-wider block mb-1">
                  Tu Saldo en este Grupo
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-dracula-yellow">
                    {activeGroup.saldo_grupo}
                  </span>
                  <span className="text-sm font-bold text-dracula-yellow/80">QuestCoins</span>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-dracula-gray uppercase tracking-wider block mb-1">
                  Posición Ranking
                </span>
                <div className="flex items-center gap-1.5 bg-dracula-base/90 border border-dracula-purple/40 px-3 py-1.5 rounded-xl shadow-md">
                  <Trophy size={16} className="text-dracula-purple" />
                  <span className="text-base font-black text-dracula-light">
                    #{ranking > 0 ? ranking : '-'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-dracula-gray/20 flex justify-between items-center text-xs text-dracula-gray font-semibold">
              <span className="flex items-center gap-1">
                <ShieldCheck size={14} className="text-dracula-green" />
                Rol: <strong className="text-dracula-light uppercase">{activeGroup.rol}</strong>
              </span>
              <span>Comunidad: <strong>{activeGroup.nombre}</strong></span>
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-dracula-purple border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold text-dracula-gray">Cargando métricas...</span>
            </div>
          ) : activeTab === 'resumen' ? (
            /* --- SUB-PESTAÑA 1: RESUMEN DE ACTIVIDAD --- */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Misiones Completadas */}
                <div className="bg-dracula-card border border-dracula-gray/20 rounded-2xl p-4 flex items-center gap-3">
                  <div className="p-2.5 bg-dracula-green/10 text-dracula-green rounded-xl shrink-0">
                    <Target size={22} />
                  </div>
                  <div>
                    <span className="text-xl font-black text-dracula-light block">
                      {stats.missionsCompleted}
                    </span>
                    <span className="text-[10px] font-bold text-dracula-gray uppercase tracking-wider">
                      Misiones Hechas
                    </span>
                  </div>
                </div>

                {/* Apuestas Ganadas */}
                <div className="bg-dracula-card border border-dracula-gray/20 rounded-2xl p-4 flex items-center gap-3">
                  <div className="p-2.5 bg-dracula-yellow/10 text-dracula-yellow rounded-xl shrink-0">
                    <Dice5 size={22} />
                  </div>
                  <div>
                    <span className="text-xl font-black text-dracula-light block">
                      {stats.betsWon}
                    </span>
                    <span className="text-[10px] font-bold text-dracula-gray uppercase tracking-wider">
                      Apuestas Ganadas
                    </span>
                  </div>
                </div>

                {/* Duelos Ganados */}
                <div className="bg-dracula-card border border-dracula-gray/20 rounded-2xl p-4 flex items-center gap-3">
                  <div className="p-2.5 bg-dracula-red/10 text-dracula-red rounded-xl shrink-0">
                    <Swords size={22} />
                  </div>
                  <div>
                    <span className="text-xl font-black text-dracula-light block">
                      {stats.duelsWon}
                    </span>
                    <span className="text-[10px] font-bold text-dracula-gray uppercase tracking-wider">
                      Duelos Ganados
                    </span>
                  </div>
                </div>

                {/* Apuestas Perdidas */}
                <div className="bg-dracula-card border border-dracula-gray/20 rounded-2xl p-4 flex items-center gap-3">
                  <div className="p-2.5 bg-dracula-gray/10 text-dracula-gray rounded-xl shrink-0">
                    <TrendingDown size={22} />
                  </div>
                  <div>
                    <span className="text-xl font-black text-dracula-light block">
                      {stats.betsLost}
                    </span>
                    <span className="text-[10px] font-bold text-dracula-gray uppercase tracking-wider">
                      Apuestas Perdidas
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance Histórico del Grupo */}
              <div className="bg-dracula-card border border-dracula-gray/20 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-bold text-dracula-gray uppercase tracking-wider block">
                  Rendimiento de Tokens en este Grupo
                </span>
                <div className="flex justify-between items-center py-2 border-b border-dracula-gray/20">
                  <span className="text-xs text-dracula-light flex items-center gap-2">
                    <TrendingUp size={16} className="text-dracula-green" /> Total Ganado
                  </span>
                  <span className="text-xs font-black text-dracula-green">
                    +{stats.tokensWon || 0} QC
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-dracula-light flex items-center gap-2">
                    <TrendingDown size={16} className="text-dracula-red" /> Total Perdido
                  </span>
                  <span className="text-xs font-black text-dracula-red">
                    -{stats.tokensLost || 0} QC
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* --- SUB-PESTAÑA 2: HISTORIAL DE TRANSACCIONES (LEDGER) --- */
            <div className="space-y-2.5">
              {transactions.length === 0 ? (
                <div className="py-12 text-center bg-dracula-card/60 border border-dracula-gray/20 rounded-2xl p-6">
                  <Clock size={28} className="text-dracula-gray mx-auto mb-2" />
                  <p className="text-xs text-dracula-gray">
                    No hay transacciones registradas en este grupo todavía.
                  </p>
                </div>
              ) : (
                transactions.map((tx) => {
                  const isIncome = tx.amount > 0 || tx.type === 'income';
                  return (
                    <div
                      key={tx.id}
                      className="bg-dracula-card border border-dracula-gray/20 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm hover:border-dracula-gray/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-xl shrink-0 ${
                            isIncome
                              ? 'bg-dracula-green/10 text-dracula-green'
                              : 'bg-dracula-red/10 text-dracula-red'
                          }`}
                        >
                          {isIncome ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-dracula-light truncate">
                            {tx.concept}
                          </p>
                          <span className="text-[10px] text-dracula-gray">
                            {formatSpanishDate(tx.date)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-sm font-black ${
                            isIncome ? 'text-dracula-green' : 'text-dracula-red'
                          }`}
                        >
                          {isIncome ? `+${tx.amount}` : tx.amount} QC
                        </span>
                        {tx.balance !== undefined && (
                          <span className="block text-[10px] text-dracula-gray">
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
