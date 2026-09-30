'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { formatSpanishDate } from '@/lib/formatters';
import { CheckCircle, XCircle, Image as ImageIcon, MessageSquare, Target, ThumbsUp, ThumbsDown } from 'lucide-react';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import { useGroup } from '@/context/GroupContext';

export default function TabMisiones() {
  const [activeTab, setActiveTab] = useState<'sugerencias' | 'tribunal'>('sugerencias');

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="flex border-b border-dracula-gray/30 mb-4">
        <button
          id="admin-subtab-misiones-sugerencias"
          onClick={() => setActiveTab('sugerencias')}
          className={`flex-1 py-3 font-bold text-sm transition-colors ${
            activeTab === 'sugerencias' ? 'text-dracula-yellow border-b-2 border-dracula-yellow' : 'text-dracula-gray hover:text-dracula-light'
          }`}
        >
          Sugerencias Pendientes
        </button>
        <button
          id="admin-subtab-misiones-tribunal"
          onClick={() => setActiveTab('tribunal')}
          className={`flex-1 py-3 font-bold text-sm transition-colors ${
            activeTab === 'tribunal' ? 'text-dracula-purple border-b-2 border-dracula-purple' : 'text-dracula-gray hover:text-dracula-light'
          }`}
        >
          Tribunal de Validación
        </button>
      </div>

      {activeTab === 'sugerencias' ? <SugerenciasView /> : <TribunalView />}
    </div>
  );
}

function SugerenciasView() {
  const { activeGroup } = useGroup();
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // States para edición rápida de sugerencias (id -> value)
  const [edits, setEdits] = useState<Record<string, { reward: number | '' }>>({});

  const fetchSugerencias = async () => {
    try {
      const res = await api.get('/api/admin/misiones/sugerencias', {
        params: activeGroup?.id ? { group_id: activeGroup.id } : {}
      });
      setSugerencias(res.data);
      
      const newEdits: Record<string, { reward: number | '' }> = {};
      res.data.forEach((s: any) => {
        newEdits[s.id] = { reward: s.reward };
      });
      setEdits(newEdits);
    } catch {
      // Notificamos al usuario mediante toast en caso de fallo de red o permisos
      toast.error('Error cargando sugerencias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSugerencias();
  }, [activeGroup?.id]);

  const handleUpdateEdit = (id: string, field: 'reward', value: any) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleAprobar = async (id: string) => {
    try {
      const editData = edits[id];
      const orig = sugerencias.find(s => s.id === id);
      const recompensaVal = editData?.reward === '' ? (orig?.reward ?? 100) : Number(editData?.reward);
      await api.patch(`/api/admin/misiones/${id}/sugerencia/aprobar`, {
        recompensa: recompensaVal
      });
      toast.success('Sugerencia aprobada y publicada');
      fetchSugerencias();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Error aprobando sugerencia';
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Error aprobando sugerencia');
    }
  };

  const handleRechazar = async (id: string) => {
    if (!confirm('¿Seguro que quieres descartar esta sugerencia? Se eliminará de la base de datos.')) return;
    try {
      await api.patch(`/api/admin/misiones/${id}/sugerencia/rechazar`);
      toast.success('Sugerencia descartada');
      fetchSugerencias();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Error rechazando sugerencia';
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Error rechazando sugerencia');
    }
  };

  if (loading) return <div className="text-center text-dracula-gray py-10">Cargando sugerencias...</div>;
  if (sugerencias.length === 0) return <div className="text-center text-dracula-gray py-10">No hay sugerencias pendientes.</div>;

  return (
    <div className="flex flex-col gap-4">
      {sugerencias.map(s => (
        <div key={s.id} className="bg-dracula-card border border-dracula-gray/20 rounded-xl p-4 flex flex-col gap-4">
          <div>
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold text-dracula-light flex items-center gap-2">
                <Target size={18} className="text-dracula-yellow" /> {s.title}
              </h3>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs font-bold text-dracula-green bg-dracula-green/10 px-2 py-1 rounded border border-dracula-green/20">
                  <ThumbsUp size={12} /> {s.upvotes || 0}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-dracula-red bg-dracula-red/10 px-2 py-1 rounded border border-dracula-red/20">
                  <ThumbsDown size={12} /> {s.downvotes || 0}
                </span>
              </div>
            </div>
            <p className="text-xs text-dracula-gray mt-1">Sugerida por @{s.author} • {formatSpanishDate(s.createdAt)}</p>
            <p className="text-sm text-dracula-light mt-3">{s.description}</p>
          </div>
          
          <div className="flex gap-4 p-3 bg-dracula-base rounded-lg border border-dracula-gray/10">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-dracula-gray">Recompensa (Tokens)</label>
              <TokenAmountInput 
                min={1}
                value={edits[s.id]?.reward ?? ''} 
                onChange={(val) => handleUpdateEdit(s.id, 'reward', val)}
                placeholder="100"
                className="w-full bg-dracula-card border border-dracula-gray/30 rounded-lg py-2 pl-9 pr-3 text-sm text-dracula-yellow font-bold focus:outline-none focus:border-dracula-yellow"
              />
            </div>
          </div>
          
          <div className="flex gap-3 mt-2">
            <button 
              onClick={() => handleAprobar(s.id)}
              className="flex-1 bg-dracula-green/20 hover:bg-dracula-green/30 text-dracula-green border border-dracula-green/50 py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} /> Aprobar y Publicar
            </button>
            <button 
              onClick={() => handleRechazar(s.id)}
              className="flex-1 bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border border-dracula-red/30 py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <XCircle size={16} /> Descartar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TribunalView() {
  const { activeGroup } = useGroup();
  const [pruebas, setPruebas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para el prompt de rechazo
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rechazoMotivo, setRechazoMotivo] = useState('');

  const fetchPruebas = async () => {
    try {
      const res = await api.get('/api/admin/misiones/pruebas', {
        params: activeGroup?.id ? { group_id: activeGroup.id } : {}
      });
      setPruebas(res.data);
    } catch {
      // Notificamos al usuario mediante toast si falla la carga de pruebas
      toast.error('Error cargando pruebas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPruebas();
  }, [activeGroup?.id]);

  const handleValidar = async (id: number) => {
    try {
      await api.patch(`/api/admin/misiones/pruebas/${id}/validar`);
      toast.success('Prueba validada y tokens pagados');
      fetchPruebas();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Error validando la prueba';
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Error validando prueba');
    }
  };

  const submitRechazo = async () => {
    if (!rejectingId) return;
    if (!rechazoMotivo.trim()) {
      toast.error('El motivo no puede estar vacío');
      return;
    }
    
    try {
      await api.patch(`/api/admin/misiones/pruebas/${rejectingId}/rechazar`, { motivo: rechazoMotivo });
      toast.success('Prueba rechazada y usuario notificado');
      setRejectingId(null);
      setRechazoMotivo('');
      fetchPruebas();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Error rechazando prueba';
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Error rechazando prueba');
    }
  };

  if (loading) return <div className="text-center text-dracula-gray py-10">Cargando tribunal...</div>;
  if (pruebas.length === 0) return <div className="text-center text-dracula-gray py-10">El Tribunal no tiene casos pendientes.</div>;

  return (
    <div className="flex flex-col gap-6">
      {pruebas.map(p => {
        const isVideo = p.proof_image_url?.match(/\.(mp4|webm|ogg|mov)$/i) || p.proof_image_url?.includes('/video/');
        return (
        <div key={p.id} className="bg-dracula-card border border-dracula-purple/30 rounded-xl overflow-hidden shadow-lg">
          <div className="bg-dracula-base p-4 border-b border-dracula-gray/20 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src={p.usuario_avatar || '/default-avatar.png'} alt={p.usuario} className="w-10 h-10 rounded-full border border-dracula-purple object-cover" />
              <div>
                <span className="text-[10px] uppercase font-bold text-dracula-gray">Reclamante</span>
                <p className="text-sm font-bold text-dracula-light">@{p.usuario}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-dracula-gray block">Recompensa</span>
              <span className="text-sm font-bold text-dracula-yellow bg-dracula-yellow/10 px-2 py-0.5 rounded">💰 {p.mision_reward}</span>
            </div>
          </div>
          
          <div className="p-4 flex flex-col gap-4">
            <div>
              <span className="text-[10px] font-bold text-dracula-gray uppercase block mb-1">Misión Reclamada</span>
              <h4 className="font-bold text-dracula-light text-md">{p.mision_title}</h4>
              <p className="text-xs text-dracula-gray mt-1">Enviado: {formatSpanishDate(p.createdAt)}</p>
            </div>
            
            {(p.proof_text || p.proof_image_url) && (
              <div className="bg-dracula-base p-3 rounded-lg border border-dracula-gray/10 flex flex-col gap-3">
                <span className="text-[10px] font-bold text-dracula-purple uppercase tracking-widest flex items-center gap-1">
                  <MessageSquare size={12} /> Pruebas Presentadas
                </span>
                
                {p.proof_text && (
                  <p className="text-sm text-dracula-light italic bg-dracula-card p-3 rounded border border-dracula-gray/20">
                    "{p.proof_text}"
                  </p>
                )}
                
                {p.proof_image_url && (
                  <div className="mt-2">
                    {isVideo ? (
                      <video src={p.proof_image_url} controls className="block w-full h-48 bg-dracula-card rounded-lg object-contain border border-dracula-gray/20" />
                    ) : (
                      <a href={p.proof_image_url} target="_blank" rel="noreferrer" className="block w-full h-48 bg-dracula-card rounded-lg overflow-hidden border border-dracula-gray/20 hover:border-dracula-purple transition-colors relative group">
                        <img src={p.proof_image_url} alt="Prueba" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="bg-dracula-base/80 text-dracula-light px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                            <ImageIcon size={14} /> Ver Imagen Completa
                          </span>
                        </div>
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {rejectingId === p.id ? (
              <div className="bg-dracula-red/10 border border-dracula-red/30 p-4 rounded-xl flex flex-col gap-3 mt-2 animate-fadeIn">
                <label className="text-xs font-bold text-dracula-red uppercase">Motivo del rechazo</label>
                <textarea 
                  value={rechazoMotivo}
                  onChange={(e) => setRechazoMotivo(e.target.value)}
                  className="w-full bg-dracula-base border border-dracula-red/20 rounded p-3 text-sm text-dracula-light focus:outline-none focus:border-dracula-red resize-none h-20"
                  placeholder="Motivo del rechazo de la prueba..."
                />
                <div className="flex gap-2">
                  <button onClick={() => setRejectingId(null)} className="flex-1 py-2 text-xs font-bold text-dracula-gray bg-dracula-base rounded hover:text-dracula-light border border-dracula-gray/20">
                    Cancelar
                  </button>
                  <button onClick={submitRechazo} className="flex-1 py-2 text-xs font-bold bg-dracula-red text-dracula-base rounded hover:opacity-90">
                    Confirmar Rechazo
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 mt-2">
                <button 
                  onClick={() => handleValidar(p.id)}
                  className="flex-1 bg-dracula-green hover:bg-dracula-green/90 text-dracula-base py-3 rounded-xl font-bold text-xs transition-colors shadow-[0_0_15px_rgba(80,250,123,0.3)] flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} /> Validar y Pagar
                </button>
                <button 
                  onClick={() => setRejectingId(p.id)}
                  className="flex-1 bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border border-dracula-red/30 py-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle size={18} /> Rechazar Prueba
                </button>
              </div>
            )}
          </div>
        </div>
      );})}
    </div>
  );
}
