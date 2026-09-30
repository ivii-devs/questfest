'use client';

/**
 * ============================================================================
 * PESTAÑA DE NOTIFICACIONES Y BOLETINES (TabNotificaciones)
 * ============================================================================
 * Permite a los administradores:
 * 1. Enviar avisos inmediatos a audiencias segmentadas o usuarios individuales,
 *    con previsualización y validación previa de los destinatarios.
 * 2. Configurar y programar el boletín diario automatizado de estadísticas del grupo.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';
import { Clock, Send, Users, User, X, Check, Eye } from 'lucide-react';
import DailySummaryModal from '../DailySummaryModal';
import { useGroup } from '@/context/GroupContext';

interface ValidationUserItem {
  id: number;
  username: string;
  rol?: string;
}

interface NotificationHistoryItem {
  id: number;
  titulo: string;
  mensaje?: string;
  destinatario_tipo?: string;
  estado?: string;
  created_at?: string;
}

export default function TabNotificaciones() {
  const { activeGroup } = useGroup();
  const [activeSubTab, setActiveSubTab] = useState<'inmediato' | 'boletin'>(
    'inmediato'
  );

  // ---- ESTADO DE AVISO INMEDIATO ----
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [destinatario, setDestinatario] = useState('all');

  // Validacion
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [validationUsers, setValidationUsers] = useState<ValidationUserItem[]>(
    []
  );
  const [validationLoading, setValidationLoading] = useState(false);
  const [specificUserId, setSpecificUserId] = useState<number | null>(null);

  // Historial
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);

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
    biggestLoser: true,
  });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<Record<
    string,
    unknown
  > | null>(null);

  const fetchBoletinConfig = useCallback(async () => {
    try {
      const res = await api.get('/api/settings/boletin', {
        params: activeGroup ? { group_id: activeGroup.id } : {},
      });
      if (res.data) {
        if (res.data.hora) setHoraBoletin(res.data.hora);
        if (res.data.phaseValue) setPhaseBoletin(res.data.phaseValue);
        setBulletinConfig((prev) => ({
          ...prev,
          ...res.data,
        }));
      }
    } catch {
      // Ignorar fallos de carga inicial de config
    }
  }, [activeGroup]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get<NotificationHistoryItem[]>(
        '/api/admin/notifications'
      );
      setHistory(res.data || []);
    } catch {
      // Advertencia en consola si el historial no responde
      console.warn('No se pudo cargar el historial de notificaciones');
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchBoletinConfig();
  }, [activeGroup?.id, fetchHistory, fetchBoletinConfig]);

  const openValidationModal = async () => {
    if (!titulo || !mensaje)
      return toast.error('Rellena los campos obligatorios');

    setIsValidationOpen(true);
    setValidationLoading(true);
    setValidationUsers([]);
    setSpecificUserId(null);

    try {
      if (destinatario === 'specific_user') {
        const res = await api.get<ValidationUserItem[]>('/api/admin/users');
        setValidationUsers(res.data);
      } else {
        const res = await api.post<ValidationUserItem[]>(
          '/api/admin/notifications/preview-audience',
          {
            destinatario_tipo: destinatario,
          }
        );
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
        destinatario_tipo:
          destinatario === 'specific_user' ? 'specific' : destinatario,
        destinatario_id: specificUserId,
      });
      toast.success(
        'Aviso enviado a ' +
          (destinatario === 'specific_user'
            ? '1 usuario'
            : validationUsers.length + ' usuarios'),
        { id: toastId }
      );
      setTitulo('');
      setMensaje('');
      setIsValidationOpen(false);
      fetchHistory();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error al enviar'), {
        id: toastId,
      });
    }
  };

  const handlePreviewBoletin = async () => {
    const toastId = toast.loading('Generando vista previa...');
    try {
      const res = await api.get<Record<string, unknown>>(
        '/api/admin/summary-stats',
        {
          params: activeGroup ? { group_id: activeGroup.id } : {},
        }
      );
      const fullData = res.data;

      // Filter based on config
      const filteredData: Record<string, unknown> = {};
      if (bulletinConfig.phase) filteredData.phase = phaseBoletin;
      if (bulletinConfig.firstPlace)
        filteredData.firstPlace = fullData.firstPlace;
      if (bulletinConfig.lastPlace) filteredData.lastPlace = fullData.lastPlace;
      if (bulletinConfig.mostBetsWon)
        filteredData.mostBetsWon = fullData.mostBetsWon;
      if (bulletinConfig.mostMissions)
        filteredData.mostMissions = fullData.mostMissions;
      if (bulletinConfig.duelWinner)
        filteredData.duelWinner = fullData.duelWinner;
      if (bulletinConfig.biggestWinner)
        filteredData.biggestWinner = fullData.biggestWinner;
      if (bulletinConfig.biggestLoser)
        filteredData.biggestLoser = fullData.biggestLoser;

      setPreviewData(filteredData);
      setIsPreviewOpen(true);
      toast.dismiss(toastId);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error al generar vista previa'), {
        id: toastId,
      });
    }
  };

  const handleProgramBoletin = async () => {
    const toastId = toast.loading('Guardando configuración...');
    try {
      await api.put(
        '/api/settings/boletin',
        {
          hora: horaBoletin,
          phaseValue: phaseBoletin,
          group_id: activeGroup?.id,
          ...bulletinConfig,
        },
        {
          params: activeGroup ? { group_id: activeGroup.id } : {},
        }
      );
      toast.success('Boletín recurrente guardado a las ' + horaBoletin, {
        id: toastId,
      });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error al guardar'), {
        id: toastId,
      });
    }
  };

  return (
    <div className="animate-fadeIn flex flex-col gap-6 p-4 pb-24">
      {/* SUB-TABS */}
      <div className="border-dracula-gray/20 flex gap-2 rounded-xl border bg-black/50 p-1">
        <button
          onClick={() => setActiveSubTab('inmediato')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-colors ${
            activeSubTab === 'inmediato'
              ? 'text-dracula-base bg-[#8be9fd]'
              : 'text-dracula-gray'
          }`}
        >
          <Send size={16} /> Aviso Inmediato
        </button>
        <button
          onClick={() => setActiveSubTab('boletin')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-colors ${
            activeSubTab === 'boletin'
              ? 'text-dracula-base bg-[#8be9fd]'
              : 'text-dracula-gray'
          }`}
        >
          <Clock size={16} /> Boletín Diario
        </button>
      </div>

      {/* VISTA AVISO INMEDIATO */}
      {activeSubTab === 'inmediato' && (
        <>
          <div className="bg-dracula-card border-dracula-gray/20 flex flex-col gap-4 rounded-2xl border p-4">
            <h3 className="font-bold text-[#8be9fd]">Redactar Comunicado</h3>

            <div>
              <label className="text-dracula-gray mb-1 block px-1 text-[10px] font-bold tracking-widest uppercase">
                Título del Aviso
              </label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: ¡Últimas horas para las apuestas!"
                className="border-dracula-gray/20 text-dracula-light w-full rounded-xl border bg-black/50 p-3 text-sm transition-colors focus:border-[#8be9fd] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-dracula-gray mb-1 block px-1 text-[10px] font-bold tracking-widest uppercase">
                Mensaje
              </label>
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Escribe el cuerpo del mensaje..."
                className="border-dracula-gray/20 text-dracula-light h-24 w-full resize-none rounded-xl border bg-black/50 p-3 text-sm transition-colors focus:border-[#8be9fd] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-dracula-gray mb-2 block px-1 text-[10px] font-bold tracking-widest uppercase">
                Destinatarios
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'all', label: 'Todos los Miembros' },
                  { id: 'specific_user', label: 'Usuario Específico' },
                  { id: 'in_debt', label: 'Usuarios en Deuda' },
                  { id: 'inactive', label: 'Inactivos hoy' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    onClick={() => setDestinatario(opt.id)}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 transition-colors ${
                      destinatario === opt.id
                        ? 'border-[#8be9fd] bg-[#8be9fd]/10'
                        : 'border-dracula-gray/20 bg-black/50'
                    }`}
                  >
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        destinatario === opt.id
                          ? 'border-[#8be9fd]'
                          : 'border-dracula-gray'
                      }`}
                    >
                      {destinatario === opt.id && (
                        <div className="animate-fadeIn h-2 w-2 rounded-full bg-[#8be9fd]" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        destinatario === opt.id
                          ? 'text-dracula-light'
                          : 'text-dracula-gray'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={openValidationModal}
              className="text-dracula-base flex w-full items-center justify-center gap-2 rounded-xl bg-[#8be9fd] p-3 font-bold transition-colors hover:bg-[#8be9fd]/80"
            >
              <Send size={18} /> Continuar y Validar
            </button>
          </div>

          {/* Historial Inmediato */}
          <div className="bg-dracula-card border-dracula-gray/20 rounded-2xl border p-4">
            <h3 className="text-dracula-gray mb-3 text-sm font-bold">
              Últimos Envíos
            </h3>
            <div className="flex flex-col gap-2">
              {history.slice(0, 5).map((h) => (
                <div
                  key={h.id}
                  className="border-dracula-gray/10 flex items-center justify-between rounded-xl border bg-black/40 p-3"
                >
                  <div className="flex flex-col">
                    <span className="text-dracula-light text-xs font-bold">
                      {h.titulo}
                    </span>
                    <span className="text-dracula-gray text-[10px]">
                      Destino: {h.destinatario_tipo}
                    </span>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                      h.estado === 'sent'
                        ? 'bg-dracula-green/20 text-dracula-green'
                        : 'bg-dracula-yellow/20 text-dracula-yellow'
                    }`}
                  >
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
        <div className="bg-dracula-card rounded-2xl border border-[#8be9fd]/30 p-4 shadow-[0_0_15px_rgba(139,233,253,0.1)]">
          <h3 className="mb-4 font-bold text-[#8be9fd]">
            Constructor de Boletín
          </h3>

          <div className="mb-4 flex gap-3">
            <div className="flex-1">
              <label className="text-dracula-gray mb-1 px-1 text-[10px] font-bold tracking-widest uppercase">
                Fase del Juego
              </label>
              <input
                type="text"
                value={phaseBoletin}
                onChange={(e) => setPhaseBoletin(e.target.value)}
                className="border-dracula-gray/20 text-dracula-light w-full rounded-xl border bg-black/50 p-3 text-sm transition-colors outline-none focus:border-[#8be9fd]"
              />
            </div>
            <div className="w-32">
              <label className="text-dracula-gray mb-1 px-1 text-[10px] font-bold tracking-widest uppercase">
                Hora Envío
              </label>
              <input
                type="time"
                value={horaBoletin}
                onChange={(e) => setHoraBoletin(e.target.value)}
                className="border-dracula-gray/20 text-dracula-light w-full appearance-none rounded-xl border bg-black/50 p-3 text-sm transition-colors outline-none focus:border-[#8be9fd]"
              />
            </div>
          </div>

          <label className="text-dracula-gray mb-2 block px-1 text-[10px] font-bold tracking-widest uppercase">
            Bloques de Estadísticas (Checkboxes)
          </label>
          <div className="mb-6 flex flex-col gap-2">
            {[
              { id: 'phase', label: 'Mostrar Etiqueta de Fase (Ej: Noche 1)' },
              { id: 'firstPlace', label: 'Top 1 (Líder Actual)' },
              { id: 'lastPlace', label: 'Último Lugar (Farolillo Rojo)' },
              { id: 'mostBetsWon', label: 'Más Apuestas Ganadas (Acertado)' },
              { id: 'mostMissions', label: 'Más Misiones Completadas' },
              { id: 'duelWinner', label: 'Destrozó en un Duelo' },
              { id: 'biggestWinner', label: 'Mayor Subida (Se Forró)' },
              { id: 'biggestLoser', label: 'Mayor Caída (Se Arruinó)' },
            ].map((opt) => (
              <label
                key={opt.id}
                className="border-dracula-gray/20 flex cursor-pointer items-center gap-3 rounded-xl border bg-black/50 p-3 transition-colors hover:border-[#8be9fd]/50"
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                    bulletinConfig[opt.id as keyof typeof bulletinConfig]
                      ? 'border-[#8be9fd] bg-[#8be9fd]'
                      : 'border-dracula-gray'
                  }`}
                >
                  {bulletinConfig[opt.id as keyof typeof bulletinConfig] && (
                    <Check
                      size={14}
                      className="text-dracula-base"
                      strokeWidth={3}
                    />
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={
                    bulletinConfig[opt.id as keyof typeof bulletinConfig]
                  }
                  onChange={(e) =>
                    setBulletinConfig({
                      ...bulletinConfig,
                      [opt.id]: e.target.checked,
                    })
                  }
                />
                <span className="text-dracula-light text-xs font-bold">
                  {opt.label}
                </span>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePreviewBoletin}
              className="text-dracula-base bg-dracula-purple hover:bg-dracula-purple/80 flex flex-1 items-center justify-center gap-2 rounded-xl p-3 font-bold transition-colors"
            >
              <Eye size={18} /> Vista Previa
            </button>
            <button
              onClick={handleProgramBoletin}
              className="text-dracula-base flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#8be9fd] p-3 font-bold transition-colors hover:bg-[#8be9fd]/80"
            >
              <Clock size={18} /> Programar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE VALIDACIÓN AVISO INMEDIATO */}
      {isValidationOpen && (
        <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-dracula-card relative flex w-full max-w-sm flex-col rounded-2xl border border-[#8be9fd]/50 p-5 shadow-[0_0_30px_rgba(139,233,253,0.2)]">
            <button
              onClick={() => setIsValidationOpen(false)}
              className="text-dracula-gray hover:text-dracula-light absolute top-4 right-4"
            >
              <X size={20} />
            </button>
            <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-[#8be9fd]">
              <Users /> Validar Audiencia
            </h3>

            <p className="text-dracula-gray mb-4 text-xs">
              {destinatario === 'specific_user'
                ? 'Selecciona exactamente a quién quieres enviarle este aviso:'
                : `Se ha detectado a ${validationUsers.length} usuarios que cumplen tu criterio:`}
            </p>

            <div className="border-dracula-gray/20 hide-scrollbar mb-4 max-h-[40vh] flex-1 overflow-y-auto rounded-xl border bg-black/30 p-2">
              {validationLoading ? (
                <div className="text-dracula-gray animate-pulse py-10 text-center text-xs">
                  Calculando audiencia...
                </div>
              ) : destinatario === 'specific_user' ? (
                <div className="flex flex-col gap-1">
                  {validationUsers.map((u) => (
                    <label
                      key={u.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors ${
                        specificUserId === u.id
                          ? 'border border-[#8be9fd] bg-[#8be9fd]/20'
                          : 'hover:bg-dracula-gray/10 border border-transparent'
                      }`}
                    >
                      <input
                        type="radio"
                        name="specificUser"
                        className="hidden"
                        onChange={() => setSpecificUserId(u.id)}
                      />
                      <div className="text-dracula-base flex h-8 w-8 items-center justify-center rounded-full bg-[#8be9fd] text-xs font-bold">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-dracula-light text-sm font-bold">
                        @{u.username}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {validationUsers.length === 0 && (
                    <div className="text-dracula-gray py-10 text-center text-xs">
                      Ningún usuario cumple este criterio.
                    </div>
                  )}
                  {validationUsers.map((u) => (
                    <div
                      key={u.id}
                      className="border-dracula-gray/10 flex items-center gap-3 border-b p-2 last:border-0"
                    >
                      <User size={14} className="text-dracula-gray" />
                      <span className="text-dracula-light text-xs font-bold">
                        @{u.username}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSendInmediato}
              disabled={destinatario === 'specific_user' && !specificUserId}
              className="text-dracula-base flex w-full items-center justify-center gap-2 rounded-xl bg-[#8be9fd] py-3 text-sm font-bold transition-colors hover:bg-[#8be9fd]/80 disabled:opacity-50"
            >
              <Send size={16} /> Confirmar y Enviar
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
