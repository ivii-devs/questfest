'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { Users, DollarSign, ArrowUpRight, ArrowDownRight, History, X } from 'lucide-react';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import { useGroup } from '@/context/GroupContext';

export default function TabUsuarios() {
  const { activeGroup } = useGroup();
  const [stats, setStats] = useState({ total_users: 0, total_tokens: 0 });
  const [users, setUsers] = useState<any[]>([]);

  // Modal de Balance
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'Bonificar' | 'Multar'>('Bonificar');
  const [modalUserId, setModalUserId] = useState<number | null>(null);
  const [modalAmount, setModalAmount] = useState<number | ''>('');
  const [modalConcept, setModalConcept] = useState('');

  // Modal de Historial
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyUserName, setHistoryUserName] = useState('');

  const fetchData = async () => {
    try {
      const u = await api.get('/api/admin/users', {
        params: activeGroup?.id ? { group_id: activeGroup.id } : {}
      });
      setUsers(u.data);
    } catch {
      // Notificar al usuario si la lista de usuarios no se pudo obtener
      toast.error('Error al cargar la lista de usuarios');
    }

    try {
      const s = await api.get('/api/admin/users/stats', {
        params: activeGroup?.id ? { group_id: activeGroup.id } : {}
      });
      setStats(s.data);
    } catch (error) {
      console.warn('El endpoint de estadísticas aún no está disponible o falló', error);
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

    const amount = modalAction === 'Bonificar' ? Number(modalAmount) : -Number(modalAmount);
    const toastId = toast.loading('Aplicando...');

    try {
      await api.post(`/api/admin/users/${modalUserId}/balance`, { 
        cantidad: amount, 
        concepto: modalConcept,
        group_id: activeGroup?.id
      });
      toast.success('Saldo actualizado', { id: toastId });
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Error al actualizar saldo', { id: toastId });
    }
  };

  const openHistory = async (userId: number, username: string) => {
    setHistoryUserName(username);
    setHistoryData([]);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/api/admin/users/${userId}/transactions`, {
        params: activeGroup?.id ? { group_id: activeGroup.id } : {}
      });
      setHistoryData(res.data);
    } catch {
      // Notificar al usuario si la carga de transacciones históricas falla
      toast.error('Error al cargar el historial');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 animate-fadeIn pb-24">
      {/* ESTADISTICAS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-dracula-card border border-[#ff79c6]/30 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
          <Users className="text-[#ff79c6] mb-2" size={24}/>
          <span className="text-2xl font-black text-dracula-light">{stats.total_users}</span>
          <span className="text-[10px] uppercase font-bold text-dracula-gray tracking-widest mt-1">Jugadores</span>
        </div>
        <div className="bg-dracula-card border border-dracula-green/30 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
          <DollarSign className="text-dracula-green mb-2" size={24}/>
          <span className="text-2xl font-black text-dracula-light">{stats.total_tokens}</span>
          <span className="text-[10px] uppercase font-bold text-dracula-gray tracking-widest mt-1">Tokens en curso</span>
        </div>
      </div>

      {/* DIRECTORIO */}
      <div className="bg-dracula-card rounded-2xl border border-dracula-gray/20 overflow-hidden">
        <div className="p-4 border-b border-dracula-gray/20 font-bold flex justify-between text-[#ff79c6]">
          <span>Directorio</span>
        </div>
        <div className="flex flex-col">
          {users.map(u => (
            <div key={u.id} data-testid={`user-card-${u.username}`} className="p-4 border-b border-dracula-gray/10 flex flex-col gap-3 last:border-0 hover:bg-dracula-gray/5 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#ff79c6] flex items-center justify-center font-bold text-dracula-base overflow-hidden">
                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover"/> : u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-dracula-light">@{u.username}</span>
                    <span className="text-xs font-semibold text-dracula-green flex items-center gap-1"><DollarSign size={10}/> {u.saldo_actual}</span>
                  </div>
                </div>
                <button onClick={() => openHistory(u.id, u.username)} className="text-dracula-gray hover:text-[#8be9fd] p-2 transition-colors rounded-lg bg-black/30">
                  <History size={18} />
                </button>
              </div>

              {/* Botones de Acción Horizontales */}
              <div className="flex gap-2 w-full mt-2">
                <button onClick={() => openBalanceModal(u.id, 'Bonificar')} className="flex-1 py-2 rounded-xl bg-dracula-green/10 border border-dracula-green/20 text-dracula-green font-bold text-xs flex items-center justify-center gap-1 hover:bg-dracula-green/20 transition-colors">
                  <ArrowUpRight size={14} /> Bonificar
                </button>
                <button onClick={() => openBalanceModal(u.id, 'Multar')} className="flex-1 py-2 rounded-xl bg-dracula-red/10 border border-dracula-red/20 text-dracula-red font-bold text-xs flex items-center justify-center gap-1 hover:bg-dracula-red/20 transition-colors">
                  <ArrowDownRight size={14} /> Multar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DE BALANCE (BONIFICAR / MULTAR) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-dracula-card w-full max-w-sm rounded-2xl border border-dracula-gray/30 p-5 shadow-xl relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-dracula-gray hover:text-dracula-light">
              <X size={20} />
            </button>
            <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${modalAction === 'Bonificar' ? 'text-dracula-green' : 'text-dracula-red'}`}>
              {modalAction === 'Bonificar' ? <ArrowUpRight /> : <ArrowDownRight />}
              {modalAction} Saldo
            </h3>

            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest mb-1 px-1">Cantidad de Tokens</label>
                <TokenAmountInput
                  min={1}
                  value={modalAmount}
                  onChange={setModalAmount}
                  placeholder="0"
                  icon={DollarSign}
                  iconColor="text-dracula-gray"
                  className="w-full bg-black/50 border border-dracula-gray/20 rounded-xl py-3 pl-10 pr-3 text-sm text-dracula-light outline-none focus:border-dracula-purple transition-colors appearance-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest mb-1 px-1">Concepto / Motivo</label>
                <input type="text" value={modalConcept} onChange={e => setModalConcept(e.target.value)} placeholder="Motivo del ajuste" className="w-full bg-black/50 border border-dracula-gray/20 rounded-xl p-3 text-sm text-dracula-light outline-none focus:border-dracula-purple transition-colors" />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl bg-dracula-gray/20 text-dracula-light font-bold text-sm hover:bg-dracula-gray/30 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmBalance} className={`flex-1 py-3 rounded-xl font-bold text-sm text-dracula-base transition-colors ${modalAction === 'Bonificar' ? 'bg-dracula-green hover:bg-dracula-green/80' : 'bg-dracula-red hover:bg-dracula-red/80'}`}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTORIAL */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-dracula-card w-full max-w-md max-h-[80vh] rounded-2xl border border-[#8be9fd]/30 shadow-xl relative flex flex-col">
            <div className="p-4 border-b border-dracula-gray/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#8be9fd] flex items-center gap-2">
                <History size={20} /> Historial de @{historyUserName}
              </h3>
              <button onClick={() => setIsHistoryOpen(false)} className="text-dracula-gray hover:text-dracula-light">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 hide-scrollbar">
              {historyLoading ? (
                <div className="text-center text-dracula-gray text-sm py-10">Cargando movimientos...</div>
              ) : historyData.length === 0 ? (
                <div className="text-center text-dracula-gray text-sm py-10">No hay movimientos registrados.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {historyData.map(tx => (
                    <div key={tx.id} className="flex justify-between items-center p-3 rounded-xl bg-black/40 border border-dracula-gray/10">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-dracula-light">{tx.concept}</span>
                        <span className="text-[10px] text-dracula-gray">{tx.date}</span>
                      </div>
                      <div className={`font-bold flex items-center gap-1 ${tx.type === 'income' ? 'text-dracula-green' : 'text-dracula-red'}`}>
                        {tx.type === 'income' ? '+' : ''}{tx.amount} <DollarSign size={12}/>
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
