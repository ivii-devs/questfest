'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { Clock, Send, Users, User, X, Check, Eye } from 'lucide-react';
import DailySummaryModal from '../DailySummaryModal';
import { useGroup } from '@/context/GroupContext';

export default function TabNotificaciones() {
  const { activeGroup } = useGroup();
  const [activeSubTab, setActiveSubTab] = useState<'inmediato' | 'boletin'>('inmediato');

  // ---- ESTADO DE AVISO INMEDIATO ----
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [destinatario, setDestinatario] = useState('all');
  
  // Validacion
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [validationUsers, setValidationUsers] = useState<any[]>([]);
  const [validationLoading, setValidationLoading] = useState(false);
  const [specificUserId, setSpecificUserId] = useState<number | null>(null);

  // Historial
  const [history, setHistory] = useState<any[]>([]);

  // ---- ESTADO DE BOLETÍN ----
  const [horaBoletin, setHoraBoletin] = useState('17:00');
  const [phaseBoletin, setPhaseBoletin] = useState('Noche 1');
  const [bulletinConfig, setBulletinConfig] = useState({
    phase: true,
    firstPlace: true,
    lastPlace: true,
    mostBetsWon: true,
    mostMissions: true,
    duelWinner: true,
    biggestWinner: true,
    biggestLoser: true
  });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
    fetchBoletinConfig();
  }, [activeGroup?.id]);

  const fetchBoletinConfig = async () => {
    try {
      const res = await api.get('/api/settings/boletin', {
        params: activeGroup ? { group_id: activeGroup.id } : {}
      });
      if (res.data) {
        if (res.data.hora) setHoraBoletin(res.data.hora);
        if (res.data.phaseValue) setPhaseBoletin(res.data.phaseValue);
        setBulletinConfig(prev => ({
          ...prev,
          ...res.data
        }));
      }
    } catch {
      // Ignorar fallos de carga inicial de config
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/api/admin/notifications');
      setHistory(res.data);
    } catch {
      // Advertencia en consola si el historial no responde
      console.warn("No se pudo cargar el historial de notificaciones");
    }
  };

  const openValidationModal = async () => {
    if (!titulo || !mensaje) return toast.error('Rellena los campos obligatorios');
    
    setIsValidationOpen(true);
    setValidationLoading(true);
    setValidationUsers([]);
    setSpecificUserId(null);

    try {
      if (destinatario === 'specific_user') {
        const res = await api.get('/api/admin/users');
        setValidationUsers(res.data);
      } else {
        const res = await api.post('/api/admin/notifications/preview-audience', {
          destinatario_tipo: destinatario
        });
        setValidationUsers(res.data);
      }
    } catch {
      // Notificar error al usuario y cerrar el modal si falla el cálculo de audiencia
      toast.error('Error al calcular la audiencia');
      setIsValidationOpen(false);
    } finally {
      setValidationLoading(false);
    }
  };

  const handleSendInmediato = async () => {
    if (destinatario === 'specific_user' && !specificUserId) {
      return toast.error('Selecciona el usuario específico');
    }

    const toastId = toast.loading('Enviando...');
    try {
      await api.post('/api/admin/notifications', {
        titulo,
        mensaje,
        destinatario_tipo: destinatario === 'specific_user' ? 'specific' : destinatario,
        destinatario_id: specificUserId,
      });
      toast.success('Aviso enviado a ' + (destinatario === 'specific_user' ? '1 usuario' : validationUsers.length + ' usuarios'), { id: toastId });
      setTitulo(''); setMensaje('');
      setIsValidationOpen(false);
      fetchHistory();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Error al enviar', { id: toastId });
    }
  };

  const handlePreviewBoletin = async () => {
    const toastId = toast.loading('Generando vista previa...');
    try {
      const res = await api.get('/api/admin/summary-stats', {
        params: activeGroup ? { group_id: activeGroup.id } : {}
      });
      const fullData = res.data;
      
      // Filter based on config
      const filteredData: any = {};
      if (bulletinConfig.phase) filteredData.phase = phaseBoletin;
      if (bulletinConfig.firstPlace) filteredData.firstPlace = fullData.firstPlace;
      if (bulletinConfig.lastPlace) filteredData.lastPlace = fullData.lastPlace;
      if (bulletinConfig.mostBetsWon) filteredData.mostBetsWon = fullData.mostBetsWon;
      if (bulletinConfig.mostMissions) filteredData.mostMissions = fullData.mostMissions;
      if (bulletinConfig.duelWinner) filteredData.duelWinner = fullData.duelWinner;
      if (bulletinConfig.biggestWinner) filteredData.biggestWinner = fullData.biggestWinner;
      if (bulletinConfig.biggestLoser) filteredData.biggestLoser = fullData.biggestLoser;

      setPreviewData(filteredData);
      setIsPreviewOpen(true);
      toast.dismiss(toastId);
    } catch {
      // Notificar error al usuario sobre la vista previa
      toast.error('Error al generar vista previa', { id: toastId });
    }
  };

  const handleProgramBoletin = async () => {
    const toastId = toast.loading('Guardando configuración...');
    try {
      await api.put('/api/settings/boletin', {
        hora: horaBoletin,
        phaseValue: phaseBoletin,
        group_id: activeGroup?.id,
        ...bulletinConfig
      }, {
        params: activeGroup ? { group_id: activeGroup.id } : {}
      });
      toast.success('Boletín recurrente guardado a las ' + horaBoletin, { id: toastId });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Error al guardar', { id: toastId });
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 animate-fadeIn pb-24">
      
      {/* SUB-TABS */}
      <div className="flex gap-2 bg-black/50 p-1 rounded-xl border border-dracula-gray/20">
        <button onClick={() => setActiveSubTab('inmediato')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex justify-center items-center gap-2 ${activeSubTab === 'inmediato' ? 'bg-[#8be9fd] text-dracula-base' : 'text-dracula-gray'}`}>
          <Send size={16}/> Aviso Inmediato
        </button>
        <button onClick={() => setActiveSubTab('boletin')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex justify-center items-center gap-2 ${activeSubTab === 'boletin' ? 'bg-[#8be9fd] text-dracula-base' : 'text-dracula-gray'}`}>
          <Clock size={16}/> Boletín Diario
        </button>
      </div>

      {/* VISTA AVISO INMEDIATO */}
      {activeSubTab === 'inmediato' && (
        <>
          <div className="bg-dracula-card rounded-2xl p-4 border border-[#8be9fd]/30 shadow-[0_0_15px_rgba(139,233,253,0.1)]">
            <h3 className="text-[#8be9fd] font-bold mb-4">Redactar Push Inmediato</h3>
            
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título del aviso" className="w-full bg-black/50 border border-dracula-gray/20 rounded-xl p-3 text-sm text-dracula-light focus:border-[#8be9fd] outline-none mb-3 transition-colors" />
            <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Mensaje..." className="w-full bg-black/50 border border-dracula-gray/20 rounded-xl p-3 text-sm text-dracula-light focus:border-[#8be9fd] outline-none h-24 mb-4 resize-none transition-colors" />

            <div className="flex flex-col mb-4">
              <label className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest mb-2 px-1">Audiencia Objetivo</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'all', label: 'Todo el grupo' },
                  { id: 'no_bet', label: 'No han apostado' },
                  { id: 'bankrupt', label: 'En bancarrota' },
                  { id: 'specific_user', label: 'Usuario Específico' }
                ].map((opt) => (
                  <label key={opt.id} onClick={() => setDestinatario(opt.id)} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${destinatario === opt.id ? 'bg-[#8be9fd]/10 border-[#8be9fd]' : 'bg-black/50 border-dracula-gray/20'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${destinatario === opt.id ? 'border-[#8be9fd]' : 'border-dracula-gray'}`}>
                      {destinatario === opt.id && <div className="w-2 h-2 rounded-full bg-[#8be9fd] animate-fadeIn" />}
                    </div>
                    <span className={`text-xs font-bold ${destinatario === opt.id ? 'text-dracula-light' : 'text-dracula-gray'}`}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={openValidationModal} className="w-full p-3 rounded-xl font-bold flex justify-center items-center gap-2 text-dracula-base bg-[#8be9fd] hover:bg-[#8be9fd]/80 transition-colors">
              <Send size={18}/> Continuar y Validar
            </button>
          </div>

          {/* Historial Inmediato */}
          <div className="bg-dracula-card rounded-2xl p-4 border border-dracula-gray/20">
            <h3 className="text-dracula-gray font-bold text-sm mb-3">Últimos Envíos</h3>
            <div className="flex flex-col gap-2">
              {history.slice(0, 5).map(h => (
                <div key={h.id} className="p-3 bg-black/40 rounded-xl flex justify-between items-center border border-dracula-gray/10">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-dracula-light">{h.titulo}</span>
                    <span className="text-[10px] text-dracula-gray">Destino: {h.destinatario_tipo}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-md font-bold ${h.estado === 'sent' ? 'bg-dracula-green/20 text-dracula-green' : 'bg-dracula-yellow/20 text-dracula-yellow'}`}>
                    {h.estado}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* VISTA BOLETÍN */}
      {activeSubTab === 'boletin' && (
        <div className="bg-dracula-card rounded-2xl p-4 border border-[#8be9fd]/30 shadow-[0_0_15px_rgba(139,233,253,0.1)]">
          <h3 className="text-[#8be9fd] font-bold mb-4">Constructor de Boletín</h3>
          
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest mb-1 px-1">Fase del Juego</label>
              <input type="text" value={phaseBoletin} onChange={e => setPhaseBoletin(e.target.value)} className="w-full bg-black/50 border border-dracula-gray/20 rounded-xl p-3 text-sm text-dracula-light focus:border-[#8be9fd] outline-none transition-colors" />
            </div>
            <div className="w-32">
              <label className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest mb-1 px-1">Hora Envío</label>
              <input type="time" value={horaBoletin} onChange={e => setHoraBoletin(e.target.value)} className="w-full bg-black/50 border border-dracula-gray/20 rounded-xl p-3 text-sm text-dracula-light focus:border-[#8be9fd] outline-none transition-colors appearance-none" />
            </div>
          </div>

          <label className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest mb-2 px-1 block">Bloques de Estadísticas (Checkboxes)</label>
          <div className="flex flex-col gap-2 mb-6">
            {[
              { id: 'phase', label: 'Mostrar Etiqueta de Fase (Ej: Noche 1)' },
              { id: 'firstPlace', label: 'Top 1 (Líder Actual)' },
              { id: 'lastPlace', label: 'Último Lugar (Farolillo Rojo)' },
              { id: 'mostBetsWon', label: 'Más Apuestas Ganadas (Acertado)' },
              { id: 'mostMissions', label: 'Más Misiones Completadas' },
              { id: 'duelWinner', label: 'Destrozó en un Duelo' },
              { id: 'biggestWinner', label: 'Mayor Subida (Se Forró)' },
              { id: 'biggestLoser', label: 'Mayor Caída (Se Arruinó)' }
            ].map(opt => (
              <label key={opt.id} className="flex items-center gap-3 p-3 rounded-xl bg-black/50 border border-dracula-gray/20 cursor-pointer hover:border-[#8be9fd]/50 transition-colors">
                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${bulletinConfig[opt.id as keyof typeof bulletinConfig] ? 'bg-[#8be9fd] border-[#8be9fd]' : 'border-dracula-gray'}`}>
                  {bulletinConfig[opt.id as keyof typeof bulletinConfig] && <Check size={14} className="text-dracula-base" strokeWidth={3} />}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={bulletinConfig[opt.id as keyof typeof bulletinConfig]} 
                  onChange={(e) => setBulletinConfig({...bulletinConfig, [opt.id]: e.target.checked})} 
                />
                <span className="text-xs font-bold text-dracula-light">{opt.label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={handlePreviewBoletin} className="flex-1 p-3 rounded-xl font-bold flex justify-center items-center gap-2 text-dracula-base bg-dracula-purple hover:bg-dracula-purple/80 transition-colors">
              <Eye size={18}/> Vista Previa
            </button>
            <button onClick={handleProgramBoletin} className="flex-1 p-3 rounded-xl font-bold flex justify-center items-center gap-2 text-dracula-base bg-[#8be9fd] hover:bg-[#8be9fd]/80 transition-colors">
              <Clock size={18}/> Programar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE VALIDACIÓN AVISO INMEDIATO */}
      {isValidationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-dracula-card w-full max-w-sm rounded-2xl border border-[#8be9fd]/50 p-5 shadow-[0_0_30px_rgba(139,233,253,0.2)] relative flex flex-col">
            <button onClick={() => setIsValidationOpen(false)} className="absolute top-4 right-4 text-dracula-gray hover:text-dracula-light">
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold mb-2 text-[#8be9fd] flex items-center gap-2">
              <Users /> Validar Audiencia
            </h3>
            
            <p className="text-xs text-dracula-gray mb-4">
              {destinatario === 'specific_user' 
                ? 'Selecciona exactamente a quién quieres enviarle este aviso:' 
                : `Se ha detectado a ${validationUsers.length} usuarios que cumplen tu criterio:`}
            </p>

            <div className="flex-1 overflow-y-auto max-h-[40vh] mb-4 bg-black/30 rounded-xl border border-dracula-gray/20 p-2 hide-scrollbar">
              {validationLoading ? (
                <div className="text-center text-dracula-gray text-xs py-10 animate-pulse">Calculando audiencia...</div>
              ) : destinatario === 'specific_user' ? (
                <div className="flex flex-col gap-1">
                  {validationUsers.map(u => (
                    <label key={u.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${specificUserId === u.id ? 'bg-[#8be9fd]/20 border border-[#8be9fd]' : 'hover:bg-dracula-gray/10 border border-transparent'}`}>
                      <input type="radio" name="specificUser" className="hidden" onChange={() => setSpecificUserId(u.id)} />
                      <div className="w-8 h-8 rounded-full bg-[#8be9fd] flex items-center justify-center font-bold text-dracula-base text-xs">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-bold text-dracula-light">@{u.username}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {validationUsers.length === 0 && <div className="text-center text-dracula-gray text-xs py-10">Ningún usuario cumple este criterio.</div>}
                  {validationUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2 border-b border-dracula-gray/10 last:border-0">
                      <User size={14} className="text-dracula-gray"/>
                      <span className="text-xs font-bold text-dracula-light">@{u.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={handleSendInmediato} 
              disabled={destinatario === 'specific_user' && !specificUserId}
              className="w-full py-3 rounded-xl font-bold text-sm text-dracula-base bg-[#8be9fd] hover:bg-[#8be9fd]/80 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              <Send size={16}/> Confirmar y Enviar
            </button>
          </div>
        </div>
      )}

      {/* RENDERIZADO DEL BOLETIN PARA VISTA PREVIA */}
      <DailySummaryModal 
        forceOpen={isPreviewOpen} 
        previewData={previewData} 
        onClosePreview={() => setIsPreviewOpen(false)} 
      />

    </div>
  );
}
