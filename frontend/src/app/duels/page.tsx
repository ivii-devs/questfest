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
import { Swords, Plus, History } from 'lucide-react';
import api from '@/lib/axios';
import PullToRefresh from '@/components/PullToRefresh';
import DuelCard from '@/components/DuelCard';
import { useGroup } from '@/context/GroupContext';
import GroupSwitcher from '@/components/groups/GroupSwitcher';
import CreateDuelModal from '@/components/duels/CreateDuelModal';
import DeclareWinnerModal from '@/components/duels/DeclareWinnerModal';
import { DueloResponse } from '@/types';

export type DuelItem = DueloResponse;

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

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function DuelsPage() {
  const { activeGroup } = useGroup();

  // Pestaña principal: retos activos vs registro de batallas pasadas
  const [activeTab, setActiveTab] = useState<'activos' | 'historial'>(
    'activos'
  );

  // Sub-filtro de duelos activos para priorizar la interacción del usuario
  const [duelFilter, setDuelFilter] = useState<'todos' | 'mios' | 'pendientes'>(
    'todos'
  );

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
    <div className="app-shell-page text-dracula-light bg-black select-none">
      {/* --- CABECERA FIJA CON SELECTOR DE GRUPO Y ÁREA SEGURA --- */}
      <header className="bg-dracula-base/95 app-shell-header border-dracula-gray/20 pt-safe-top z-40 flex-shrink-0 border-b px-4 pb-3 backdrop-blur-md select-none">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Swords size={26} className="text-dracula-red" />
            <div>
              <h1 className="text-dracula-light text-lg font-black tracking-wide uppercase">
                Duelos
              </h1>
              <span className="text-dracula-gray block text-[10px] font-bold">
                {activeGroup?.nombre || 'Comunidad'}
              </span>
            </div>
          </div>
          <GroupSwitcher />
        </div>

        <div className="border-dracula-gray/30 mb-3 flex w-full border-b">
          <button
            onClick={() => setActiveTab('activos')}
            className={`btn-press flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
              activeTab === 'activos'
                ? 'text-dracula-red border-dracula-red border-b-2'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            En Curso
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`btn-press flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
              activeTab === 'historial'
                ? 'text-dracula-purple border-dracula-purple border-b-2'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            Historial
          </button>
        </div>

        {/* Sub-filtros (Solo en Activos) */}
        {activeTab === 'activos' && (
          <div className="hide-scrollbar animate-fadeIn flex gap-2 overflow-x-auto pb-3">
            <button
              onClick={() => setDuelFilter('todos')}
              className={`btn-press rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${
                duelFilter === 'todos'
                  ? 'bg-dracula-red text-dracula-base'
                  : 'bg-dracula-card text-dracula-light border-dracula-gray/20 border'
              }`}
            >
              Global
            </button>
            <button
              onClick={() => setDuelFilter('mios')}
              className={`btn-press rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${
                duelFilter === 'mios'
                  ? 'bg-dracula-yellow text-dracula-base'
                  : 'bg-dracula-card text-dracula-light border-dracula-gray/20 border'
              }`}
            >
              Mis Batallas
            </button>
            <button
              onClick={() => setDuelFilter('pendientes')}
              className={`btn-press flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${
                duelFilter === 'pendientes'
                  ? 'bg-dracula-purple text-dracula-light'
                  : 'bg-dracula-card text-dracula-light border-dracula-gray/20 border'
              }`}
            >
              Me Toca Responder
            </button>
          </div>
        )}
      </header>

      {/* --- RENDERIZADO DE PESTAÑAS CON SCROLL INTERNO AISLADO --- */}
      <PullToRefresh onRefresh={fetchDuels}>
        <main className="app-shell-scroll flex flex-col gap-4 p-4 pb-28">
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
            <HistoryDuelsView duels={historyDuels} currentUser={currentUser} />
          )}
        </main>
      </PullToRefresh>

      {/* --- BOTÓN FLOTANTE (FAB) CON MICROPULSACIÓN TÁCTIL --- */}
      <button
        onClick={() => setIsChallengeModalOpen(true)}
        className="bg-dracula-red text-dracula-base btn-press fixed right-4 bottom-20 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_0_20px_rgba(255,85,85,0.4)]"
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
      <div className="text-dracula-gray mt-10 text-center text-sm">
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
    if (historyFilter === 'perdidas')
      return duel.winner && duel.winner !== currentUser;
    if (historyFilter === 'empatadas_multa')
      return duel.reported_resolution === 'tie_with_penalty';
    if (historyFilter === 'con_multa')
      return (
        duel.reported_resolution === 'penalized_challenger' ||
        duel.reported_resolution === 'penalized_challenged'
      );
    if (historyFilter === 'rechazadas')
      return duel.status === 'rejected' || duel.status === 'declined';
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
      <div className="text-dracula-gray mb-2 flex items-center justify-center gap-2 text-xs font-semibold">
        <History size={14} /> Registro de batallas cerradas
      </div>

      <div className="hide-scrollbar mb-2 flex gap-2 overflow-x-auto px-1 pb-3">
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
            className={`btn-press rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${
              historyFilter === filter.id
                ? 'bg-dracula-purple text-dracula-base'
                : 'bg-dracula-card text-dracula-light border-dracula-gray/20 hover:border-dracula-purple/50 border'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {sortedDuels.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-dracula-gray text-sm">
            No hay duelos en esta categoría.
          </p>
        </div>
      ) : (
        sortedDuels.map((duel) => (
          <DuelCard key={duel.id} duel={duel} currentUser={currentUser} />
        ))
      )}
    </>
  );
}
