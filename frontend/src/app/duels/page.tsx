'use client';

/**
 * ============================================================================
 * VISTA PRINCIPAL DE DUELOS PvP: QuestFest PWA
 * ============================================================================
 * Pantalla de enfrentamientos directos uno contra uno con tokens en custodia (Escrow).
 * 
 * Flujos disponibles:
 * 1. Duelos En Curso ('activos'): Desafíos pendientes de aceptar, en disputa o en validación.
 *    Filtros rápidos: "Todos", "Míos" (donde participo) y "Pendientes" (retos hacia mí).
 * 2. Historial de Batallas ('historial'): Registro histórico de duelos completados,
 *    ganados, perdidos, empates o cancelados con sanciones disciplinarias.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import {
  Swords,
  Plus,
  X,
  User,
  Check,
  History,
  Scale,
} from 'lucide-react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import PullToRefresh from '@/components/PullToRefresh';
import DuelCard from '@/components/DuelCard';
import { useGroup } from '@/context/GroupContext';
import GroupSwitcher from '@/components/groups/GroupSwitcher';
import TokenAmountInput from '@/components/ui/TokenAmountInput';

export interface DuelItem {
  id: number;
  challenger: string;
  challenged: string;
  game: string;
  wager: number;
  status: string;
  group_id?: number;
  winner?: string | null;
  is_current_user_challenged?: boolean;
  isCurrentUserChallenged?: boolean;
  challenger_avatar?: string | null;
  challenged_avatar?: string | null;
  fecha_creacion?: string | null;
  reported_resolution?: string | null;
}

interface ActiveDuelsViewProps {
  duels: DuelItem[];
  filter: 'todos' | 'mios' | 'pendientes';
  currentUser: string;
  onResolve: (duel: DuelItem) => void;
  onAction: () => Promise<void> | void;
}

interface HistoryDuelsViewProps {
  duels: DuelItem[];
  currentUser: string;
}

interface CreateDuelModalProps {
  users: string[];
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  groupId?: number;
}

interface DeclareWinnerModalProps {
  duel: DuelItem;
  currentUser: string;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function DuelsPage() {
  const { activeGroup, refreshGroups } = useGroup();
  
  // Pestaña principal: retos activos vs registro de batallas pasadas
  const [activeTab, setActiveTab] = useState<'activos' | 'historial'>('activos');
  
  // Sub-filtro de duelos activos para priorizar la interacción del usuario
  const [duelFilter, setDuelFilter] = useState<'todos' | 'mios' | 'pendientes'>('todos');

  // Listados de duelos y usuarios del sistema
  const [activeDuels, setActiveDuels] = useState<DuelItem[]>([]);
  const [historyDuels, setHistoryDuels] = useState<DuelItem[]>([]);
  const [usersList, setUsersList] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string>('');

  /**
   * Carga la identidad del usuario actual y la lista de rivales posibles,
   * excluyendo al usuario actual de su propia lista de adversarios.
   */
  const fetchUsers = async () => {
    try {
      const resMe = await api.get('/api/auth/me');
      setCurrentUser(resMe.data.username);

      const res = await api.get('/api/auth/users');
      setUsersList(
        res.data
          .map((u: { username: string }) => u.username)
          .filter((u: string) => u !== resMe.data.username)
      );
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  /**
   * Obtiene los duelos del grupo activo (o globales) y clasifica entre:
   * 1. Activos: pendientes de aceptación, en curso o en arbitraje del tribunal.
   * 2. Historial: finalizados o cancelados con sanción disciplinaria.
   * Sincroniza atómicamente el saldo local del grupo para reflejar retenciones Escrow inmediatas.
   */
  const fetchDuels = async () => {
    try {
      const params = activeGroup ? { group_id: activeGroup.id } : {};
      const res = await api.get('/api/duelos/', { params });
      
      // Normalizamos el flag camelCase para compatibilidad con DuelCard
      const allDuels: DuelItem[] = res.data.map((d: DuelItem) => ({
        ...d,
        isCurrentUserChallenged: d.is_current_user_challenged,
      }));

      setActiveDuels(
        allDuels.filter(
          (d) =>
            !d.status.includes('completed') && !d.status.includes('penalized')
        )
      );
      setHistoryDuels(
        allDuels.filter(
          (d) =>
            d.status.includes('completed') || d.status.includes('penalized')
        )
      );
      // Sincronización contable reactiva del saldo
      refreshGroups();
    } catch (error) {
      console.error('Error fetching duels:', error);
    }
  };

  // Sincronización al montar o al cambiar de comunidad activa
  useEffect(() => {
    fetchUsers();
    fetchDuels();
  }, [activeGroup?.id]);

  // Estados de control para la apertura de modales táctiles
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [duelToResolve, setDuelToResolve] = useState<DuelItem | null>(null);

  return (
    <div className="app-shell-page bg-black text-dracula-light select-none">
      {/* --- CABECERA FIJA CON SELECTOR DE GRUPO Y ÁREA SEGURA --- */}
      <header className="flex-shrink-0 bg-dracula-base/95 backdrop-blur-md z-40 app-shell-header border-b border-dracula-gray/20 pt-safe-top pb-3 px-4 select-none">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Swords size={26} className="text-dracula-red" />
            <div>
              <h1 className="text-lg font-black text-dracula-light uppercase tracking-wide">
                Duelos
              </h1>
              <span className="text-[10px] text-dracula-gray font-bold block">
                {activeGroup?.nombre || 'Comunidad'}
              </span>
            </div>
          </div>
          <GroupSwitcher />
        </div>

        <div className="flex w-full mb-3 border-b border-dracula-gray/30">
          <button
            onClick={() => setActiveTab('activos')}
            className={`flex-1 pb-3 text-center text-sm font-semibold transition-colors btn-press ${
              activeTab === 'activos'
                ? 'text-dracula-red border-b-2 border-dracula-red'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            En Curso
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`flex-1 pb-3 text-center text-sm font-semibold transition-colors btn-press ${
              activeTab === 'historial'
                ? 'text-dracula-purple border-b-2 border-dracula-purple'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            Historial
          </button>
        </div>

        {/* Sub-filtros (Solo en Activos) */}
        {activeTab === 'activos' && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-3 animate-fadeIn">
            <button
              onClick={() => setDuelFilter('todos')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap btn-press ${
                duelFilter === 'todos'
                  ? 'bg-dracula-red text-dracula-base'
                  : 'bg-dracula-card text-dracula-light border border-dracula-gray/20'
              }`}
            >
              Global
            </button>
            <button
              onClick={() => setDuelFilter('mios')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap btn-press ${
                duelFilter === 'mios'
                  ? 'bg-dracula-yellow text-dracula-base'
                  : 'bg-dracula-card text-dracula-light border border-dracula-gray/20'
              }`}
            >
              Mis Batallas
            </button>
            <button
              onClick={() => setDuelFilter('pendientes')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 btn-press ${
                duelFilter === 'pendientes'
                  ? 'bg-dracula-purple text-dracula-light'
                  : 'bg-dracula-card text-dracula-light border border-dracula-gray/20'
              }`}
            >
              Me Toca Responder
            </button>
          </div>
        )}
      </header>

      {/* --- RENDERIZADO DE PESTAÑAS CON SCROLL INTERNO AISLADO --- */}
      <PullToRefresh onRefresh={fetchDuels}>
        <main className="app-shell-scroll p-4 pb-28 flex flex-col gap-4">
          {activeTab === 'activos' && (
            <ActiveDuelsView
              duels={activeDuels}
              filter={duelFilter}
              currentUser={currentUser}
              onResolve={(duel: DuelItem) => setDuelToResolve(duel)}
              onAction={fetchDuels}
            />
          )}
          {activeTab === 'historial' && (
            <HistoryDuelsView
              duels={historyDuels}
              currentUser={currentUser}
            />
          )}
        </main>
      </PullToRefresh>

      {/* --- BOTÓN FLOTANTE (FAB) CON MICROPULSACIÓN TÁCTIL --- */}
      <button
        onClick={() => setIsChallengeModalOpen(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-dracula-red rounded-full shadow-[0_0_20px_rgba(255,85,85,0.4)] flex items-center justify-center text-dracula-base btn-press z-30"
        aria-label="Lanzar un reto"
      >
        <Plus size={32} strokeWidth={2.5} />
      </button>

      {/* --- MODALES TÁCTILES --- */}
      {isChallengeModalOpen && (
        <CreateDuelModal
          users={usersList}
          onClose={() => setIsChallengeModalOpen(false)}
          onSuccess={fetchDuels}
          groupId={activeGroup?.id}
        />
      )}

      {duelToResolve && (
        <DeclareWinnerModal
          duel={duelToResolve}
          currentUser={currentUser}
          onClose={() => setDuelToResolve(null)}
          onSuccess={fetchDuels}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTES (Vistas Modulares)
// ============================================================================

/**
 * Vista de duelos en curso o pendientes.
 * Implementa ordenamiento inteligente:
 * 1. En vista 'todos': prioriza los duelos en los que participo directamente arriba.
 * 2. Orden cronológico descendente para mantener la frescura del feed.
 */
function ActiveDuelsView({
  duels,
  filter,
  currentUser,
  onResolve,
  onAction,
}: ActiveDuelsViewProps) {
  // Filtrado por contexto de pertenencia
  const filteredDuels = duels.filter((duel) => {
    const isMyDuel =
      duel.challenger === currentUser || duel.challenged === currentUser;
    if (filter === 'mios') return isMyDuel;
    if (filter === 'pendientes')
      return duel.status === 'pending' && duel.isCurrentUserChallenged;
    return true;
  });

  // Ordenamiento con prioridad ego-céntrica y frescura temporal
  filteredDuels.sort((a, b) => {
    const timeA = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
    const timeB = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;

    if (filter === 'todos') {
      const aIsMine =
        a.challenger === currentUser || a.challenged === currentUser;
      const bIsMine =
        b.challenger === currentUser || b.challenged === currentUser;
      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
    }

    return timeB - timeA;
  });

  if (filteredDuels.length === 0) {
    return (
      <div className="text-center text-dracula-gray mt-10 text-sm">
        No hay duelos en esta categoría. ¡Reta a alguien!
      </div>
    );
  }

  return (
    <>
      {filteredDuels.map((duel) => (
        <DuelCard
          key={duel.id}
          duel={duel}
          currentUser={currentUser}
          onResolve={onResolve}
          onAction={onAction}
        />
      ))}
    </>
  );
}

/**
 * Historial de duelos pasados.
 * Permite filtrar por resultado (ganadas, perdidas, empates, penalizaciones disciplinarias y rechazos).
 */
function HistoryDuelsView({ duels, currentUser }: HistoryDuelsViewProps) {
  const [historyFilter, setHistoryFilter] = useState('todos');

  const filteredDuels = duels.filter((duel) => {
    if (historyFilter === 'todos') return true;
    if (historyFilter === 'ganadas') return duel.winner === currentUser;
    if (historyFilter === 'perdidas') return duel.winner && duel.winner !== currentUser;
    if (historyFilter === 'empatadas_multa') return duel.reported_resolution === 'tie_with_penalty';
    if (historyFilter === 'con_multa')
      return (
        duel.reported_resolution === 'penalized_challenger' ||
        duel.reported_resolution === 'penalized_challenged'
      );
    if (historyFilter === 'rechazadas') return duel.status === 'rejected' || duel.status === 'declined';
    if (historyFilter === 'empatadas') {
      return (
        !duel.winner &&
        duel.status !== 'rejected' &&
        duel.status !== 'declined' &&
        duel.reported_resolution !== 'tie_with_penalty' &&
        duel.reported_resolution !== 'penalized_challenger' &&
        duel.reported_resolution !== 'penalized_challenged'
      );
    }
    return true;
  });

  const sortedDuels = [...filteredDuels].sort((a, b) => {
    const timeA = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
    const timeB = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <>
      <div className="flex items-center gap-2 text-dracula-gray text-xs justify-center mb-2 font-semibold">
        <History size={14} /> Registro de batallas cerradas
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-3 mb-2 px-1">
        {[
          { id: 'todos', label: 'Todos' },
          { id: 'ganadas', label: 'Ganadas' },
          { id: 'perdidas', label: 'Perdidas' },
          { id: 'empatadas', label: 'Empatadas' },
          { id: 'empatadas_multa', label: 'Empatadas con multas' },
          { id: 'con_multa', label: 'Con multa' },
          { id: 'rechazadas', label: 'Rechazadas' },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setHistoryFilter(filter.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap btn-press ${
              historyFilter === filter.id
                ? 'bg-dracula-purple text-dracula-base'
                : 'bg-dracula-card text-dracula-light border border-dracula-gray/20 hover:border-dracula-purple/50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {sortedDuels.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-dracula-gray text-sm">No hay duelos en esta categoría.</p>
        </div>
      ) : (
        sortedDuels.map((duel) => (
          <DuelCard key={duel.id} duel={duel} currentUser={currentUser} />
        ))
      )}
    </>
  );
}

// ============================================================================
// MODALES TÁCTILES PWA
// ============================================================================

/**
 * Modal para proponer un nuevo duelo.
 * Al enviarse, el backend bloquea automáticamente la apuesta (Escrow) del retador.
 */
function CreateDuelModal({ users, onClose, onSuccess, groupId }: CreateDuelModalProps) {
  const [challenged, setChallenged] = useState('');
  const [game, setGame] = useState('');
  // Inicializamos el valor en blanco con placeholder sugerido ('100'),
  // permitiendo edición fluida y auto-selección táctil PWA
  const [wager, setWager] = useState<number | ''>('');

  const handleSubmit = async () => {
    if (!challenged || !game || wager === '' || wager <= 0) {
      toast.error('Rellena todos los campos correctamente');
      return;
    }
    try {
      await api.post('/api/duelos/', {
        challenged_username: challenged,
        game: game,
        wager: wager,
        group_id: groupId || undefined,
      });
      toast.success('Reto lanzado con éxito');
      await onSuccess();
      onClose();
    } catch {
      toast.error('Error al lanzar el reto');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dracula-base w-full max-w-md rounded-2xl shadow-2xl border-2 border-dracula-red overflow-hidden flex flex-col scale-in-center">
        <div className="flex justify-between items-center p-4 border-b border-dracula-gray/20 bg-dracula-card/50">
          <h3 className="font-bold text-dracula-red text-sm uppercase tracking-wider flex items-center gap-2">
            <Swords size={18} /> Lanzar un Reto
          </h3>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-red transition-colors btn-press"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest flex items-center gap-1">
              <User size={12} /> ¿A quién retas?
            </label>
            <select
              className="w-full bg-dracula-card rounded-xl p-3 text-base text-dracula-light border border-dracula-gray/20 focus:outline-none focus:border-dracula-red cursor-pointer"
              value={challenged}
              onChange={(e) => setChallenged(e.target.value)}
            >
              <option value="" disabled>
                Selecciona a tu contrincante...
              </option>
              {users.map((friend: string) => (
                <option key={friend} value={friend}>
                  {friend}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="duel-game-name" className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest">
              ¿A qué jugáis?
            </label>
            <input
              id="duel-game-name"
              name="duelGame"
              type="text"
              className="w-full bg-dracula-card rounded-xl p-3 text-base text-dracula-light border border-dracula-gray/20 focus:outline-none focus:border-dracula-red"
              placeholder="Juego o disciplina del duelo"
              value={game}
              onChange={(e) => setGame(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="duel-wager-amount" className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest">
              Tokens en juego
            </label>
            <TokenAmountInput
              id="duel-wager-amount"
              name="duelWager"
              min={1}
              value={wager}
              onChange={setWager}
              placeholder="100"
              icon="💰"
              className="w-full bg-dracula-card rounded-xl py-3 pl-9 pr-3 text-base font-bold text-dracula-red border border-dracula-gray/20 focus:outline-none focus:border-dracula-red"
            />
          </div>
        </div>

        <div className="p-4 border-t border-dracula-gray/20 bg-dracula-card/20 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold text-xs text-dracula-light bg-dracula-card hover:bg-dracula-gray/30 btn-press"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex-[2] py-3 rounded-xl font-bold text-xs text-dracula-base bg-dracula-red hover:opacity-90 flex items-center justify-center gap-2 btn-press"
          >
            <Swords size={16} /> Confirmar Reto
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal para informar el resultado al Tribunal arbitral de QuestFest.
 * Congela la partida en estado 'disputed' o 'pending_admin' para que
 * la administración verifique el vencedor legítimo y liquide los fondos.
 */
function DeclareWinnerModal({
  duel,
  currentUser,
  onClose,
  onSuccess,
}: DeclareWinnerModalProps) {
  const isChallenger = duel.challenger === currentUser;
  const opponent = isChallenger ? duel.challenged : duel.challenger;

  const handleResolve = async (resolution: string) => {
    try {
      await api.post(`/api/duelos/${duel.id}/action?action=resolve`, {
        resolution,
      });
      toast.success('Resultado enviado al Tribunal');
      await onSuccess();
      onClose();
    } catch {
      toast.error('Error al enviar el resultado');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dracula-base w-full max-w-sm rounded-2xl shadow-2xl border-2 border-dracula-purple overflow-hidden flex flex-col scale-in-center text-center">
        <div className="bg-dracula-purple/20 py-6 flex flex-col items-center justify-center border-b border-dracula-purple/30 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-dracula-gray hover:text-dracula-red transition-colors btn-press"
          >
            <X size={20} />
          </button>
          <div className="w-14 h-14 bg-dracula-purple rounded-full flex items-center justify-center text-dracula-base shadow-[0_0_20px_rgba(189,147,249,0.5)] mb-2">
            <Scale size={28} />
          </div>
          <h2 className="text-lg font-black text-dracula-light uppercase tracking-widest">
            Informar al Tribunal
          </h2>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-dracula-gray font-medium">
            ¿Quién ha ganado{' '}
            <span className="text-dracula-light font-bold">"{duel.game}"</span>?{' '}
            <br />
            <br />
            Al reportarlo, el duelo quedará congelado hasta que el Administrador
            confirme la victoria y mueva los{' '}
            <span className="text-dracula-yellow font-bold">
              💰 {duel.wager} tokens
            </span>
            .
          </p>

          <div className="flex flex-col gap-3 mt-2">
            <button
              onClick={() =>
                handleResolve(isChallenger ? 'challenger' : 'challenged')
              }
              className="w-full py-4 rounded-xl border border-dracula-green bg-dracula-green/10 text-dracula-green font-black uppercase tracking-wider hover:bg-dracula-green/20 transition-colors flex items-center justify-center gap-2 btn-press"
            >
              <Check size={18} /> He ganado YO
            </button>
            <button
              onClick={() =>
                handleResolve(isChallenger ? 'challenged' : 'challenger')
              }
              className="w-full py-4 rounded-xl border border-dracula-gray/20 bg-dracula-card text-dracula-light font-black uppercase tracking-wider hover:bg-dracula-gray/30 transition-colors flex items-center justify-center gap-2 btn-press"
            >
              Ha ganado {opponent}
            </button>
            <button
              onClick={() => handleResolve('draw')}
              className="w-full py-2 rounded-lg text-xs font-semibold text-dracula-gray hover:text-dracula-light underline decoration-dracula-gray/30 mt-1 btn-press"
            >
              Ha sido un empate / Se canceló
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
