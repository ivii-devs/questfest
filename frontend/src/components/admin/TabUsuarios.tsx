'use client';

/**
 * ============================================================================
 * PESTAÑA DE GESTIÓN DE USUARIOS Y SALDOS (TabUsuarios)
 * ============================================================================
 * Panel de administración para auditoría contable de jugadores,
 * compensaciones (bonificar/multar) e inspección de movimientos del Ledger.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  History,
  X,
} from 'lucide-react';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import { useGroup } from '@/context/GroupContext';
import {
  fetchAdminUsers,
  fetchAdminStats,
  updateUserBalance,
  fetchUserTransactions,
} from '@/services/adminService';
import { Usuario, TransactionResponse, GlobalStatsResponse } from '@/types';

export default function TabUsuarios() {
  const { activeGroup } = useGroup();
  const [stats, setStats] = useState<GlobalStatsResponse>({
    total_users: 0,
    total_tokens: 0,
  });
  const [users, setUsers] = useState<Usuario[]>([]);

  // Modal de Balance
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'Bonificar' | 'Multar'>(
    'Bonificar'
  );
  const [modalUserId, setModalUserId] = useState<number | null>(null);
  const [modalAmount, setModalAmount] = useState<number | ''>('');
  const [modalConcept, setModalConcept] = useState('');

  // Modal de Historial
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<TransactionResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyUserName, setHistoryUserName] = useState('');

  const fetchData = async () => {
    try {
      const usersData = await fetchAdminUsers(activeGroup?.id);
      setUsers(usersData);
    } catch {
      toast.error('Error al cargar la lista de usuarios');
    }

    try {
      const statsData = await fetchAdminStats(activeGroup?.id);
      setStats(statsData);
    } catch (error) {
      console.warn(
        'El endpoint de estadísticas aún no está disponible o falló',
        error
      );
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeGroup?.id]);

  const openBalanceModal = (userId: number, action: 'Bonificar' | 'Multar') => {
    setModalUserId(userId);
    setModalAction(action);
    setModalAmount('');
    setModalConcept(action === 'Bonificar' ? 'Premio Admin' : 'Sanción Admin');
    setIsModalOpen(true);
  };

  const confirmBalance = async () => {
    if (!modalUserId || !modalAmount || !modalConcept) {
      return toast.error('Rellena todos los campos');
    }

    const amount =
      modalAction === 'Bonificar' ? Number(modalAmount) : -Number(modalAmount);
    const toastId = toast.loading('Aplicando...');

    try {
      await updateUserBalance(
        modalUserId,
        amount,
        modalConcept,
        activeGroup?.id
      );
      toast.success('Saldo actualizado', { id: toastId });
      setIsModalOpen(false);
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Error al actualizar saldo', {
        id: toastId,
      });
    }
  };

  const openHistory = async (userId: number, username: string) => {
    setHistoryUserName(username);
    setHistoryData([]);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const transactions = await fetchUserTransactions(userId, activeGroup?.id);
      setHistoryData(transactions);
    } catch {
      toast.error('Error al cargar el historial');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn flex flex-col gap-6 p-4 pb-24">
      {/* ESTADÍSTICAS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-dracula-card flex flex-col items-center justify-center rounded-2xl border border-[#ff79c6]/30 p-4 text-center">
          <Users className="mb-2 text-[#ff79c6]" size={24} />
          <span className="text-dracula-light text-2xl font-black">
            {stats.total_users}
          </span>
          <span className="text-dracula-gray mt-1 text-[10px] font-bold tracking-widest uppercase">
            Jugadores
          </span>
        </div>
        <div className="bg-dracula-card border-dracula-green/30 flex flex-col items-center justify-center rounded-2xl border p-4 text-center">
          <DollarSign className="text-dracula-green mb-2" size={24} />
          <span className="text-dracula-light text-2xl font-black">
            {stats.total_tokens}
          </span>
          <span className="text-dracula-gray mt-1 text-[10px] font-bold tracking-widest uppercase">
            Tokens en curso
          </span>
        </div>
      </div>

      {/* DIRECTORIO */}
      <div className="bg-dracula-card border-dracula-gray/20 overflow-hidden rounded-2xl border">
        <div className="border-dracula-gray/20 flex justify-between border-b p-4 font-bold text-[#ff79c6]">
          <span>Directorio</span>
        </div>
        <div className="flex flex-col">
          {users.map((targetUser) => (
            <div
              key={targetUser.id}
              data-testid={`user-card-${targetUser.username}`}
              className="border-dracula-gray/10 hover:bg-dracula-gray/5 flex flex-col gap-3 border-b p-4 transition-colors last:border-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-dracula-base flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#ff79c6] font-bold">
                    {targetUser.avatar_url ? (
                      <img
                        src={targetUser.avatar_url}
                        alt={targetUser.username}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      targetUser.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-dracula-light text-sm font-bold">
                      @{targetUser.username}
                    </span>
                    <span className="text-dracula-green flex items-center gap-1 text-xs font-semibold">
                      <DollarSign size={10} /> {targetUser.saldo_actual}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    openHistory(targetUser.id, targetUser.username)
                  }
                  className="text-dracula-gray rounded-lg bg-black/30 p-2 transition-colors hover:text-[#8be9fd]"
                  aria-label={`Ver historial de @${targetUser.username}`}
                >
                  <History size={18} />
                </button>
              </div>

              {/* Botones de Acción Horizontales */}
              <div className="mt-2 flex w-full gap-2">
                <button
                  onClick={() => openBalanceModal(targetUser.id, 'Bonificar')}
                  className="bg-dracula-green/10 border-dracula-green/20 text-dracula-green hover:bg-dracula-green/20 flex flex-1 items-center justify-center gap-1 rounded-xl border py-2 text-xs font-bold transition-colors"
                >
                  <ArrowUpRight size={14} /> Bonificar
                </button>
                <button
                  onClick={() => openBalanceModal(targetUser.id, 'Multar')}
                  className="bg-dracula-red/10 border-dracula-red/20 text-dracula-red hover:bg-dracula-red/20 flex flex-1 items-center justify-center gap-1 rounded-xl border py-2 text-xs font-bold transition-colors"
                >
                  <ArrowDownRight size={14} /> Multar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DE BALANCE (BONIFICAR / MULTAR) */}
      {isModalOpen && (
        <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-dracula-card border-dracula-gray/30 relative w-full max-w-sm rounded-2xl border p-5 shadow-xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="text-dracula-gray hover:text-dracula-light absolute top-4 right-4"
            >
              <X size={20} />
            </button>
            <h3
              className={`mb-4 flex items-center gap-2 text-xl font-bold ${
                modalAction === 'Bonificar'
                  ? 'text-dracula-green'
                  : 'text-dracula-red'
              }`}
            >
              {modalAction === 'Bonificar' ? (
                <ArrowUpRight />
              ) : (
                <ArrowDownRight />
              )}
              {modalAction} Saldo
            </h3>

            <div className="mb-6 flex flex-col gap-4">
              <div>
                <label className="text-dracula-gray mb-1 px-1 text-[10px] font-bold tracking-widest uppercase">
                  Cantidad de Tokens
                </label>
                <TokenAmountInput
                  min={1}
                  value={modalAmount}
                  onChange={setModalAmount}
                  placeholder="0"
                  icon={DollarSign}
                  iconColor="text-dracula-gray"
                  className="border-dracula-gray/20 text-dracula-light focus:border-dracula-purple w-full appearance-none rounded-xl border bg-black/50 py-3 pr-3 pl-10 text-sm transition-colors outline-none"
                />
              </div>
              <div>
                <label className="text-dracula-gray mb-1 px-1 text-[10px] font-bold tracking-widest uppercase">
                  Concepto / Motivo
                </label>
                <input
                  type="text"
                  value={modalConcept}
                  onChange={(e) => setModalConcept(e.target.value)}
                  placeholder="Motivo del ajuste"
                  className="border-dracula-gray/20 text-dracula-light focus:border-dracula-purple w-full rounded-xl border bg-black/50 p-3 text-sm transition-colors outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-dracula-gray/20 text-dracula-light hover:bg-dracula-gray/30 flex-1 rounded-xl py-3 text-sm font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmBalance}
                className={`text-dracula-base flex-1 rounded-xl py-3 text-sm font-bold transition-colors ${
                  modalAction === 'Bonificar'
                    ? 'bg-dracula-green hover:bg-dracula-green/80'
                    : 'bg-dracula-red hover:bg-dracula-red/80'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTORIAL */}
      {isHistoryOpen && (
        <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-dracula-card relative flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-[#8be9fd]/30 shadow-xl">
            <div className="border-dracula-gray/20 flex items-center justify-between border-b p-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-[#8be9fd]">
                <History size={20} /> Historial de @{historyUserName}
              </h3>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-dracula-gray hover:text-dracula-light"
              >
                <X size={20} />
              </button>
            </div>

            <div className="hide-scrollbar flex-1 overflow-y-auto p-4">
              {historyLoading ? (
                <div className="text-dracula-gray py-10 text-center text-sm">
                  Cargando movimientos...
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-dracula-gray py-10 text-center text-sm">
                  No hay movimientos registrados.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {historyData.map((tx) => (
                    <div
                      key={tx.id}
                      className="border-dracula-gray/10 flex items-center justify-between rounded-xl border bg-black/40 p-3"
                    >
                      <div className="flex flex-col">
                        <span className="text-dracula-light text-xs font-bold">
                          {tx.concept}
                        </span>
                        <span className="text-dracula-gray text-[10px]">
                          {tx.date}
                        </span>
                      </div>
                      <div
                        className={`flex items-center gap-1 font-bold ${
                          tx.type === 'income'
                            ? 'text-dracula-green'
                            : 'text-dracula-red'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : ''}
                        {tx.amount} <DollarSign size={12} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
