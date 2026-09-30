'use client';

/**
 * ============================================================================
 * PESTAÑA DE ADMINISTRACIÓN DE APUESTAS (TabApuestas)
 * ============================================================================
 * Gestión del ciclo de vida de apuestas: revisión de sugerencias comunitarias,
 * fijación de cuotas, apertura de mercados y liquidación de ganadores.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  Check,
  X,
  Trophy,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Trash,
  Pencil,
  Plus,
} from 'lucide-react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { useGroup } from '@/context/GroupContext';
import { fetchActiveBets, resolveBet, deleteBet } from '@/services/betsService';
import { ApuestaResponse, BetOption } from '@/types';

export default function TabApuestas() {
  const { activeGroup } = useGroup();
  const [activeTab, setActiveTab] = useState<'sugerencias' | 'mercado'>(
    'sugerencias'
  );
  const [bets, setBets] = useState<ApuestaResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados para edición de una apuesta
  const [editingBetId, setEditingBetId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    title: string;
    options: { text: string; multiplier: number }[];
  }>({ title: '', options: [] });

  // Estados para resolución de una apuesta
  const [resolvingBetId, setResolvingBetId] = useState<string | null>(null);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string>('');

  const fetchBetsData = async () => {
    setIsLoading(true);
    try {
      const activeBets = await fetchActiveBets(activeGroup?.id);
      setBets(activeBets);
    } catch {
      toast.error('Error al cargar apuestas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBetsData();
  }, [activeGroup?.id]);

  const handleStatusUpdate = async (
    betId: string,
    estado: string,
    opcionGanadoraId?: string
  ) => {
    let updatePromise: Promise<unknown>;
    if (estado === 'cerrada' && opcionGanadoraId) {
      updatePromise = resolveBet(betId, opcionGanadoraId);
    } else {
      updatePromise = api.patch(`/api/admin/bets/${betId}/status`, {
        estado,
        opcion_ganadora_id: opcionGanadoraId,
      });
    }

    toast.promise(updatePromise, {
      loading: 'Procesando...',
      success: 'Acción completada con éxito',
      error: 'Error al actualizar apuesta',
    });

    try {
      await updatePromise;
      if (resolvingBetId === betId) {
        setResolvingBetId(null);
        setSelectedWinnerId('');
      }
      fetchBetsData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditInit = (bet: ApuestaResponse) => {
    setEditingBetId(bet.id);
    const optionsArray = bet.options
      ? bet.options.map((betOption: BetOption) => ({
          text: betOption.text,
          multiplier: Number(betOption.multiplier),
        }))
      : [];
    setEditFormData({ title: bet.title, options: optionsArray });
  };

  const handleEditSave = async (betId: string) => {
    // Filtrar opciones en blanco
    const validOptions = editFormData.options.filter(
      (betOption) => betOption.text.trim() !== '' && betOption.multiplier > 1.0
    );
    if (validOptions.length < 2) {
      toast.error('Debe haber al menos 2 opciones válidas (multiplicador > 1)');
      return;
    }
    if (editFormData.title.trim().length < 5) {
      toast.error('El título debe tener al menos 5 caracteres');
      return;
    }

    const editPromise = api.put(`/api/admin/bets/${betId}`, {
      title: editFormData.title,
      options: validOptions,
    });

    toast.promise(editPromise, {
      loading: 'Guardando...',
      success: 'Apuesta editada con éxito',
      error: 'Error al editar apuesta',
    });

    try {
      await editPromise;
      setEditingBetId(null);
      fetchBetsData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBet = async (id: string) => {
    const removePromise = deleteBet(id);
    toast.promise(removePromise, {
      loading: 'Borrando apuesta...',
      success: 'Apuesta eliminada',
      error: 'Error al borrar apuesta',
    });
    try {
      await removePromise;
      fetchBetsData();
    } catch (e) {
      console.error(e);
    }
  };

  const propuestas = bets.filter((b) => b.estado === 'propuesta');
  const abiertas = bets.filter((b) => b.estado === 'abierta');

  return (
    <div className="animate-fadeIn flex flex-col gap-6 pb-20">
      {/* Pestañas internas */}
      <div className="border-dracula-gray/20 flex border-b">
        <button
          onClick={() => setActiveTab('sugerencias')}
          className={`relative flex-1 py-3 text-sm font-bold transition-colors ${
            activeTab === 'sugerencias'
              ? 'text-[#ffb86c]'
              : 'text-dracula-gray hover:text-dracula-light'
          }`}
        >
          Sugerencias
          {propuestas.length > 0 && (
            <span className="text-dracula-base ml-2 rounded-full bg-[#ffb86c] px-1.5 py-0.5 text-[10px]">
              {propuestas.length}
            </span>
          )}
          {activeTab === 'sugerencias' && (
            <div className="absolute bottom-0 left-0 h-0.5 w-full bg-[#ffb86c]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('mercado')}
          className={`relative flex-1 py-3 text-sm font-bold transition-colors ${
            activeTab === 'mercado'
              ? 'text-dracula-yellow'
              : 'text-dracula-gray hover:text-dracula-light'
          }`}
        >
          Mercado Activo
          {abiertas.length > 0 && (
            <span className="bg-dracula-yellow text-dracula-base ml-2 rounded-full px-1.5 py-0.5 text-[10px]">
              {abiertas.length}
            </span>
          )}
          {activeTab === 'mercado' && (
            <div className="bg-dracula-yellow absolute bottom-0 left-0 h-0.5 w-full" />
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="text-dracula-gray py-10 text-center">
          Cargando apuestas...
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {activeTab === 'sugerencias' && (
            <>
              {propuestas.length === 0 ? (
                <div className="text-dracula-gray py-10 text-center text-sm">
                  No hay sugerencias pendientes
                </div>
              ) : (
                propuestas.map((bet) => (
                  <article
                    key={bet.id}
                    className="bg-dracula-card border-dracula-gray/20 rounded-xl border p-4 shadow-md"
                  >
                    {editingBetId === bet.id ? (
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="text-dracula-gray mb-1 block text-[10px] font-bold tracking-widest uppercase">
                            Título de la Apuesta
                          </label>
                          <input
                            type="text"
                            className="bg-dracula-base border-dracula-gray/20 text-dracula-light focus:border-dracula-purple w-full rounded-lg border p-2.5 text-sm focus:outline-none"
                            value={editFormData.title}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                title: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="bg-dracula-base border-dracula-gray/10 rounded-lg border p-3">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-dracula-gray text-[10px] font-bold tracking-widest uppercase">
                              Opciones
                            </p>
                            <button
                              onClick={() =>
                                setEditFormData({
                                  ...editFormData,
                                  options: [
                                    ...editFormData.options,
                                    { text: '', multiplier: 1.5 },
                                  ],
                                })
                              }
                              className="bg-dracula-purple/20 text-dracula-purple hover:bg-dracula-purple/30 flex items-center gap-1 rounded px-2 py-1 text-[10px] transition-colors"
                            >
                              <Plus size={12} /> Añadir opción
                            </button>
                          </div>

                          <ul className="flex flex-col gap-2">
                            {editFormData.options.map((betOption, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Texto de la opción"
                                  className="bg-dracula-card border-dracula-gray/20 text-dracula-light focus:border-dracula-purple flex-1 rounded-lg border p-2 text-xs focus:outline-none"
                                  value={betOption.text}
                                  onChange={(e) => {
                                    const newOpts = [...editFormData.options];
                                    newOpts[idx].text = e.target.value;
                                    setEditFormData({
                                      ...editFormData,
                                      options: newOpts,
                                    });
                                  }}
                                />
                                <div className="bg-dracula-card border-dracula-gray/20 flex w-24 items-center overflow-hidden rounded-lg border">
                                  <span className="text-dracula-gray border-dracula-gray/20 border-r px-2 text-xs">
                                    x
                                  </span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="1.1"
                                    className="w-full bg-transparent p-2 font-mono text-xs text-[#ffb86c] focus:outline-none"
                                    value={betOption.multiplier}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                      const newOpts = [...editFormData.options];
                                      newOpts[idx].multiplier =
                                        parseFloat(e.target.value) || 1.1;
                                      setEditFormData({
                                        ...editFormData,
                                        options: newOpts,
                                      });
                                    }}
                                  />
                                </div>
                                <button
                                  onClick={() => {
                                    const newOpts = [...editFormData.options];
                                    newOpts.splice(idx, 1);
                                    setEditFormData({
                                      ...editFormData,
                                      options: newOpts,
                                    });
                                  }}
                                  className="text-dracula-red hover:bg-dracula-red/10 rounded-lg p-2 transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingBetId(null)}
                            className="text-dracula-gray bg-dracula-base border-dracula-gray/20 hover:bg-dracula-gray/10 flex-1 rounded-lg border py-2 text-xs font-bold transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleEditSave(bet.id)}
                            className="bg-dracula-purple text-dracula-base flex flex-[2] items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold shadow-md transition-colors hover:opacity-90"
                          >
                            <CheckCircle2 size={14} /> Guardar Cambios
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex flex-col gap-1">
                            <h3 className="text-dracula-light text-base font-bold">
                              {bet.title}
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-bold">
                              <span className="text-dracula-green flex items-center gap-1">
                                <ThumbsUp size={12} /> {bet.upvotes || 0}
                              </span>
                              <span className="text-dracula-gray">|</span>
                              <span className="text-dracula-red flex items-center gap-1">
                                <ThumbsDown size={12} /> {bet.downvotes || 0}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditInit(bet)}
                              className="text-dracula-purple bg-dracula-purple/10 hover:bg-dracula-purple/20 rounded p-1.5 transition-colors"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <span className="text-dracula-purple bg-dracula-purple/10 rounded px-2 py-1 text-[10px] font-bold uppercase">
                              @{bet.creator}
                            </span>
                          </div>
                        </div>

                        <div className="bg-dracula-base border-dracula-gray/10 mb-4 rounded-lg border p-3">
                          <p className="text-dracula-gray mb-2 text-[10px] font-bold tracking-widest uppercase">
                            Opciones propuestas
                          </p>
                          <ul className="flex flex-col gap-1.5">
                            {bet.options?.map((betOption: BetOption) => (
                              <li
                                key={betOption.id}
                                className="flex justify-between text-xs"
                              >
                                <span className="text-dracula-light">
                                  {betOption.text}
                                </span>
                                <span className="font-mono text-[#ffb86c]">
                                  x{Number(betOption.multiplier).toFixed(2)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() =>
                              handleStatusUpdate(bet.id, 'abierta')
                            }
                            className="bg-dracula-green/20 hover:bg-dracula-green/30 text-dracula-green border-dracula-green/50 flex flex-[2] items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-bold transition-colors"
                          >
                            <Check size={16} /> Aprobar
                          </button>
                          <button
                            onClick={() =>
                              handleStatusUpdate(bet.id, 'rechazada')
                            }
                            className="bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border-dracula-red/30 flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-bold transition-colors"
                          >
                            <X size={16} /> Rechazar
                          </button>
                          <button
                            onClick={() => handleDeleteBet(bet.id)}
                            className="bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border-dracula-red/30 flex flex-none items-center justify-center rounded-lg border px-3 py-2 font-bold transition-colors"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))
              )}
            </>
          )}

          {activeTab === 'mercado' && (
            <>
              {abiertas.length === 0 ? (
                <div className="text-dracula-gray py-10 text-center text-sm">
                  No hay apuestas activas en el mercado
                </div>
              ) : (
                abiertas.map((bet) => (
                  <article
                    key={bet.id}
                    className="bg-dracula-card border-dracula-gray/20 rounded-xl border p-4 shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <h3 className="text-dracula-light text-base font-bold">
                        {bet.title}
                      </h3>
                    </div>

                    <div className="bg-dracula-base border-dracula-gray/10 mb-4 rounded-lg border p-3">
                      <ul className="flex flex-col gap-1.5">
                        {bet.options?.map((betOption: BetOption) => (
                          <li
                            key={betOption.id}
                            className="flex justify-between text-xs"
                          >
                            <span className="text-dracula-light">
                              {betOption.text}
                            </span>
                            <span className="text-dracula-yellow font-mono">
                              x{Number(betOption.multiplier).toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {resolvingBetId === bet.id ? (
                      <div className="border-dracula-green/30 bg-dracula-green/5 animate-fadeIn rounded-xl border p-3">
                        <label className="text-dracula-green mb-2 block text-[10px] font-bold tracking-widest uppercase">
                          Selecciona la opción ganadora
                        </label>
                        <select
                          value={selectedWinnerId}
                          onChange={(e) => setSelectedWinnerId(e.target.value)}
                          className="bg-dracula-base border-dracula-gray/20 text-dracula-light focus:border-dracula-green mb-3 w-full rounded-lg border p-2.5 text-sm focus:outline-none"
                        >
                          <option value="">-- Elige un ganador --</option>
                          {bet.options?.map((betOption: BetOption) => (
                            <option key={betOption.id} value={betOption.id}>
                              {betOption.text}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setResolvingBetId(null);
                              setSelectedWinnerId('');
                            }}
                            className="text-dracula-gray bg-dracula-base border-dracula-gray/20 hover:bg-dracula-gray/10 flex-1 rounded-lg border py-2 text-xs font-bold transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            disabled={!selectedWinnerId}
                            onClick={() =>
                              handleStatusUpdate(
                                bet.id,
                                'cerrada',
                                selectedWinnerId
                              )
                            }
                            className={`flex flex-[2] items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
                              selectedWinnerId
                                ? 'bg-dracula-green text-dracula-base shadow-md hover:opacity-90'
                                : 'bg-dracula-base text-dracula-gray border-dracula-gray/20 cursor-not-allowed border opacity-50'
                            }`}
                          >
                            <CheckCircle2 size={14} /> Pagar Premios
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex w-full gap-2">
                        <button
                          onClick={() => setResolvingBetId(bet.id)}
                          className="bg-dracula-yellow/10 hover:bg-dracula-yellow/20 text-dracula-yellow border-dracula-yellow/30 flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-colors"
                        >
                          <Trophy size={16} /> Resolver Ganador
                        </button>
                        <button
                          onClick={() => handleDeleteBet(bet.id)}
                          className="bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border-dracula-red/30 flex flex-none items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
