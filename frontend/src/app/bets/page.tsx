'use client';

/**
 * ============================================================================
 * VISTA PRINCIPAL DEL MERCADO DE APUESTAS: QuestFest PWA
 * ============================================================================
 * Pantalla interactiva que organiza las apuestas en 3 pestañas principales:
 * 1. Mercado ('abiertas'): Apuestas activas donde los jugadores pueden arriesgar tokens.
 *    Permite filtrar por participación: "Todas", "Participando", "Por Apostar".
 * 2. Sugerencias ('propuestas'): Retos comunitarios propuestos por los usuarios en votación.
 * 3. Historial ('cerradas'): Apuestas concluidas con la opción ganadora y ganancias.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { Dice5, Plus } from 'lucide-react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';
import PullToRefresh from '@/components/PullToRefresh';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import BetCard from '@/components/BetCard';
import GroupSwitcher from '@/components/groups/GroupSwitcher';
import PlaceBetModal from '@/components/bets/PlaceBetModal';
import CreateBetModal from '@/components/bets/CreateBetModal';
import { ApuestaResponse, BetOption } from '@/types';

export type { BetOption };
export type BetItem = ApuestaResponse;

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function BetsPage() {
  const { refreshProfile } = useAuth();
  const { activeGroup, updateActiveGroupBalance, refreshGroups } = useGroup();
  const [activeTab, setActiveTab] = useState<
    'abiertas' | 'propuestas' | 'cerradas'
  >('abiertas');
  const [participationFilter, setParticipationFilter] = useState<
    'todas' | 'participando' | 'no_participando'
  >('todas');

  const [betsList, setBetsList] = useState<BetItem[]>([]);

  // Estados de modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [betModalData, setBetModalData] = useState<BetItem | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const fetchBets = async () => {
    try {
      const params = activeGroup ? { group_id: activeGroup.id } : {};
      const res = await api.get('/api/apuestas/', { params });
      setBetsList(res.data);
      refreshGroups();
    } catch (error) {
      console.error('Error fetching bets:', error);
    }
  };

  useEffect(() => {
    fetchBets();
  }, [activeGroup?.id]);

  // Funciones de acción
  const handleVoteProposal = async (id: string, voteType: 'up' | 'down') => {
    const promise = api.post(`/api/apuestas/${id}/vote`, {
      vote_type: voteType,
    });
    toast.promise(promise, {
      loading: 'Enviando voto...',
      success: 'Voto registrado',
      error: 'Error al votar',
    });
    try {
      await promise;
      fetchBets();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlaceBet = async (amount: number) => {
    if (!betModalData || !selectedOptionId || !amount || amount <= 0) {
      toast.error('Introduce una cantidad válida');
      return;
    }
    const promise = api.post(`/api/apuestas/${betModalData.id}/place`, {
      option_id: selectedOptionId,
      amount: amount,
    });

    toast.promise(promise, {
      loading: 'Procesando...',
      success: 'Apuesta registrada con éxito',
      error: (err: unknown) => getApiErrorMessage(err, 'Error al apostar'),
    });

    try {
      await promise;
      updateActiveGroupBalance(-amount);
      setBetModalData(null);
      await fetchBets();
    } catch (error: unknown) {
      console.error(error);
    }
  };

  // Ordenación global: más reciente a más antigua
  const sortedBets = [...betsList].sort((a, b) => {
    // Si la apuesta es propuesta, ordenar por createdAt. Si no, por approvedAt (con fallback a createdAt)
    const dateA =
      a.estado === 'propuesta'
        ? a.createdAt || ''
        : a.approvedAt || a.createdAt || '';
    const dateB =
      b.estado === 'propuesta'
        ? b.createdAt || ''
        : b.approvedAt || b.createdAt || '';
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const openBets = sortedBets.filter((b) => b.estado === 'abierta');
  const proposedBets = sortedBets.filter((b) => b.estado === 'propuesta');
  const closedBets = sortedBets.filter((b) => b.estado === 'cerrada');

  return (
    <>
      <div className="app-shell-page text-dracula-light bg-black select-none">
        {/* --- CABECERA FIJA CON SELECTOR DE GRUPO Y ÁREA SEGURA (App Shell) --- */}
        <header className="bg-dracula-base/95 app-shell-header border-dracula-gray/20 pt-safe-top z-40 flex-shrink-0 border-b px-4 pb-3 backdrop-blur-md select-none">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Dice5 size={26} className="text-dracula-yellow" />
              <div>
                <h1 className="text-dracula-light text-lg font-black tracking-wide uppercase">
                  Apuestas
                </h1>
                <span className="text-dracula-gray block text-[10px] font-bold">
                  {activeGroup?.nombre || 'Comunidad'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'propuestas' && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-dracula-yellow/20 text-dracula-yellow hover:bg-dracula-yellow/30 btn-press flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors"
                >
                  <Plus size={15} /> Sugerir
                </button>
              )}
              <GroupSwitcher />
            </div>
          </div>

          {/* Pestañas Principales */}
          <div className="border-dracula-gray/30 mb-3 flex w-full border-b">
            <button
              onClick={() => setActiveTab('abiertas')}
              className={`btn-press flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
                activeTab === 'abiertas'
                  ? 'text-dracula-yellow border-dracula-yellow border-b-2'
                  : 'text-dracula-gray hover:text-dracula-light'
              }`}
            >
              Mercado
            </button>
            <button
              onClick={() => setActiveTab('propuestas')}
              className={`btn-press flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
                activeTab === 'propuestas'
                  ? 'border-b-2 border-[#ffb86c] text-[#ffb86c]'
                  : 'text-dracula-gray hover:text-dracula-light'
              }`}
            >
              Sugerencias
            </button>
            <button
              onClick={() => setActiveTab('cerradas')}
              className={`btn-press flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
                activeTab === 'cerradas'
                  ? 'text-dracula-light border-dracula-light border-b-2'
                  : 'text-dracula-gray hover:text-dracula-light'
              }`}
            >
              Historial
            </button>
          </div>

          {/* Filtros: Solo visibles en el Mercado Activo */}
          {activeTab === 'abiertas' && (
            <div className="animate-fadeIn flex flex-col gap-3 pb-3">
              {/* Filtro de Participación */}
              <div className="hide-scrollbar flex gap-2 overflow-x-auto">
                <button
                  onClick={() => setParticipationFilter('todas')}
                  className={`btn-press rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${
                    participationFilter === 'todas'
                      ? 'bg-dracula-yellow text-dracula-base shadow-md'
                      : 'bg-dracula-card text-dracula-gray hover:text-dracula-light'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setParticipationFilter('participando')}
                  className={`btn-press rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${
                    participationFilter === 'participando'
                      ? 'bg-dracula-yellow text-dracula-base shadow-md'
                      : 'bg-dracula-card text-dracula-gray hover:text-dracula-light'
                  }`}
                >
                  Participando
                </button>
                <button
                  onClick={() => setParticipationFilter('no_participando')}
                  className={`btn-press rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${
                    participationFilter === 'no_participando'
                      ? 'bg-dracula-yellow text-dracula-base shadow-md'
                      : 'bg-dracula-card text-dracula-gray hover:text-dracula-light'
                  }`}
                >
                  Por Apostar
                </button>
              </div>
            </div>
          )}
        </header>

        {/* --- CUERPO DESPLAZABLE AISLADO CON SOPORTE DE PULL TO REFRESH --- */}
        <PullToRefresh
          onRefresh={async () => {
            await Promise.all([fetchBets(), refreshProfile()]);
          }}
        >
          <main className="app-shell-scroll pb-28">
            <section className="flex flex-col gap-4 px-4 pt-4">
              {activeTab === 'abiertas' && (
                <ActiveBetsView
                  bets={openBets}
                  participationFilter={participationFilter}
                  onOpenBetModal={(bet: BetItem) => {
                    setBetModalData(bet);
                    setSelectedOptionId(null);
                  }}
                />
              )}
              {activeTab === 'propuestas' && (
                <ProposedBetsView
                  proposals={proposedBets}
                  onVote={handleVoteProposal}
                />
              )}
              {activeTab === 'cerradas' && <ClosedBetsView bets={closedBets} />}
            </section>
          </main>
        </PullToRefresh>
      </div>

      {/* Botón Flotante Global (FAB) adaptado a la Tab Bar Liquid Glass */}
      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="bg-dracula-yellow text-dracula-base btn-press fixed right-4 bottom-20 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_0_20px_rgba(241,250,140,0.4)]"
        aria-label="Sugerir una apuesta"
      >
        <Plus size={32} strokeWidth={2.5} />
      </button>

      {/* --- MODALES --- */}
      {betModalData && (
        <PlaceBetModal
          bet={betModalData}
          selectedOptionId={selectedOptionId}
          setSelectedOptionId={setSelectedOptionId}
          onClose={() => setBetModalData(null)}
          onConfirm={handlePlaceBet}
        />
      )}

      {isCreateModalOpen && (
        <CreateBetModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchBets();
          }}
          groupId={activeGroup?.id}
        />
      )}
    </>
  );
}

// ============================================================================
// SUB-COMPONENTES (Refactorización Modular y Tipado Estricto)
// ============================================================================

interface ActiveBetsViewProps {
  bets: BetItem[];
  participationFilter: 'todas' | 'participando' | 'no_participando';
  onOpenBetModal: (bet: BetItem) => void;
}

/**
 * Renderiza el mercado de apuestas abiertas filtrando según la participación del jugador.
 */
function ActiveBetsView({
  bets,
  participationFilter,
  onOpenBetModal,
}: ActiveBetsViewProps) {
  const filteredBets = bets.filter((bet) => {
    const hasVoted =
      bet.userVotedOptionId !== null && bet.userVotedOptionId !== undefined;
    let passesParticipation = true;
    if (participationFilter === 'participando') passesParticipation = hasVoted;
    if (participationFilter === 'no_participando')
      passesParticipation = !hasVoted;
    return passesParticipation;
  });

  if (filteredBets.length === 0) {
    return (
      <div className="text-dracula-gray mt-10 text-center text-sm">
        No hay apuestas que coincidan con los filtros.
      </div>
    );
  }

  return (
    <>
      {filteredBets.map((bet) => (
        <BetCard key={bet.id} bet={bet} onOpenBetModal={onOpenBetModal} />
      ))}
    </>
  );
}

interface ProposedBetsViewProps {
  proposals: BetItem[];
  onVote: (id: string, voteType: 'up' | 'down') => Promise<void>;
}

/**
 * Muestra el tablón de apuestas comunitarias en proceso de votación popular.
 */
function ProposedBetsView({ proposals, onVote }: ProposedBetsViewProps) {
  return (
    <>
      <div className="mb-2 rounded-lg border border-[#ffb86c]/30 bg-[#ffb86c]/10 p-3 text-center text-xs font-semibold text-[#ffb86c]">
        Vota las apuestas sugeridas. Las más populares serán oficializadas por
        el Admin y se abrirá su mercado.
      </div>

      {proposals.map((prop) => (
        <BetCard key={prop.id} bet={prop} onVote={onVote} />
      ))}
    </>
  );
}

interface ClosedBetsViewProps {
  bets: BetItem[];
}

/**
 * Histórico de apuestas finalizadas y liquidadas con sus ganadores y beneficios.
 */
function ClosedBetsView({ bets }: ClosedBetsViewProps) {
  return (
    <>
      {bets.map((bet) => (
        <BetCard key={bet.id} bet={bet} />
      ))}
    </>
  );
}
