'use client';

/**
 * ============================================================================
 * PESTAÑA DE GESTIÓN Y TRIBUNAL DE MISIONES (TabMisiones)
 * ============================================================================
 * Proporciona a los administradores dos vistas esenciales:
 * 1. Sugerencias Pendientes: Misiones propuestas por la comunidad con votos
 *    populares a favor/en contra, permitiendo ajustar su recompensa y publicarlas.
 * 2. Tribunal de Validación: Verificación de evidencias fotográficas/vídeo
 *    subidas por los jugadores para reclamar el pago de tokens.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { formatSpanishDate } from '@/lib/formatters';
import { getApiErrorMessage } from '@/lib/errorHandler';
import {
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  MessageSquare,
  Target,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import { useGroup } from '@/context/GroupContext';

interface MisionSugerenciaItem {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  description: string;
  reward: number;
  upvotes: number;
  downvotes: number;
}

interface TribunalPruebaItem {
  id: number;
  usuario: string;
  usuario_avatar?: string | null;
  mision_reward: number;
  mision_title: string;
  createdAt: string;
  proof_text?: string;
  proof_image_url?: string;
}

export default function TabMisiones() {
  const [activeTab, setActiveTab] = useState<'sugerencias' | 'tribunal'>(
    'sugerencias'
  );

  return (
    <div className="animate-fadeIn flex flex-col gap-6">
      <div className="border-dracula-gray/30 mb-4 flex border-b">
        <button
          id="admin-subtab-misiones-sugerencias"
          onClick={() => setActiveTab('sugerencias')}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${
            activeTab === 'sugerencias'
              ? 'text-dracula-yellow border-dracula-yellow border-b-2'
              : 'text-dracula-gray hover:text-dracula-light'
          }`}
        >
          Sugerencias Pendientes
        </button>
        <button
          id="admin-subtab-misiones-tribunal"
          onClick={() => setActiveTab('tribunal')}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${
            activeTab === 'tribunal'
              ? 'text-dracula-purple border-dracula-purple border-b-2'
              : 'text-dracula-gray hover:text-dracula-light'
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
  const [sugerencias, setSugerencias] = useState<MisionSugerenciaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // States para edición rápida de sugerencias (id -> value)
  const [edits, setEdits] = useState<Record<string, { reward: number | '' }>>(
    {}
  );

  const fetchSugerencias = useCallback(async () => {
    try {
      const res = await api.get<MisionSugerenciaItem[]>(
        '/api/admin/misiones/sugerencias',
        {
          params: activeGroup?.id ? { group_id: activeGroup.id } : {},
        }
      );
      setSugerencias(res.data || []);

      const newEdits: Record<string, { reward: number | '' }> = {};
      (res.data || []).forEach((item) => {
        newEdits[item.id] = { reward: item.reward };
      });
      setEdits(newEdits);
    } catch {
      toast.error('Error cargando sugerencias');
    } finally {
      setLoading(false);
    }
  }, [activeGroup]);

  useEffect(() => {
    fetchSugerencias();
  }, [fetchSugerencias]);

  const handleUpdateEdit = (
    id: string,
    field: 'reward',
    value: number | ''
  ) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleAprobar = async (id: string) => {
    try {
      const editData = edits[id];
      const orig = sugerencias.find((s) => s.id === id);
      const recompensaVal =
        editData?.reward === ''
          ? (orig?.reward ?? 100)
          : Number(editData?.reward);
      await api.patch(`/api/admin/misiones/${id}/sugerencia/aprobar`, {
        recompensa: recompensaVal,
      });
      toast.success('Sugerencia aprobada y publicada');
      fetchSugerencias();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error aprobando sugerencia'));
    }
  };

  const handleRechazar = async (id: string) => {
    if (
      !confirm(
        '¿Seguro que quieres descartar esta sugerencia? Se eliminará de la base de datos.'
      )
    )
      return;
    try {
      await api.patch(`/api/admin/misiones/${id}/sugerencia/rechazar`);
      toast.success('Sugerencia descartada');
      fetchSugerencias();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error rechazando sugerencia'));
    }
  };

  if (loading)
    return (
      <div className="text-dracula-gray py-10 text-center">
        Cargando sugerencias...
      </div>
    );
  if (sugerencias.length === 0)
    return (
      <div className="text-dracula-gray py-10 text-center">
        No hay sugerencias pendientes.
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {sugerencias.map((s) => (
        <div
          key={s.id}
          className="bg-dracula-card border-dracula-gray/20 flex flex-col gap-4 rounded-xl border p-4"
        >
          <div>
            <div className="flex items-start justify-between">
              <h3 className="text-dracula-light flex items-center gap-2 text-lg font-bold">
                <Target size={18} className="text-dracula-yellow" /> {s.title}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-dracula-green bg-dracula-green/10 border-dracula-green/20 flex items-center gap-1 rounded border px-2 py-1 text-xs font-bold">
                  <ThumbsUp size={12} /> {s.upvotes || 0}
                </span>
                <span className="text-dracula-red bg-dracula-red/10 border-dracula-red/20 flex items-center gap-1 rounded border px-2 py-1 text-xs font-bold">
                  <ThumbsDown size={12} /> {s.downvotes || 0}
                </span>
              </div>
            </div>
            <p className="text-dracula-gray mt-1 text-xs">
              Sugerida por @{s.author} • {formatSpanishDate(s.createdAt)}
            </p>
            <p className="text-dracula-light mt-3 text-sm">{s.description}</p>
          </div>

          <div className="bg-dracula-base border-dracula-gray/10 flex gap-4 rounded-lg border p-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dracula-gray text-[10px] font-bold uppercase">
                Recompensa (Tokens)
              </label>
              <TokenAmountInput
                min={1}
                value={edits[s.id]?.reward ?? ''}
                onChange={(val) => handleUpdateEdit(s.id, 'reward', val)}
                placeholder="100"
                className="bg-dracula-card border-dracula-gray/30 text-dracula-yellow focus:border-dracula-yellow w-full rounded-lg border py-2 pr-3 pl-9 text-sm font-bold focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-2 flex gap-3">
            <button
              onClick={() => handleAprobar(s.id)}
              className="bg-dracula-green/20 hover:bg-dracula-green/30 text-dracula-green border-dracula-green/50 flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition-colors"
            >
              <CheckCircle size={16} /> Aprobar y Publicar
            </button>
            <button
              onClick={() => handleRechazar(s.id)}
              className="bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border-dracula-red/30 flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-xs font-bold transition-colors"
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
  const [pruebas, setPruebas] = useState<TribunalPruebaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado para el prompt de rechazo
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rechazoMotivo, setRechazoMotivo] = useState('');

  const fetchPruebas = useCallback(async () => {
    try {
      const res = await api.get<TribunalPruebaItem[]>(
        '/api/admin/misiones/pruebas',
        {
          params: activeGroup?.id ? { group_id: activeGroup.id } : {},
        }
      );
      setPruebas(res.data || []);
    } catch {
      toast.error('Error cargando pruebas');
    } finally {
      setLoading(false);
    }
  }, [activeGroup]);

  useEffect(() => {
    fetchPruebas();
  }, [fetchPruebas]);

  const handleValidar = async (id: number) => {
    try {
      await api.patch(`/api/admin/misiones/pruebas/${id}/validar`);
      toast.success('Prueba validada y tokens pagados');
      fetchPruebas();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error validando prueba'));
    }
  };

  const submitRechazo = async () => {
    if (!rejectingId) return;
    if (!rechazoMotivo.trim()) {
      toast.error('El motivo no puede estar vacío');
      return;
    }

    try {
      await api.patch(`/api/admin/misiones/pruebas/${rejectingId}/rechazar`, {
        motivo: rechazoMotivo,
      });
      toast.success('Prueba rechazada y usuario notificado');
      setRejectingId(null);
      setRechazoMotivo('');
      fetchPruebas();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error rechazando prueba'));
    }
  };

  if (loading)
    return (
      <div className="text-dracula-gray py-10 text-center">
        Cargando tribunal...
      </div>
    );
  if (pruebas.length === 0)
    return (
      <div className="text-dracula-gray py-10 text-center">
        El Tribunal no tiene casos pendientes.
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      {pruebas.map((p) => {
        const isVideo =
          p.proof_image_url?.match(/\.(mp4|webm|ogg|mov)$/i) ||
          p.proof_image_url?.includes('/video/');
        return (
          <div
            key={p.id}
            className="bg-dracula-card border-dracula-purple/30 overflow-hidden rounded-xl border shadow-lg"
          >
            <div className="bg-dracula-base border-dracula-gray/20 flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.usuario_avatar || '/default-avatar.png'}
                  alt={p.usuario}
                  className="border-dracula-purple h-10 w-10 rounded-full border object-cover"
                />
                <div>
                  <span className="text-dracula-gray text-[10px] font-bold uppercase">
                    Reclamante
                  </span>
                  <p className="text-dracula-light text-sm font-bold">
                    @{p.usuario}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-dracula-gray block text-[10px] font-bold uppercase">
                  Recompensa
                </span>
                <span className="text-dracula-yellow bg-dracula-yellow/10 rounded px-2 py-0.5 text-sm font-bold">
                  💰 {p.mision_reward}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-4 p-4">
              <div>
                <span className="text-dracula-gray mb-1 block text-[10px] font-bold uppercase">
                  Misión Reclamada
                </span>
                <h4 className="text-dracula-light text-md font-bold">
                  {p.mision_title}
                </h4>
                <p className="text-dracula-gray mt-1 text-xs">
                  Enviado: {formatSpanishDate(p.createdAt)}
                </p>
              </div>

              {(p.proof_text || p.proof_image_url) && (
                <div className="bg-dracula-base border-dracula-gray/10 flex flex-col gap-3 rounded-lg border p-3">
                  <span className="text-dracula-purple flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase">
                    <MessageSquare size={12} /> Pruebas Presentadas
                  </span>

                  {p.proof_text && (
                    <p className="text-dracula-light bg-dracula-card border-dracula-gray/20 rounded border p-3 text-sm italic">
                      &ldquo;{p.proof_text}&rdquo;
                    </p>
                  )}

                  {p.proof_image_url && (
                    <div className="mt-2">
                      {isVideo ? (
                        <video
                          src={p.proof_image_url}
                          controls
                          className="bg-dracula-card border-dracula-gray/20 block h-48 w-full rounded-lg border object-contain"
                        />
                      ) : (
                        <a
                          href={p.proof_image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-dracula-card border-dracula-gray/20 hover:border-dracula-purple group relative block h-48 w-full overflow-hidden rounded-lg border transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.proof_image_url}
                            alt="Prueba"
                            className="h-full w-full object-contain"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="bg-dracula-base/80 text-dracula-light flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold">
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
                <div className="bg-dracula-red/10 border-dracula-red/30 animate-fadeIn mt-2 flex flex-col gap-3 rounded-xl border p-4">
                  <label className="text-dracula-red text-xs font-bold uppercase">
                    Motivo del rechazo
                  </label>
                  <textarea
                    value={rechazoMotivo}
                    onChange={(e) => setRechazoMotivo(e.target.value)}
                    className="bg-dracula-base border-dracula-red/20 text-dracula-light focus:border-dracula-red h-20 w-full resize-none rounded border p-3 text-sm focus:outline-none"
                    placeholder="Motivo del rechazo de la prueba..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRejectingId(null)}
                      className="text-dracula-gray bg-dracula-base hover:text-dracula-light border-dracula-gray/20 flex-1 rounded border py-2 text-xs font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={submitRechazo}
                      className="bg-dracula-red text-dracula-base flex-1 rounded py-2 text-xs font-bold hover:opacity-90"
                    >
                      Confirmar Rechazo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-3">
                  <button
                    onClick={() => handleValidar(p.id)}
                    className="bg-dracula-green hover:bg-dracula-green/90 text-dracula-base flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold shadow-[0_0_15px_rgba(80,250,123,0.3)] transition-colors"
                  >
                    <CheckCircle size={18} /> Validar y Pagar
                  </button>
                  <button
                    onClick={() => setRejectingId(p.id)}
                    className="bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border-dracula-red/30 flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold transition-colors"
                  >
                    <XCircle size={18} /> Rechazar Prueba
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
