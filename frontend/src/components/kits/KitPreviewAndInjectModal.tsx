'use client';

/**
 * ============================================================================
 * ASISTENTE DE PREVISUALIZACIÓN E INYECCIÓN INLINE (KitPreviewAndInjectModal)
 * ============================================================================
 * Permite al anfitrión del grupo previsualizar, editar y filtrar los elementos
 * de un kit antes de inyectarlos atómicamente en su comunidad.
 *
 * Características Clave:
 * 1. Selector de grupo destino (filtrado exclusivo de grupos con rol 'admin').
 * 2. Tres acordeones colapsables: Misiones del Tablón, Ruletas Diarias y Apuestas.
 * 3. Edición Inline: Personalización de textos, títulos y recompensas en QuestCoins.
 * 4. Asistente de Arquetipos: Asignación de miembros reales a opciones de apuestas.
 * 5. Interruptor de Estado Operativo: 'Publicar inmediatamente' vs 'Guardar como borradores'.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Dices,
  Target,
  ChevronDown,
  ChevronUp,
  Check,
  Sparkles,
  Users,
  Send,
  UserCheck,
} from 'lucide-react';
import {
  KitEventoResponse,
  GroupMembership,
  MiembroGrupoResponse,
  InyeccionKitPayload,
  InyeccionMisionItem,
  InyeccionRuletaItem,
  InyeccionApuestaItem,
} from '@/types';
import { injectKitIntoGroup } from '@/services/kitsService';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';
import { useRouter } from 'next/navigation';

interface KitPreviewAndInjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  kit: KitEventoResponse;
  adminGroups: GroupMembership[];
  preselectedGroupId?: number;
  onInjected?: () => void;
}

export default function KitPreviewAndInjectModal({
  isOpen,
  onClose,
  kit,
  adminGroups,
  preselectedGroupId,
  onInjected,
}: KitPreviewAndInjectModalProps) {
  const router = useRouter();

  // 1. Grupo destino
  const [selectedGroupId, setSelectedGroupId] = useState<number>(
    preselectedGroupId || (adminGroups.length > 0 ? adminGroups[0].id : 0)
  );

  // Miembros del grupo seleccionado para el Asistente de Arquetipos
  const [groupMembers, setGroupMembers] = useState<MiembroGrupoResponse[]>([]);

  // 2. Acordeones abiertos/cerrados

  const [openMisiones, setOpenMisiones] = useState(true);
  const [openRuletas, setOpenRuletas] = useState(true);
  const [openApuestas, setOpenApuestas] = useState(true);

  // 3. Estado editable de misiones, ruletas y apuestas
  const [misionesState, setMisionesState] = useState<
    (InyeccionMisionItem & { included: boolean })[]
  >([]);
  const [ruletasState, setRuletasState] = useState<
    (InyeccionRuletaItem & { included: boolean })[]
  >([]);
  const [apuestasState, setApuestasState] = useState<
    (InyeccionApuestaItem & { included: boolean })[]
  >([]);

  // 4. Modo operativo (Publicar inmediatamente vs Guardar como borradores)
  const [publishImmediately, setPublishImmediately] = useState(true);

  // 5. Estado de envío
  const [submitting, setSubmitting] = useState(false);

  // Inicializar estado editable a partir del kit cuando se abre
  useEffect(() => {
    if (kit?.contenido) {
      setMisionesState(
        (kit.contenido.misiones || []).map((m) => ({
          titulo: m.titulo,
          descripcion: m.descripcion,
          recompensa: m.recompensa_sugerida || 25,
          cupo_maximo: m.cupo_maximo || null,
          included: true,
        }))
      );
      setRuletasState(
        (kit.contenido.ruletas || []).map((r) => ({
          titulo: r.titulo,
          descripcion: r.descripcion,
          recompensa: r.recompensa_sugerida || 25,
          included: true,
        }))
      );
      setApuestasState(
        (kit.contenido.apuestas || []).map((a) => ({
          titulo: a.titulo,
          opciones: (a.opciones || []).map((opt) => ({ ...opt })),
          included: true,
        }))
      );
    }
  }, [kit]);

  // Cargar miembros del grupo seleccionado para el asistente de arquetipos
  useEffect(() => {
    if (!selectedGroupId) return;

    let isMounted = true;
    async function loadMembers() {
      try {
        const res = await api.get<MiembroGrupoResponse[]>(
          `/api/groups/${selectedGroupId}/members`
        );
        if (isMounted) {
          setGroupMembers(res.data || []);
        }
      } catch {
        if (isMounted) {
          setGroupMembers([]);
        }
      }
    }


    loadMembers();
    return () => {
      isMounted = false;
    };
  }, [selectedGroupId]);

  if (!isOpen) return null;

  // Contador de elementos seleccionados para inyección
  const totalSelected =
    misionesState.filter((m) => m.included).length +
    ruletasState.filter((r) => r.included).length +
    apuestasState.filter((a) => a.included).length;

  /**
   * Asistente de Arquetipos:
   * Sustituye en 1 clic el texto de una opción de apuesta con el nombre de un miembro real del grupo.
   */
  const handleAssignMemberToOption = (
    apuestaIndex: number,
    optIndex: number,
    username: string
  ) => {
    setApuestasState((prev) => {
      const updated = [...prev];
      const targetApuesta = { ...updated[apuestaIndex] };
      const targetOptions = [...targetApuesta.opciones];
      targetOptions[optIndex] = {
        ...targetOptions[optIndex],
        text: username,
      };
      targetApuesta.opciones = targetOptions;
      updated[apuestaIndex] = targetApuesta;
      return updated;
    });
    toast.success(`Asignado: @${username}`);
  };

  /**
   * Ejecuta la inyección atómica en el backend.
   */
  const handleInject = async () => {
    if (!selectedGroupId) {
      toast.error('Debes seleccionar un grupo donde seas administrador');
      return;
    }

    if (totalSelected === 0) {
      toast.error('Debes seleccionar al menos un elemento para inyectar');
      return;
    }

    setSubmitting(true);
    try {
      const payload: InyeccionKitPayload = {
        kit_id: kit.id,
        publicar_inmediatamente: publishImmediately,
        misiones_seleccionadas: misionesState
          .filter((m) => m.included)
          .map(({ titulo, descripcion, recompensa, cupo_maximo }) => ({
            titulo,
            descripcion,
            recompensa,
            cupo_maximo,
          })),
        ruletas_seleccionadas: ruletasState
          .filter((r) => r.included)
          .map(({ titulo, descripcion, recompensa }) => ({
            titulo,
            descripcion,
            recompensa,
          })),
        apuestas_seleccionadas: apuestasState
          .filter((a) => a.included)
          .map(({ titulo, opciones }) => ({
            titulo,
            opciones,
          })),
      };

      const result = await injectKitIntoGroup(selectedGroupId, payload);
      toast.success(result.mensaje || '¡Kit inyectado con éxito!');

      if (onInjected) {
        onInjected();
      }
      onClose();
      router.push('/feed');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Error al inyectar el kit'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="bg-dracula-base border-dracula-gray/30 max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl">
        {/* Cabecera del Modal */}
        <div className="border-dracula-gray/20 bg-dracula-card/60 flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-dracula-purple/20 text-dracula-purple flex h-10 w-10 items-center justify-center rounded-xl">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-dracula-light text-base font-black tracking-wide">
                Personalizar e Inyectar Kit
              </h2>
              <p className="text-dracula-gray text-xs">
                Plantilla: <span className="text-dracula-purple font-bold">{kit.titulo}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-light rounded-xl p-2 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="max-h-[calc(92vh-150px)] overflow-y-auto p-5 space-y-5">
          {/* 1. Selector de Grupo Destino */}
          <div className="bg-dracula-card border-dracula-gray/20 rounded-2xl border p-4">
            <label className="text-dracula-light mb-1.5 flex items-center gap-2 text-xs font-black tracking-wide uppercase">
              <Users size={14} className="text-dracula-purple" />
              1. Selecciona el Grupo Destino
            </label>
            {adminGroups.length === 0 ? (
              <p className="text-dracula-red text-xs font-semibold">
                No administras ningún grupo activo. Crea uno primero para usar este kit.
              </p>
            ) : (
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                className="bg-dracula-base border-dracula-gray/40 text-dracula-light focus:border-dracula-purple w-full rounded-xl border p-3 text-xs font-bold transition-all focus:outline-none"
              >
                {adminGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre} (Rol: {g.rol})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Interruptor de Estado Operativo */}
          <div className="bg-dracula-card border-dracula-gray/20 rounded-2xl border p-4">
            <span className="text-dracula-light mb-2 block text-xs font-black tracking-wide uppercase">
              2. Estado Inicial de las Misiones y Apuestas
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPublishImmediately(true)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                  publishImmediately
                    ? 'border-dracula-green bg-dracula-green/10 text-dracula-light shadow-sm'
                    : 'border-dracula-gray/20 bg-dracula-base/40 text-dracula-gray hover:border-dracula-gray/40'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    publishImmediately
                      ? 'border-dracula-green bg-dracula-green text-dracula-base'
                      : 'border-dracula-gray/50'
                  }`}
                >
                  {publishImmediately && <Check size={12} strokeWidth={3} />}
                </div>
                <div>
                  <h4 className="text-xs font-black">Publicar Inmediatamente</h4>
                  <p className="text-[11px] leading-tight opacity-80">
                    Misiones activas en el tablón y apuestas abiertas para apostar ya.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPublishImmediately(false)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                  !publishImmediately
                    ? 'border-dracula-purple bg-dracula-purple/10 text-dracula-light shadow-sm'
                    : 'border-dracula-gray/20 bg-dracula-base/40 text-dracula-gray hover:border-dracula-gray/40'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    !publishImmediately
                      ? 'border-dracula-purple bg-dracula-purple text-dracula-base'
                      : 'border-dracula-gray/50'
                  }`}
                >
                  {!publishImmediately && <Check size={12} strokeWidth={3} />}
                </div>
                <div>
                  <h4 className="text-xs font-black">Guardar como Borradores</h4>
                  <p className="text-[11px] leading-tight opacity-80">
                    Nacen como propuestas para que las actives poco a poco.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Acordeón: Misiones del Tablón */}
          {misionesState.length > 0 && (
            <div className="bg-dracula-card border-dracula-gray/20 overflow-hidden rounded-2xl border">
              <button
                type="button"
                onClick={() => setOpenMisiones(!openMisiones)}
                className="hover:bg-dracula-base/40 flex w-full items-center justify-between p-4 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-emerald-400" />
                  <span className="text-dracula-light text-xs font-black tracking-wide uppercase">
                    Misiones del Tablón ({misionesState.filter((m) => m.included).length}/
                    {misionesState.length})
                  </span>
                </div>
                {openMisiones ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {openMisiones && (
                <div className="border-dracula-gray/10 divide-dracula-gray/10 border-t divide-y p-3 space-y-3">
                  {misionesState.map((mision, index) => (
                    <div
                      key={index}
                      className={`rounded-xl p-3 transition-colors ${
                        mision.included ? 'bg-dracula-base/60' : 'bg-dracula-base/20 opacity-50'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mision.included}
                            onChange={(e) => {
                              const updated = [...misionesState];
                              updated[index].included = e.target.checked;
                              setMisionesState(updated);
                            }}
                            className="text-dracula-purple focus:ring-dracula-purple h-4 w-4 rounded"
                          />
                          <span className="text-dracula-light text-xs font-bold">
                            Incluir reto #{index + 1}
                          </span>
                        </label>

                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <span className="text-dracula-gray text-[11px]">Recompensa:</span>
                          <input
                            type="number"
                            min={1}
                            max={500}
                            value={mision.recompensa}
                            onChange={(e) => {
                              const updated = [...misionesState];
                              updated[index].recompensa = Math.max(1, Number(e.target.value));
                              setMisionesState(updated);
                            }}
                            className="bg-dracula-card border-dracula-gray/40 text-dracula-green w-16 rounded-lg border px-2 py-1 text-right text-xs font-black"
                          />
                          <span className="text-dracula-green text-[11px] font-black">QC</span>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={mision.titulo}
                        onChange={(e) => {
                          const updated = [...misionesState];
                          updated[index].titulo = e.target.value;
                          setMisionesState(updated);
                        }}
                        className="bg-dracula-card border-dracula-gray/30 text-dracula-light mb-1.5 w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                        placeholder="Título de la misión"
                      />

                      <textarea
                        rows={2}
                        value={mision.descripcion}
                        onChange={(e) => {
                          const updated = [...misionesState];
                          updated[index].descripcion = e.target.value;
                          setMisionesState(updated);
                        }}
                        className="bg-dracula-card border-dracula-gray/30 text-dracula-gray w-full rounded-lg border px-2.5 py-1.5 text-xs leading-relaxed"
                        placeholder="Descripción y condiciones"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Acordeón: Misiones de Ruleta Diaria */}
          {ruletasState.length > 0 && (
            <div className="bg-dracula-card border-dracula-gray/20 overflow-hidden rounded-2xl border">
              <button
                type="button"
                onClick={() => setOpenRuletas(!openRuletas)}
                className="hover:bg-dracula-base/40 flex w-full items-center justify-between p-4 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Dices size={16} className="text-amber-400" />
                  <span className="text-dracula-light text-xs font-black tracking-wide uppercase">
                    Misiones de Ruleta Diaria ({ruletasState.filter((r) => r.included).length}/
                    {ruletasState.length})
                  </span>
                </div>
                {openRuletas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {openRuletas && (
                <div className="border-dracula-gray/10 divide-dracula-gray/10 border-t divide-y p-3 space-y-3">
                  {ruletasState.map((ruleta, index) => (
                    <div
                      key={index}
                      className={`rounded-xl p-3 transition-colors ${
                        ruleta.included ? 'bg-dracula-base/60' : 'bg-dracula-base/20 opacity-50'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ruleta.included}
                            onChange={(e) => {
                              const updated = [...ruletasState];
                              updated[index].included = e.target.checked;
                              setRuletasState(updated);
                            }}
                            className="text-amber-400 focus:ring-amber-400 h-4 w-4 rounded"
                          />
                          <span className="text-dracula-light text-xs font-bold">
                            Incluir ruleta #{index + 1}
                          </span>
                        </label>

                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <span className="text-dracula-gray text-[11px]">Premio:</span>
                          <input
                            type="number"
                            min={1}
                            max={500}
                            value={ruleta.recompensa}
                            onChange={(e) => {
                              const updated = [...ruletasState];
                              updated[index].recompensa = Math.max(1, Number(e.target.value));
                              setRuletasState(updated);
                            }}
                            className="bg-dracula-card border-dracula-gray/40 text-dracula-green w-16 rounded-lg border px-2 py-1 text-right text-xs font-black"
                          />
                          <span className="text-dracula-green text-[11px] font-black">QC</span>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={ruleta.titulo}
                        onChange={(e) => {
                          const updated = [...ruletasState];
                          updated[index].titulo = e.target.value;
                          setRuletasState(updated);
                        }}
                        className="bg-dracula-card border-dracula-gray/30 text-dracula-light mb-1.5 w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                        placeholder="Título de la ruleta"
                      />

                      <textarea
                        rows={2}
                        value={ruleta.descripcion}
                        onChange={(e) => {
                          const updated = [...ruletasState];
                          updated[index].descripcion = e.target.value;
                          setRuletasState(updated);
                        }}
                        className="bg-dracula-card border-dracula-gray/30 text-dracula-gray w-full rounded-lg border px-2.5 py-1.5 text-xs leading-relaxed"
                        placeholder="Instrucciones del tiro"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. Acordeón: Mercados de Apuestas con Asistente de Arquetipos */}
          {apuestasState.length > 0 && (
            <div className="bg-dracula-card border-dracula-gray/20 overflow-hidden rounded-2xl border">
              <button
                type="button"
                onClick={() => setOpenApuestas(!openApuestas)}
                className="hover:bg-dracula-base/40 flex w-full items-center justify-between p-4 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-dracula-pink" />
                  <span className="text-dracula-light text-xs font-black tracking-wide uppercase">
                    Mercados de Apuestas ({apuestasState.filter((a) => a.included).length}/
                    {apuestasState.length})
                  </span>
                </div>
                {openApuestas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {openApuestas && (
                <div className="border-dracula-gray/10 divide-dracula-gray/10 border-t divide-y p-3 space-y-4">
                  {apuestasState.map((apuesta, apIndex) => (
                    <div
                      key={apIndex}
                      className={`rounded-xl p-3 transition-colors ${
                        apuesta.included ? 'bg-dracula-base/60' : 'bg-dracula-base/20 opacity-50'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={apuesta.included}
                            onChange={(e) => {
                              const updated = [...apuestasState];
                              updated[apIndex].included = e.target.checked;
                              setApuestasState(updated);
                            }}
                            className="text-dracula-pink focus:ring-dracula-pink h-4 w-4 rounded"
                          />
                          <span className="text-dracula-light text-xs font-bold">
                            Incluir apuesta #{apIndex + 1}
                          </span>
                        </label>
                      </div>

                      <input
                        type="text"
                        value={apuesta.titulo}
                        onChange={(e) => {
                          const updated = [...apuestasState];
                          updated[apIndex].titulo = e.target.value;
                          setApuestasState(updated);
                        }}
                        className="bg-dracula-card border-dracula-gray/30 text-dracula-light mb-3 w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                        placeholder="Pregunta o pronóstico"
                      />

                      {/* Opciones con Asistente de Arquetipos */}
                      <div className="space-y-2">
                        <span className="text-dracula-gray block text-[11px] font-bold uppercase">
                          Opciones y Cuotas:
                        </span>
                        {apuesta.opciones.map((opt, optIndex) => (
                          <div
                            key={opt.id || optIndex}
                            className="bg-dracula-card/80 border-dracula-gray/20 flex flex-col gap-1.5 rounded-xl border p-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex flex-1 items-center gap-2">
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) => {
                                  const updated = [...apuestasState];
                                  updated[apIndex].opciones[optIndex].text = e.target.value;
                                  setApuestasState(updated);
                                }}
                                className="bg-dracula-base border-dracula-gray/30 text-dracula-light flex-1 rounded-lg border px-2 py-1 text-xs font-medium"
                                placeholder="Texto de la opción"
                              />

                              <div className="flex items-center gap-1">
                                <span className="text-dracula-gray text-[10px]">x</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="1.01"
                                  max="50"
                                  value={opt.multiplier}
                                  onChange={(e) => {
                                    const updated = [...apuestasState];
                                    updated[apIndex].opciones[optIndex].multiplier = Number(
                                      e.target.value
                                    );
                                    setApuestasState(updated);
                                  }}
                                  className="bg-dracula-base border-dracula-gray/30 text-dracula-pink w-14 rounded-lg border px-1.5 py-1 text-right text-xs font-black"
                                />
                              </div>
                            </div>

                            {/* Selector rápido de miembros para sustitución de arquetipos */}
                            {groupMembers.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-dracula-gray text-[10px] whitespace-nowrap">
                                  <UserCheck size={12} className="inline mr-0.5 text-dracula-cyan" />
                                  Asignar:
                                </span>
                                <select
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleAssignMemberToOption(
                                        apIndex,
                                        optIndex,
                                        e.target.value
                                      );
                                      e.target.value = '';
                                    }
                                  }}
                                  className="bg-dracula-base border-dracula-gray/30 text-dracula-cyan rounded-lg border px-2 py-1 text-[11px] font-bold"
                                >
                                  <option value="" disabled>
                                    Miembro...
                                  </option>
                                  {groupMembers.map((m) => (
                                    <option key={m.id} value={m.username}>
                                      @{m.username}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie del Modal con Acción de Inyección */}
        <div className="border-dracula-gray/20 bg-dracula-card/80 flex items-center justify-between border-t px-5 py-4">
          <div className="text-xs">
            <span className="text-dracula-gray block">Total seleccionado:</span>
            <strong className="text-dracula-light font-black text-sm">
              {totalSelected} retos listos
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-dracula-gray hover:text-dracula-light px-4 py-2 text-xs font-bold transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={submitting || totalSelected === 0 || adminGroups.length === 0}
              onClick={handleInject}
              className="btn-press bg-dracula-purple hover:bg-dracula-purple/90 text-dracula-base flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black shadow-lg transition-all disabled:opacity-50"
            >
              <Send size={15} />
              <span>{submitting ? 'Inyectando...' : 'Inyectar en el Grupo'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
