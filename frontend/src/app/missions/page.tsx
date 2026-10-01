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
import {
  Target,
  Plus,
  CheckCircle,
  X,
  Image as ImageIcon,
  Send,
} from 'lucide-react';
import api from '@/lib/axios';
import PullToRefresh from '@/components/PullToRefresh';
import MissionCard from '@/components/MissionCard';
import toast from 'react-hot-toast';
import { useGroup } from '@/context/GroupContext';
import GroupSwitcher from '@/components/groups/GroupSwitcher';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import { MisionResponse } from '@/types';

export type MissionItem = MisionResponse;

interface ActiveMissionsViewProps {
  missions: MissionItem[];
  onOpenCompletionModal: (mission: MissionItem) => void;
}

interface ProposedMissionsViewProps {
  proposals: MissionItem[];
  onVote: (id: string | number, voteType: 'up' | 'down') => Promise<void>;
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
  const [activeTab, setActiveTab] = useState<
    'activas' | 'propuestas' | 'cerradas'
  >('activas');

  // Estados de listados de misiones según su ciclo de vida
  const [activeMissions, setActiveMissions] = useState<MissionItem[]>([]);
  const [proposedMissions, setProposedMissions] = useState<MissionItem[]>([]);
  const [closedMissions, setClosedMissions] = useState<MissionItem[]>([]);

  /**
   * Carga las misiones desde la API filtradas por el grupo activo.
   * Se ejecuta al alternar pestañas o al cambiar la comunidad en el header.
   * Sincroniza reactivamente el saldo de tokens en la cabecera.
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
  const [completionModalMission, setCompletionModalMission] =
    useState<MissionItem | null>(null);
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);

  /**
   * Emite un voto ('up' o 'down') hacia una propuesta de la comunidad.
   * Maneja errores tipados retornados por FastAPI (detalles de validación Pydantic).
   */
  const handleVoteProposal = async (
    id: string | number,
    voteType: 'up' | 'down'
  ) => {
    try {
      await api.post(`/api/misiones/${id}/vote`, { vote_type: voteType });
      toast.success('Voto registrado');
      await fetchMissions();
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { detail?: string | Array<{ msg: string }> } };
      };
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
    <div className="app-shell-page text-dracula-light bg-black select-none">
      {/* Cabecera Fija con soporte de Área Segura (iPhone notch) */}
      <header className="bg-dracula-base/95 app-shell-header border-dracula-gray/20 pt-safe-top z-40 flex-shrink-0 border-b px-4 pb-3 backdrop-blur-md select-none">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Target size={26} className="text-dracula-green" />
            <div>
              <h1 className="text-dracula-light text-lg font-black tracking-wide uppercase">
                Misiones
              </h1>
              <span className="text-dracula-gray block text-[10px] font-bold">
                {activeGroup?.nombre || 'Comunidad'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'propuestas' && (
              <button
                onClick={() => setIsProposeModalOpen(true)}
                className="bg-dracula-yellow/20 text-dracula-yellow hover:bg-dracula-yellow/30 btn-press flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors"
              >
                <Plus size={15} /> Sugerir
              </button>
            )}
            <GroupSwitcher />
          </div>
        </div>

        <div className="border-dracula-gray/30 mb-1 flex w-full border-b">
          <button
            onClick={() => setActiveTab('activas')}
            className={`btn-press flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
              activeTab === 'activas'
                ? 'text-dracula-green border-dracula-green border-b-2'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            Tablón Activo
          </button>
          <button
            onClick={() => setActiveTab('propuestas')}
            className={`btn-press flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
              activeTab === 'propuestas'
                ? 'text-dracula-yellow border-dracula-yellow border-b-2'
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
      </header>

      <PullToRefresh onRefresh={fetchMissions}>
        <main className="app-shell-scroll flex flex-col gap-4 p-4 pb-28">
          {activeTab === 'activas' && (
            <ActiveMissionsView
              missions={activeMissions}
              onOpenCompletionModal={(mission: MissionItem) =>
                setCompletionModalMission(mission)
              }
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
        className="bg-dracula-yellow text-dracula-base btn-press fixed right-4 bottom-20 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_0_20px_rgba(241,250,140,0.4)]"
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
function ActiveMissionsView({
  missions,
  onOpenCompletionModal,
}: ActiveMissionsViewProps) {
  const sortedMissions = [...missions].sort((a, b) => {
    if (a.is_roulette && !b.is_roulette) return -1;
    if (!a.is_roulette && b.is_roulette) return 1;
    return 0;
  });

  if (sortedMissions.length === 0) {
    return (
      <div className="text-dracula-gray mt-10 text-center text-sm">
        No hay misiones activas en esta fase.
      </div>
    );
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
function ProposedMissionsView({
  proposals,
  onVote,
}: ProposedMissionsViewProps) {
  return (
    <>
      <div className="bg-dracula-yellow/10 border-dracula-yellow/30 text-dracula-yellow mb-2 rounded-lg border p-3 text-center text-xs font-semibold">
        Vota las ideas de otros jugadores. Las misiones con más apoyo serán
        revisadas por el Administrador.
      </div>
      {proposals.length === 0 && (
        <div className="text-dracula-gray mt-10 text-center text-sm">
          No hay propuestas aún. ¡Sé el primero!
        </div>
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
    return (
      <div className="text-dracula-gray mt-10 text-center text-sm">
        Aún no hay misiones cerradas.
      </div>
    );
  }
  return (
    <>
      {missions.map((mission) => (
        <MissionCard key={mission.id} mission={mission} mode="closed" />
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
function CompleteMissionModal({
  mission,
  onClose,
  onSubmitSuccess,
}: CompleteMissionModalProps) {
  const [proofText, setProofText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Determina si el usuario ha aportado al menos una evidencia válida
  const hasProof = Boolean(file || proofText.trim());

  // Manejo de carga de archivo local con previsualización reactiva
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFile(null);
    setPreviewUrl(null);
  };

  // Envío multipart/form-data a Cloudinary y registro de finalización
  const handleSubmit = async () => {
    if (!hasProof) {
      toast.error(
        'Debes aportar al menos una prueba: una foto/vídeo o un texto explicativo.'
      );
      return;
    }

    setUploading(true);
    try {
      let secureUrl = null;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await api.post('/api/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        secureUrl = uploadRes.data.secure_url;
      }

      await api.post(`/api/misiones/${mission.id}/complete`, {
        proof_text: proofText.trim() || undefined,
        proof_image_url: secureUrl,
      });
      toast.success(
        'Pruebas enviadas al Tribunal (Administrador) para su validación.'
      );
      onSubmitSuccess();
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { detail?: string | Array<{ msg: string }> } };
      };
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
    <div className="animate-fadeIn fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-dracula-base border-dracula-green scale-in-center relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border-2 shadow-2xl">
        <div className="border-dracula-gray/20 bg-dracula-card/50 flex items-center justify-between border-b p-4">
          <h3 className="text-dracula-green flex items-center gap-2 text-sm font-bold tracking-wider uppercase">
            <CheckCircle size={18} /> Validar Misión
          </h3>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-red btn-press transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div>
            <span className="text-dracula-gray text-[10px] font-bold tracking-widest uppercase">
              Reclamando:
            </span>
            <h4 className="text-dracula-light text-lg font-bold">
              {mission.title}
            </h4>
          </div>

          <label className="bg-dracula-card border-dracula-gray/30 text-dracula-gray hover:border-dracula-green hover:text-dracula-green group relative flex h-28 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all">
            {previewUrl ? (
              <>
                {file?.type.startsWith('video/') ? (
                  <video
                    src={previewUrl}
                    controls
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-full w-full object-contain opacity-80 transition-opacity group-hover:opacity-100"
                  />
                )}
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="bg-dracula-base/80 text-dracula-red hover:bg-dracula-red absolute top-2 right-2 z-20 rounded-full p-1 transition-colors hover:text-white"
                  title="Eliminar archivo seleccionado"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <ImageIcon
                  size={28}
                  className="mb-1 transition-transform group-hover:scale-110"
                />
                <span className="mt-1 text-xs font-bold">
                  Adjuntar Foto / Video (Opcional)
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <label className="text-dracula-gray text-[10px] font-bold uppercase">
              Mensaje para el Tribunal (Opcional si adjuntas multimedia)
            </label>
            <textarea
              value={proofText}
              onChange={(e) => setProofText(e.target.value)}
              className="bg-dracula-card border-dracula-gray/20 text-dracula-light focus:border-dracula-green h-20 w-full resize-none rounded-xl border p-3 text-base focus:outline-none"
              placeholder="Detalles sobre cómo completaste la prueba..."
            />
            <span className="text-dracula-gray text-[10px] italic">
              * Aporta al menos una prueba: una foto/vídeo o una justificación
              explicativa.
            </span>
          </div>
        </div>

        <div className="border-dracula-gray/20 bg-dracula-card/20 flex gap-3 border-t p-4">
          <button
            onClick={onClose}
            className="text-dracula-light bg-dracula-card hover:bg-dracula-gray/30 btn-press flex-1 rounded-xl py-3 text-xs font-bold disabled:opacity-50"
            disabled={uploading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading || !hasProof}
            className="bg-dracula-green text-dracula-base btn-press flex flex-[2] items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <span className="animate-pulse">Enviando...</span>
            ) : (
              <>
                <Send size={16} /> Enviar Pruebas
              </>
            )}
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
function SuggestMissionModal({
  onClose,
  onSuccess,
  groupId,
}: SuggestMissionModalProps) {
  const { activeGroup } = useGroup();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title || !description || reward === '' || Number(reward) <= 0) {
      toast.error('Rellena todos los campos correctamente');
      return;
    }
    if (title.length < 5) {
      toast.error('El título debe tener al menos 5 caracteres');
      return;
    }
    if (description.length < 10) {
      toast.error('La descripción debe tener al menos 10 caracteres');
      return;
    }

    setLoading(true);
    try {
      const effectiveGroupId = groupId ?? activeGroup?.id;
      await api.post('/api/misiones/suggest', {
        title,
        description,
        reward: Number(reward),
        group_id: effectiveGroupId || undefined,
      });
      toast.success(
        'Sugerencia enviada. El resto de jugadores podrá votarla en la pestaña de Propuestas.'
      );
      onSuccess();
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { detail?: string | Array<{ msg: string }> } };
      };
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
    <div className="animate-fadeIn fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-dracula-base border-dracula-yellow scale-in-center relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border-2 shadow-2xl">
        <div className="border-dracula-gray/20 bg-dracula-card/50 flex items-center justify-between border-b p-4">
          <h3 className="text-dracula-yellow flex items-center gap-2 text-sm font-bold tracking-wider uppercase">
            <Plus size={18} /> Sugerir Misión
          </h3>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-red btn-press transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="suggest-mission-title"
              className="text-dracula-gray text-[10px] font-bold uppercase"
            >
              Título propuesto *
            </label>
            <input
              id="suggest-mission-title"
              name="missionTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-dracula-card border-dracula-gray/20 text-dracula-light focus:border-dracula-yellow w-full rounded-xl border p-3 text-base focus:outline-none"
              placeholder="Título de la misión o reto"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="suggest-mission-desc"
              className="text-dracula-gray text-[10px] font-bold uppercase"
            >
              ¿Qué hay que hacer? *
            </label>
            <textarea
              id="suggest-mission-desc"
              name="missionDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-dracula-card border-dracula-gray/20 text-dracula-light focus:border-dracula-yellow h-24 w-full resize-none rounded-xl border p-3 text-base focus:outline-none"
              placeholder="Descripción y requisitos para validar el reto..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="suggest-mission-reward"
              className="text-dracula-gray text-[10px] font-bold uppercase"
            >
              Recompensa sugerida (Tokens) *
            </label>
            <TokenAmountInput
              id="suggest-mission-reward"
              name="missionReward"
              min={1}
              value={reward}
              onChange={setReward}
              placeholder="200"
              icon="💰"
              className="bg-dracula-card border-dracula-gray/20 text-dracula-yellow focus:border-dracula-yellow w-full rounded-xl border py-3 pr-3 pl-9 text-base font-bold focus:outline-none"
            />
          </div>
        </div>

        <div className="border-dracula-gray/20 bg-dracula-card/20 flex gap-3 border-t p-4">
          <button
            onClick={onClose}
            className="text-dracula-light bg-dracula-card hover:bg-dracula-gray/30 btn-press flex-1 rounded-xl py-3 text-xs font-bold disabled:opacity-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !title || !description || !reward}
            className="bg-dracula-yellow text-dracula-base btn-press flex flex-[2] items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-pulse">Enviando...</span>
            ) : (
              <>
                <Send size={16} /> Enviar Propuesta
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
