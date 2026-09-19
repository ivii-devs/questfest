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
import {
  Dice5,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Trash,
} from 'lucide-react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import PullToRefresh from '@/components/PullToRefresh';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import BetCard from '@/components/BetCard';
import GroupSwitcher from '@/components/groups/GroupSwitcher';
import TokenAmountInput from '@/components/ui/TokenAmountInput';

export interface BetOption {
  id: string;
  text: string;
  multiplier: number;
}

export interface BetItem {
  id: string;
  title: string;
  creator: string;
  phase: string;
  estado: string;
  group_id?: number;
  opcion_ganadora_id?: string | null;
  options: BetOption[];
  userVotedOptionId?: string | null;
  userBetAmount?: number;
  userWon?: boolean | null;
  profit?: number;
  winningOption?: string | null;
  multiplier?: number | null;
  upvotes: number;
  downvotes: number;
  user_vote?: string | null;
  createdAt?: string;
  approvedAt?: string;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function BetsPage() {
  const { refreshProfile } = useAuth();
  const { activeGroup, updateActiveGroupBalance } = useGroup();
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
      error: (err: any) => err.response?.data?.detail || 'Error al apostar',
    });

    try {
      await promise;
      updateActiveGroupBalance(-amount);
      setBetModalData(null);
      await fetchBets();
    } catch (error: any) {
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
      <div className="app-shell-page bg-black text-dracula-light select-none">
        {/* --- CABECERA FIJA CON SELECTOR DE GRUPO Y ÁREA SEGURA (App Shell) --- */}
        <header className="flex-shrink-0 bg-dracula-base/95 backdrop-blur-md z-40 app-shell-header border-b border-dracula-gray/20 pt-safe-top pb-3 px-4 select-none">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <Dice5 size={26} className="text-dracula-yellow" />
                <div>
                  <h1 className="text-lg font-black text-dracula-light uppercase tracking-wide">
                    Apuestas
                  </h1>
                  <span className="text-[10px] text-dracula-gray font-bold block">
                    {activeGroup?.nombre || 'Comunidad'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeTab === 'propuestas' && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-dracula-yellow/20 text-dracula-yellow px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1 hover:bg-dracula-yellow/30 transition-colors text-xs btn-press"
                  >
                    <Plus size={15} /> Sugerir
                  </button>
                )}
                <GroupSwitcher />
              </div>
            </div>

            {/* Pestañas Principales */}
            <div className="flex w-full border-b border-dracula-gray/30 mb-3">
              <button
                onClick={() => setActiveTab('abiertas')}
                className={`flex-1 pb-3 text-sm text-center font-semibold transition-colors btn-press ${
                  activeTab === 'abiertas'
                    ? 'text-dracula-yellow border-b-2 border-dracula-yellow'
                    : 'text-dracula-gray hover:text-dracula-light'
                }`}
              >
                Mercado
              </button>
              <button
                onClick={() => setActiveTab('propuestas')}
                className={`flex-1 pb-3 text-sm text-center font-semibold transition-colors btn-press ${
                  activeTab === 'propuestas'
                    ? 'text-[#ffb86c] border-b-2 border-[#ffb86c]'
                    : 'text-dracula-gray hover:text-dracula-light'
                }`}
              >
                Sugerencias
              </button>
              <button
                onClick={() => setActiveTab('cerradas')}
                className={`flex-1 pb-3 text-sm text-center font-semibold transition-colors btn-press ${
                  activeTab === 'cerradas'
                    ? 'text-dracula-light border-b-2 border-dracula-light'
                    : 'text-dracula-gray hover:text-dracula-light'
                }`}
              >
                Historial
              </button>
            </div>

            {/* Filtros: Solo visibles en el Mercado Activo */}
            {activeTab === 'abiertas' && (
              <div className="flex flex-col gap-3 pb-3 animate-fadeIn">


                {/* Filtro de Participación */}
                <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                  <button
                    onClick={() => setParticipationFilter('todas')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap btn-press ${
                      participationFilter === 'todas'
                        ? 'bg-dracula-yellow text-dracula-base shadow-md'
                        : 'bg-dracula-card text-dracula-gray hover:text-dracula-light'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => setParticipationFilter('participando')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap btn-press ${
                      participationFilter === 'participando'
                        ? 'bg-dracula-yellow text-dracula-base shadow-md'
                        : 'bg-dracula-card text-dracula-gray hover:text-dracula-light'
                    }`}
                  >
                    Participando
                  </button>
                  <button
                    onClick={() => setParticipationFilter('no_participando')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap btn-press ${
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
                    onOpenBetModal={(bet: any) => {
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
        className="fixed bottom-20 right-4 w-14 h-14 bg-dracula-yellow rounded-full shadow-[0_0_20px_rgba(241,250,140,0.4)] flex items-center justify-center text-dracula-base btn-press z-40"
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
        <SuggestBetModal
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
    const hasVoted = bet.userVotedOptionId !== null && bet.userVotedOptionId !== undefined;
    let passesParticipation = true;
    if (participationFilter === 'participando') passesParticipation = hasVoted;
    if (participationFilter === 'no_participando') passesParticipation = !hasVoted;
    return passesParticipation;
  });

  if (filteredBets.length === 0) {
    return (
      <div className="text-center text-dracula-gray mt-10 text-sm">
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
      <div className="bg-[#ffb86c]/10 border border-[#ffb86c]/30 p-3 rounded-lg text-xs text-[#ffb86c] font-semibold text-center mb-2">
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

// ============================================================================
// MODALES TIPADOS
// ============================================================================

interface PlaceBetModalProps {
  bet: BetItem;
  selectedOptionId: string | null;
  setSelectedOptionId: (id: string) => void;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}

/**
 * Modal tipo Cupón de Apuesta: permite elegir la opción deseada, fijar el importe
 * y confirmar la deducción transaccional de tokens.
 */
function PlaceBetModal({
  bet,
  selectedOptionId,
  setSelectedOptionId,
  onClose,
  onConfirm,
}: PlaceBetModalProps) {
  const [amount, setAmount] = useState<number | ''>('');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dracula-base w-full max-w-md rounded-2xl shadow-2xl border border-dracula-yellow/50 overflow-hidden flex flex-col scale-in-center">
        <div className="flex justify-between items-center p-4 border-b border-dracula-gray/20 bg-dracula-card/50">
          <h3 className="font-bold text-dracula-yellow text-base flex items-center gap-2">
            <Dice5 size={18} /> Cupón de Apuesta
          </h3>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-red transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <p className="text-sm font-semibold text-dracula-light leading-snug">
            {bet.title}
          </p>
          <div className="flex flex-col gap-2">
            {bet.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedOptionId(opt.id)}
                className={`p-3 rounded-lg border text-sm font-semibold flex justify-between items-center transition-all ${
                  selectedOptionId === opt.id
                    ? 'bg-dracula-yellow/10 border-dracula-yellow text-dracula-yellow'
                    : 'bg-dracula-card border-dracula-gray/10 text-dracula-light hover:border-dracula-gray/40'
                }`}
              >
                <span>{opt.text}</span>
                <span className="font-mono text-xs opacity-80">
                  x{opt.multiplier.toFixed(2)}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 mt-1">
            <label htmlFor="bet-investment-amount" className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest">
              Inversión (Tokens)
            </label>
            <TokenAmountInput
              id="bet-investment-amount"
              name="betAmount"
              min={1}
              value={amount}
              onChange={setAmount}
              placeholder="Cantidad a arriesgar..."
              icon="💰"
              className="w-full bg-dracula-card rounded-xl py-3 pl-9 pr-3 text-sm font-bold text-dracula-yellow border border-dracula-gray/20 focus:outline-none focus:border-dracula-yellow"
            />
          </div>
        </div>

        <div className="p-4 flex gap-3 border-t border-dracula-gray/20 bg-dracula-card/20">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold text-xs text-dracula-light bg-dracula-card hover:bg-dracula-gray/30"
          >
            Cancelar
          </button>
          <button
            disabled={!selectedOptionId || !amount}
            onClick={() => onConfirm(Number(amount))}
            className={`flex-[2] py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              selectedOptionId && amount
                ? 'bg-dracula-yellow text-dracula-base hover:opacity-90 shadow'
                : 'bg-dracula-base text-dracula-gray border border-dracula-gray/20 cursor-not-allowed'
            }`}
          >
            <CheckCircle size={16} /> Confirmar Apuesta
          </button>
        </div>
      </div>
    </div>
  );
}

interface SuggestBetModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  groupId?: number;
}

/**
 * Modal para proponer nuevas apuestas comunitarias.
 * Valida un mínimo de 2 opciones con multiplicadores estrictamente superiores a 1.00.
 */
function SuggestBetModal({ onClose, onSuccess, groupId }: SuggestBetModalProps) {
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState([
    { text: '', multiplier: '' },
    { text: '', multiplier: '' },
  ]);

  const handleSuggest = async () => {
    if (!title || options.some((o) => !o.text || !o.multiplier)) {
      toast.error('Rellena todos los campos');
      return;
    }

    if (title.length < 5) {
      toast.error('El título debe tener al menos 5 letras');
      return;
    }

    if (options.some((o) => Number(o.multiplier) <= 1.0)) {
      toast.error('Las cuotas deben ser mayores a 1.0');
      return;
    }

    const formattedOptions = options.map((o) => ({
      text: o.text,
      multiplier: Number(o.multiplier),
    }));

    const promise = api.post('/api/apuestas/suggest', {
      title,
      options: formattedOptions,
      group_id: groupId || undefined,
    });

    toast.promise(promise, {
      loading: 'Enviando sugerencia...',
      success: 'Sugerencia enviada correctamente',
      error: 'Error al enviar la sugerencia',
    });

    try {
      await promise;
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const updateOption = (
    index: number,
    field: 'text' | 'multiplier',
    value: string
  ) => {
    const newOptions = [...options];
    newOptions[index][field] = value;
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) {
      toast.error('Debe haber al menos 2 opciones');
      return;
    }
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, { text: '', multiplier: '' }]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dracula-base w-full max-w-md rounded-2xl shadow-2xl border border-[#ffb86c]/50 overflow-hidden flex flex-col max-h-[85vh] scale-in-center">
        <div className="flex justify-between items-center p-4 border-b border-dracula-gray/20 bg-dracula-card/50 sticky top-0 z-10">
          <h3 className="font-bold text-[#ffb86c] text-base flex items-center gap-2">
            <MessageSquare size={18} /> Sugerir al Grupo
          </h3>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-red transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="bg-[#ffb86c]/10 border border-[#ffb86c]/20 p-3 rounded-lg flex gap-2 items-start text-xs text-[#ffb86c] leading-normal font-semibold">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              Las apuestas sugeridas pasarán por una fase de votación. Si a la
              gente le gusta, el Admin la aprobará.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-bet-title" className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest">
              Pregunta de la apuesta *
            </label>
            <input
              id="create-bet-title"
              name="betTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-dracula-card rounded-xl p-3 text-sm text-dracula-light border border-dracula-gray/20 focus:outline-none focus:border-[#ffb86c]"
              placeholder="Ej: ¿Quién se quemará primero al sol?"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest">
              Opciones sugeridas (y cuotas)
            </label>

            {options.map((opt, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  id={`bet-option-${index}`}
                  name={`betOption_${index}`}
                  aria-label={`Texto de la opción ${index + 1}`}
                  type="text"
                  value={opt.text}
                  onChange={(e) => updateOption(index, 'text', e.target.value)}
                  placeholder={`Opción ${index + 1}...`}
                  className="flex-[3] bg-dracula-card rounded-xl p-3 text-sm text-dracula-light border border-dracula-gray/20 focus:outline-none focus:border-[#ffb86c]"
                />
                <div className="flex-[1.5] relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-dracula-gray font-bold">
                    x
                  </span>
                  <input
                    id={`bet-multiplier-${index}`}
                    name={`betMultiplier_${index}`}
                    aria-label={`Multiplicador de la opción ${index + 1}`}
                    type="number"
                    step="0.01"
                    value={opt.multiplier}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      updateOption(index, 'multiplier', e.target.value)
                    }
                    className="w-full bg-dracula-card rounded-xl py-3 pl-7 pr-3 text-sm font-mono font-bold text-dracula-cyan border border-dracula-gray/20 focus:outline-none focus:border-[#ffb86c]"
                  />
                </div>
                <button
                  onClick={() => removeOption(index)}
                  className="p-3 text-dracula-red hover:bg-dracula-red/10 rounded-xl transition-colors border border-dracula-red/20 flex items-center justify-center"
                >
                  <Trash size={16} />
                </button>
              </div>
            ))}

            <button
              onClick={addOption}
              className="text-xs font-bold text-[#ffb86c] text-left mt-2 w-max flex items-center gap-1 hover:opacity-80"
            >
              <Plus size={14} /> Añadir otra opción
            </button>
          </div>
        </div>

        <div className="p-4 flex gap-3 border-t border-dracula-gray/20 bg-dracula-card/20">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold text-xs text-dracula-light bg-dracula-card hover:bg-dracula-gray/30"
          >
            Cancelar
          </button>
          <button
            onClick={handleSuggest}
            className="flex-[2] py-3 rounded-xl font-bold text-xs text-dracula-base bg-[#ffb86c] hover:opacity-90 transition-all flex items-center justify-center gap-1.5"
          >
            Enviar Sugerencia
          </button>
        </div>
      </div>
    </div>
  );
}
