'use client';

/**
 * ============================================================================
 * TABLA DE CLASIFICACIÓN Y PODIO DE HONOR: QuestFest PWA
 * ============================================================================
 * Visualiza el salón de la fama de la comunidad con ordenamiento dinámico
 * según cuatro disciplinas clave:
 * 
 * 1. 'tokens': Mayor acumulación de riqueza (QuestCoins).
 * 2. 'apuestas': Mayor precisión predictiva (apuestas acertadas).
 * 3. 'misiones': Mayor dedicación a los desafíos comunitarios.
 * 4. 'duelos': Mayor letalidad en combate directo (enfrentamientos PvP ganados).
 * 
 * Experiencia PWA y diseño visual:
 * - Podio honorífico para el Top 3 con gradientes y medallas de Oro, Plata y Bronce.
 * - Desglose multi-tenancy: los datos se recalculan al conmutar de grupo.
 * - Tarjetas interactivas que enlazan al perfil público de cada jugador (/user/[username]).
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { Trophy, Medal, Star, Shield, Coins, Dice5, Target, Swords } from 'lucide-react';
import api from '@/lib/axios';
import PullToRefresh from '@/components/PullToRefresh';
import Link from 'next/link';

import { useGroup } from '@/context/GroupContext';
import GroupSwitcher from '@/components/groups/GroupSwitcher';

export type RankingUser = {
  username: string;
  avatar_url: string | null;
  saldo_actual: number;
  apuestas_acertadas: number;
  misiones_completadas: number;
  duelos_ganados: number;
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function RankingPage() {
  const { activeGroup } = useGroup();
  
  // Disciplina seleccionada para ordenar la tabla
  const [activeTab, setActiveTab] = useState<'tokens' | 'apuestas' | 'misiones' | 'duelos'>('tokens');
  const [usersList, setUsersList] = useState<RankingUser[]>([]);

  /**
   * Consulta el endpoint analítico de ranking.
   * El backend utiliza subqueries escalares correlacionadas para calcular las 4 métricas en un único pase SQL.
   */
  const fetchRanking = async () => {
    try {
      const params = activeGroup ? { group_id: activeGroup.id } : {};
      const res = await api.get('/api/ranking/', { params });
      setUsersList(res.data);
    } catch (error) {
      console.error('Error fetching ranking:', error);
    }
  };

  useEffect(() => {
    fetchRanking();
  }, [activeGroup?.id]);

  // Ordenamiento puramente en cliente para máxima fluidez y respuesta inmediata
  const sortedUsers = [...usersList].sort((a, b) => {
    if (activeTab === 'tokens') return b.saldo_actual - a.saldo_actual;
    if (activeTab === 'apuestas') return b.apuestas_acertadas - a.apuestas_acertadas;
    if (activeTab === 'misiones') return b.misiones_completadas - a.misiones_completadas;
    if (activeTab === 'duelos') return b.duelos_ganados - a.duelos_ganados;
    return 0;
  });

  /**
   * Retorna el icono temático, color e indicador numérico según la pestaña activa.
   */
  const getMetricValue = (user: RankingUser) => {
    if (activeTab === 'tokens') return { value: user.saldo_actual, icon: Coins, color: 'text-dracula-yellow' };
    if (activeTab === 'apuestas') return { value: user.apuestas_acertadas, icon: Dice5, color: 'text-dracula-purple' };
    if (activeTab === 'misiones') return { value: user.misiones_completadas, icon: Target, color: 'text-dracula-green' };
    if (activeTab === 'duelos') return { value: user.duelos_ganados, icon: Swords, color: 'text-[#ffb86c]' };
    return { value: 0, icon: Star, color: 'text-dracula-light' };
  };

  return (
    <>
      <div className="app-shell-page bg-black text-dracula-light select-none">
        {/* Cabecera Fija del Ranking (App Shell - Capa Superior) */}
        <header className="flex-shrink-0 bg-dracula-base/95 backdrop-blur-md z-40 app-shell-header border-b border-dracula-gray/20 pt-safe-top pb-3 px-4 select-none">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <Trophy size={26} className="text-dracula-yellow" />
                <div>
                  <h1 className="text-lg font-black text-dracula-light uppercase tracking-wide">
                    Ranking
                  </h1>
                  <span className="text-[10px] text-dracula-gray font-bold block">
                    {activeGroup?.nombre || 'Comunidad'}
                  </span>
                </div>
              </div>
              <GroupSwitcher />
            </div>

            <div className="flex w-full border-b border-dracula-gray/30">
              <button
                onClick={() => setActiveTab('tokens')}
                className={`flex-1 pb-3 text-sm text-center font-semibold transition-colors btn-press ${
                  activeTab === 'tokens'
                    ? 'text-dracula-yellow border-b-2 border-dracula-yellow'
                    : 'text-dracula-gray hover:text-dracula-light'
                }`}
              >
                QuestCoins
              </button>
              <button
                onClick={() => setActiveTab('apuestas')}
                className={`flex-1 pb-3 text-sm text-center font-semibold transition-colors btn-press ${
                  activeTab === 'apuestas'
                    ? 'text-dracula-purple border-b-2 border-dracula-purple'
                    : 'text-dracula-gray hover:text-dracula-light'
                }`}
              >
                Apuestas
              </button>
              <button
                onClick={() => setActiveTab('misiones')}
                className={`flex-1 pb-3 text-sm text-center font-semibold transition-colors btn-press ${
                  activeTab === 'misiones'
                    ? 'text-dracula-green border-b-2 border-dracula-green'
                    : 'text-dracula-gray hover:text-dracula-light'
                }`}
              >
                Misiones
              </button>
              <button
                onClick={() => setActiveTab('duelos')}
                className={`flex-1 pb-3 text-sm text-center font-semibold transition-colors btn-press ${
                  activeTab === 'duelos'
                    ? 'text-[#ffb86c] border-b-2 border-[#ffb86c]'
                    : 'text-dracula-gray hover:text-dracula-light'
                }`}
              >
                Duelos
              </button>
            </div>
          </header>

          {/* Cuerpo desplazable interno aislado con soporte de Pull to Refresh */}
          <PullToRefresh onRefresh={fetchRanking}>
            <main className="app-shell-scroll pb-28">
            <section className="flex flex-col gap-3 px-4 pt-4">
            {sortedUsers.map((user, index) => {
              const metric = getMetricValue(user);
              const isTop1 = index === 0;
              const isTop2 = index === 1;
              const isTop3 = index === 2;
              const isTop = isTop1 || isTop2 || isTop3;

              let cardBg = 'bg-dracula-card';
              let borderColor = 'border-dracula-gray/10';
              let medalColor = '';
              
              if (isTop1) {
                cardBg = 'bg-gradient-to-r from-[#f1fa8c]/10 to-dracula-card';
                borderColor = 'border-[#f1fa8c]/50';
                medalColor = 'text-[#f1fa8c]'; // Gold
              } else if (isTop2) {
                cardBg = 'bg-gradient-to-r from-gray-300/10 to-dracula-card';
                borderColor = 'border-gray-300/50';
                medalColor = 'text-gray-300'; // Silver
              } else if (isTop3) {
                cardBg = 'bg-gradient-to-r from-[#ffb86c]/10 to-dracula-card';
                borderColor = 'border-[#ffb86c]/50';
                medalColor = 'text-[#ffb86c]'; // Bronze
              }

              return (
                <Link
                  href={`/user/${user.username}`}
                  key={user.username}
                  className={`flex items-center justify-between p-4 rounded-xl border ${cardBg} ${borderColor} shadow-md active:scale-95 transition-transform cursor-pointer`}
                >
                  <div className="flex items-center gap-4">
                    <div className="font-black text-lg w-6 text-center text-dracula-gray/50">
                      {index + 1}
                    </div>
                    <div className="relative">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className={`w-12 h-12 rounded-full object-cover border-2 ${isTop ? borderColor : 'border-dracula-card'}`}
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-dracula-base border-2 ${isTop ? borderColor : 'border-dracula-card'}`}>
                          <Shield size={24} className="text-dracula-gray" />
                        </div>
                      )}
                      {isTop && (
                        <div className="absolute -top-2 -right-2 bg-dracula-base rounded-full p-0.5">
                          <Medal size={18} className={medalColor} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className={`font-bold text-base ${isTop ? 'text-dracula-light' : 'text-dracula-light/90'}`}>
                        @{user.username}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <div className={`flex items-center gap-1 font-black ${metric.color} ${isTop ? 'text-xl' : 'text-lg'}`}>
                      {metric.value}
                      <metric.icon size={18} strokeWidth={2.5} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        </main>
      </PullToRefresh>
    </div>
  </>
  );
}
