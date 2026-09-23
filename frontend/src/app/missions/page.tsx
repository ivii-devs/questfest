'use client';

/**
 * ============================================================================
 * VISTA PRINCIPAL DE MISIONES Y DESAFÍOS: QuestFest PWA
 * ============================================================================
 * Centro de retos comunitarios gamificados con tres pestañas:
 * 
 * 1. Tablón Activo ('activas'): Misiones en curso disponibles para ser completadas.
 *    Las misiones diarias de ruleta tienen prioridad visual destacada al inicio.
 * 2. Sugerencias ('propuestas'): Espacio colaborativo donde los usuarios proponen
 *    nuevas misiones y la comunidad vota a favor o en contra.
 * 3. Historial ('cerradas'): Misiones completadas, expiradas o archivadas.
 * 
 * Flujo de reclamación:
 * El usuario adjunta pruebas multimedia (foto/video vía Cloudinary) y una justificación
 * que queda pendiente de veredicto por el Administrador/Tribunal.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { Target, Plus, CheckCircle, X, Image as ImageIcon, Send } from 'lucide-react';
import api from '@/lib/axios';
import PullToRefresh from '@/components/PullToRefresh';
import MissionCard from '@/components/MissionCard';
import toast from 'react-hot-toast';
import { useGroup } from '@/context/GroupContext';
import GroupSwitcher from '@/components/groups/GroupSwitcher';
import TokenAmountInput from '@/components/ui/TokenAmountInput';

export interface MissionItem {
  id: number | string;
  title: string;
  description: string;
  reward: number;
  is_roulette?: boolean;
  group_id?: number | null;
  status?: string;
  votes_up?: number;
  votes_down?: number;
  user_vote?: 'up' | 'down' | null;
  proposer_username?: string;
  completed_by?: string;
  completed_at?: string;
  proof_text?: string;
  proof_image_url?: string;
}

interface ActiveMissionsViewProps {
  missions: MissionItem[];
  onOpenCompletionModal: (mission: MissionItem) => void;
}

interface ProposedMissionsViewProps {
  proposals: MissionItem[];
  onVote: (id: string, voteType: 'up' | 'down') => Promise<void>;
}

interface ClosedMissionsViewProps {
  missions: MissionItem[];
}

interface CompleteMissionModalProps {
  mission: MissionItem;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

interface SuggestMissionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  groupId?: number;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function MissionsPage() {
  const { activeGroup } = useGroup();
  
  // Pestaña de navegación activa
  const [activeTab, setActiveTab] = useState<'activas' | 'propuestas' | 'cerradas'>('activas');

  // Estados de listados de misiones según su ciclo de vida
  const [activeMissions, setActiveMissions] = useState<MissionItem[]>([]);
  const [proposedMissions, setProposedMissions] = useState<MissionItem[]>([]);
  const [closedMissions, setClosedMissions] = useState<MissionItem[]>([]);

  /**
   * Carga las misiones desde la API filtradas por el grupo activo.
   * Se ejecuta al alternar pestañas o al cambiar la comunidad en el header.
   */
  const fetchMissions = async () => {
    try {
      const params = activeGroup ? { group_id: activeGroup.id } : {};
      if (activeTab === 'activas') {
        const res = await api.get('/api/misiones/', { params });
        setActiveMissions(res.data);
      } else if (activeTab === 'propuestas') {
        const res = await api.get('/api/misiones/suggested', { params });
        setProposedMissions(res.data);
      } else if (activeTab === 'cerradas') {
        const res = await api.get('/api/misiones/closed', { params });
        setClosedMissions(res.data);
      }
    } catch (error) {
      console.error('Error fetching missions:', error);
    }
  };

  useEffect(() => {
    fetchMissions();
  }, [activeTab, activeGroup?.id]);

  // Modales de validación de prueba y propuesta ciudadana
  const [completionModalMission, setCompletionModalMission] = useState<MissionItem | null>(null);
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);

  /**
   * Emite un voto ('up' o 'down') hacia una propuesta de la comunidad.
   * Maneja errores tipados retornados por FastAPI (detalles de validación Pydantic).
   */
  const handleVoteProposal = async (id: string, voteType: 'up' | 'down') => {
    try {
      await api.post(`/api/misiones/${id}/vote`, { vote_type: voteType });
      toast.success('Voto registrado');
      await fetchMissions();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string | Array<{ msg: string }> } } };
      const detail = err.response?.data?.detail;
      const errorMsg =
        Array.isArray(detail) && detail.length > 0
          ? detail[0].msg
          : typeof detail === 'string'
          ? detail
          : 'Error al registrar el voto';
      toast.error(errorMsg);
    }
  };

  const handleProofSubmitted = () => {
    setCompletionModalMission(null);
    fetchMissions();
  };

  return (
    <div className="app-shell-page bg-black text-dracula-light select-none">
      {/* Cabecera Fija con soporte de Área Segura (iPhone notch) */}
      <header className="flex-shrink-0 bg-dracula-base/95 backdrop-blur-md z-40 app-shell-header border-b border-dracula-gray/20 pt-safe-top pb-3 px-4 select-none">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Target size={26} className="text-dracula-green" />
            <div>
              <h1 className="text-lg font-black text-dracula-light uppercase tracking-wide">
                Misiones
              </h1>
              <span className="text-[10px] text-dracula-gray font-bold block">
                {activeGroup?.nombre || 'Comunidad'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'propuestas' && (
              <button
                onClick={() => setIsProposeModalOpen(true)}
                className="bg-dracula-yellow/20 text-dracula-yellow px-2.5 py-1.5 rounded-xl font-bold flex items-center gap-1 hover:bg-dracula-yellow/30 transition-colors text-xs btn-press"
              >
                <Plus size={15} /> Sugerir
              </button>
            )}
            <GroupSwitcher />
          </div>
        </div>

        <div className="flex w-full mb-1 border-b border-dracula-gray/30">
          <button
            onClick={() => setActiveTab('activas')}
            className={`flex-1 pb-3 text-sm text-center font-semibold transition-colors btn-press ${
              activeTab === 'activas'
                ? 'text-dracula-green border-b-2 border-dracula-green'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            Tablón Activo
          </button>
          <button
            onClick={() => setActiveTab('propuestas')}
            className={`flex-1 pb-3 text-sm text-center font-semibold transition-colors btn-press ${
              activeTab === 'propuestas'
                ? 'text-dracula-yellow border-b-2 border-dracula-yellow'
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
      </header>

      <PullToRefresh onRefresh={fetchMissions}>
        <main className="app-shell-scroll p-4 pb-28 flex flex-col gap-4">
          {activeTab === 'activas' && (
            <ActiveMissionsView
              missions={activeMissions}
              onOpenCompletionModal={(mission: MissionItem) => setCompletionModalMission(mission)}
            />
          )}
          {activeTab === 'propuestas' && (
            <ProposedMissionsView
              proposals={proposedMissions}
              onVote={handleVoteProposal}
            />
          )}
          {activeTab === 'cerradas' && (
            <ClosedMissionsView missions={closedMissions} />
          )}
        </main>
      </PullToRefresh>

      {/* Botón flotante FAB para sugerir misiones con estilo táctil */}
      <button
        onClick={() => setIsProposeModalOpen(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-dracula-yellow rounded-full shadow-[0_0_20px_rgba(241,250,140,0.4)] flex items-center justify-center text-dracula-base btn-press z-30"
        aria-label="Sugerir nueva misión"
      >
        <Plus size={32} strokeWidth={2.5} />
      </button>

      {completionModalMission && (
        <CompleteMissionModal
          mission={completionModalMission}
          onClose={() => setCompletionModalMission(null)}
          onSubmitSuccess={handleProofSubmitted}
        />
      )}

      {isProposeModalOpen && (
        <SuggestMissionModal 
          onClose={() => setIsProposeModalOpen(false)} 
          onSuccess={() => {
            setIsProposeModalOpen(false);
            if (activeTab === 'propuestas') fetchMissions();
            else setActiveTab('propuestas');
          }}
          groupId={activeGroup?.id}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTES (Vistas Modulares)
// ============================================================================

/**
 * Tablón de misiones activas.
 * Prioriza las misiones provenientes de la ruleta diaria al principio del listado.
 */
function ActiveMissionsView({ missions, onOpenCompletionModal }: ActiveMissionsViewProps) {
  const sortedMissions = [...missions].sort((a, b) => {
    if (a.is_roulette && !b.is_roulette) return -1;
    if (!a.is_roulette && b.is_roulette) return 1;
    return 0;
  });

  if (sortedMissions.length === 0) {
    return <div className="text-center text-dracula-gray mt-10 text-sm">No hay misiones activas en esta fase.</div>;
  }

  return (
    <>
      {sortedMissions.map((mission) => (
        <MissionCard 
          key={mission.id} 
          mission={mission} 
          mode="active" 
          onCompleteClick={onOpenCompletionModal} 
        />
      ))}
    </>
  );
}

/**
 * Pestaña de sugerencias de misiones de la comunidad.
 * Muestra el balance de votos para que el Administrador evalúe su pase a producción.
 */
function ProposedMissionsView({ proposals, onVote }: ProposedMissionsViewProps) {
  return (
    <>
      <div className="bg-dracula-yellow/10 border border-dracula-yellow/30 p-3 rounded-lg text-xs text-dracula-yellow font-semibold text-center mb-2">
        Vota las ideas de otros jugadores. Las misiones con más apoyo serán revisadas por el Administrador.
      </div>
      {proposals.length === 0 && (
        <div className="text-center text-dracula-gray mt-10 text-sm">No hay propuestas aún. ¡Sé el primero!</div>
      )}
      {proposals.map((prop) => (
        <MissionCard 
          key={prop.id} 
          mission={prop} 
          mode="proposed" 
          onVote={onVote} 
        />
      ))}
    </>
  );
}

/**
 * Histórico de misiones culminadas o expiradas para consulta y transparencia.
 */
function ClosedMissionsView({ missions }: ClosedMissionsViewProps) {
  if (missions.length === 0) {
    return <div className="text-center text-dracula-gray mt-10 text-sm">Aún no hay misiones cerradas.</div>;
  }
  return (
    <>
      {missions.map((mission) => (
        <MissionCard 
          key={mission.id} 
          mission={mission} 
          mode="closed" 
        />
      ))}
    </>
  );
}

// ============================================================================
// MODALES TÁCTILES PWA
// ============================================================================

/**
 * Modal de resolución de misión con carga de pruebas multimedia.
 * Sube la imagen/vídeo al endpoint '/api/upload/image' (protegido con magic bytes en backend)
 * y vincula la URL generada junto al reporte del jugador.
 */
function CompleteMissionModal({ mission, onClose, onSubmitSuccess }: CompleteMissionModalProps) {
  const [proofText, setProofText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Manejo de carga de archivo local con previsualización reactiva
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  // Envío multipart/form-data a Cloudinary y registro de finalización
  const handleSubmit = async () => {
    setUploading(true);
    try {
      let secureUrl = null;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await api.post('/api/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        secureUrl = uploadRes.data.secure_url;
      }

      await api.post(`/api/misiones/${mission.id}/complete`, {
        proof_text: proofText,
        proof_image_url: secureUrl
      });
      toast.success('Pruebas enviadas al Tribunal (Administrador) para su validación.');
      onSubmitSuccess();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string | Array<{ msg: string }> } } };
      const detail = err.response?.data?.detail;
      const errorMsg =
        Array.isArray(detail) && detail.length > 0
          ? detail[0].msg
          : typeof detail === 'string'
          ? detail
          : 'Error al enviar las pruebas. Inténtalo de nuevo.';
      toast.error(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dracula-base w-full max-w-md rounded-2xl shadow-2xl border-2 border-dracula-green overflow-hidden flex flex-col relative scale-in-center">
        <div className="flex justify-between items-center p-4 border-b border-dracula-gray/20 bg-dracula-card/50">
          <h3 className="font-bold text-dracula-green text-sm uppercase tracking-wider flex items-center gap-2">
            <CheckCircle size={18} /> Validar Misión
          </h3>
          <button onClick={onClose} className="text-dracula-gray hover:text-dracula-red transition-colors btn-press">
            <X size={22} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <span className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest">Reclamando:</span>
            <h4 className="text-lg font-bold text-dracula-light">{mission.title}</h4>
          </div>

          <label className="w-full h-28 bg-dracula-card border-2 border-dashed border-dracula-gray/30 rounded-xl flex flex-col items-center justify-center text-dracula-gray hover:border-dracula-green hover:text-dracula-green transition-all group cursor-pointer relative overflow-hidden">
            {previewUrl ? (
               file?.type.startsWith('video/') ? (
                 <video src={previewUrl} controls className="w-full h-full object-contain" />
               ) : (
                 <img src={previewUrl} alt="Preview" className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
               )
            ) : (
              <>
                <ImageIcon size={28} className="mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold mt-1">Adjuntar Foto / Video</span>
              </>
            )}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
          </label>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase text-dracula-gray">Mensaje para el Tribunal (Opcional)</label>
            <textarea
              value={proofText}
              onChange={(e) => setProofText(e.target.value)}
              className="w-full bg-dracula-card border border-dracula-gray/20 rounded-xl p-3 text-base text-dracula-light focus:outline-none focus:border-dracula-green resize-none h-20"
              placeholder="Detalles sobre cómo completaste la prueba..."
            />
          </div>
        </div>

        <div className="p-4 border-t border-dracula-gray/20 bg-dracula-card/20 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-xs text-dracula-light bg-dracula-card hover:bg-dracula-gray/30 disabled:opacity-50 btn-press" disabled={uploading}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={uploading || !proofText.trim()} className="flex-[2] py-3 rounded-xl font-bold text-xs bg-dracula-green text-dracula-base hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed btn-press">
            {uploading ? <span className="animate-pulse">Enviando...</span> : <><Send size={16} /> Enviar Pruebas</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal para proponer misiones a votación popular.
 * Requiere una recompensa estimada en tokens y validaciones mínimas de longitud.
 */
function SuggestMissionModal({ onClose, onSuccess, groupId }: SuggestMissionModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title || !description || reward === '' || Number(reward) <= 0) {
      toast.error("Rellena todos los campos correctamente");
      return;
    }
    if (title.length < 5) {
      toast.error("El título debe tener al menos 5 caracteres");
      return;
    }
    if (description.length < 10) {
      toast.error("La descripción debe tener al menos 10 caracteres");
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/api/misiones/suggest', {
        title,
        description,
        reward: Number(reward),
        group_id: groupId || undefined
      });
      toast.success('Sugerencia enviada. El resto de jugadores podrá votarla en la pestaña de Propuestas.');
      onSuccess();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string | Array<{ msg: string }> } } };
      const detail = err.response?.data?.detail;
      const errorMsg =
        Array.isArray(detail) && detail.length > 0
          ? detail[0].msg
          : typeof detail === 'string'
          ? detail
          : 'Error enviando sugerencia';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dracula-base w-full max-w-md rounded-2xl shadow-2xl border-2 border-dracula-yellow overflow-hidden flex flex-col relative scale-in-center">
        <div className="flex justify-between items-center p-4 border-b border-dracula-gray/20 bg-dracula-card/50">
          <h3 className="font-bold text-dracula-yellow text-sm uppercase tracking-wider flex items-center gap-2">
            <Plus size={18} /> Sugerir Misión
          </h3>
          <button onClick={onClose} className="text-dracula-gray hover:text-dracula-red transition-colors btn-press">
            <X size={22} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="suggest-mission-title" className="text-[10px] font-bold uppercase text-dracula-gray">Título propuesto *</label>
            <input
              id="suggest-mission-title"
              name="missionTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-dracula-card border border-dracula-gray/20 rounded-xl p-3 text-base text-dracula-light focus:outline-none focus:border-dracula-yellow"
              placeholder="Título de la misión o reto"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="suggest-mission-desc" className="text-[10px] font-bold uppercase text-dracula-gray">¿Qué hay que hacer? *</label>
            <textarea
              id="suggest-mission-desc"
              name="missionDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-dracula-card border border-dracula-gray/20 rounded-xl p-3 text-base text-dracula-light focus:outline-none focus:border-dracula-yellow resize-none h-24"
              placeholder="Descripción y requisitos para validar el reto..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="suggest-mission-reward" className="text-[10px] font-bold uppercase text-dracula-gray">Recompensa sugerida (Tokens) *</label>
            <TokenAmountInput
              id="suggest-mission-reward"
              name="missionReward"
              min={1}
              value={reward}
              onChange={setReward}
              placeholder="200"
              icon="💰"
              className="w-full bg-dracula-card border border-dracula-gray/20 rounded-xl py-3 pl-9 pr-3 text-base font-bold text-dracula-yellow focus:outline-none focus:border-dracula-yellow"
            />
          </div>
        </div>

        <div className="p-4 border-t border-dracula-gray/20 bg-dracula-card/20 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-xs text-dracula-light bg-dracula-card hover:bg-dracula-gray/30 disabled:opacity-50 btn-press" disabled={loading}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading || !title || !description || !reward} className="flex-[2] py-3 rounded-xl font-bold text-xs bg-dracula-yellow text-dracula-base hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed btn-press">
            {loading ? <span className="animate-pulse">Enviando...</span> : <><Send size={16} /> Enviar Propuesta</>}
          </button>
        </div>
      </div>
    </div>
  );
}
