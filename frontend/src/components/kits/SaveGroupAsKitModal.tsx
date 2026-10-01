'use client';

/**
 * ============================================================================
 * MODAL DE EMPAQUETADO DE GRUPO EN KIT (SaveGroupAsKitModal) - VÍA 2
 * ============================================================================
 * Permite a los administradores de una comunidad consolidar sus retos y apuestas
 * más exitosos en un nuevo Kit de Eventos reutilizable o compartible con la comunidad.
 *
 * Flujo:
 * 1. Carga las misiones y apuestas activas del grupo.
 * 2. El usuario marca mediante checkboxes qué elementos desea incluir en la plantilla.
 * 3. Define metadatos del kit (Título, Categoría y Visibilidad pública/privada).
 * 4. Persiste el nuevo Kit sin romper la soberanía del grupo de origen.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  Layers,
  Target,
  Globe,
  Lock,
} from 'lucide-react';

import {
  MisionResponse,
  ApuestaResponse,
  CreateKitPayload,
  MisionKitItem,
  RuletaKitItem,
  ApuestaKitItem,
  OpcionApuestaKit,
} from '@/types';
import api from '@/lib/axios';
import { createKit } from '@/services/kitsService';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';

interface SaveGroupAsKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
}

const CATEGORIAS_PREDEFINIDAS = ['Fiesta', 'Viajes', 'Deporte', 'Chill', 'Otro'];

export default function SaveGroupAsKitModal({
  isOpen,
  onClose,
  groupId,
  groupName,
}: SaveGroupAsKitModalProps) {
  const [titulo, setTitulo] = useState(`Kit de ${groupName}`);
  const [descripcion, setDescripcion] = useState(
    `Plantilla empaquetada a partir de los mejores retos de la comunidad "${groupName}".`
  );
  const [categoria, setCategoria] = useState('Fiesta');
  const [esPublico, setEsPublico] = useState(true);

  // Ítems cargados del grupo
  const [loading, setLoading] = useState(false);
  const [misiones, setMisiones] = useState<(MisionResponse & { selected: boolean })[]>([]);
  const [apuestas, setApuestas] = useState<(ApuestaResponse & { selected: boolean })[]>([]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !groupId) return;

    setTitulo(`Kit de ${groupName}`);
    setDescripcion(
      `Plantilla empaquetada a partir de los mejores retos de la comunidad "${groupName}".`
    );

    let isMounted = true;
    async function loadGroupItems() {
      try {
        setLoading(true);
        const [misRes, apRes] = await Promise.all([
          api.get<MisionResponse[]>('/api/misiones/', { params: { group_id: groupId } }),
          api.get<ApuestaResponse[]>('/api/apuestas/', { params: { group_id: groupId } }),
        ]);

        if (isMounted) {
          setMisiones((misRes.data || []).map((m) => ({ ...m, selected: true })));
          setApuestas((apRes.data || []).map((a) => ({ ...a, selected: true })));
        }
      } catch {
        if (isMounted) {
          toast.error('No se pudieron cargar los retos del grupo');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadGroupItems();
    return () => {
      isMounted = false;
    };
  }, [isOpen, groupId, groupName]);

  if (!isOpen) return null;

  const totalSelected =
    misiones.filter((m) => m.selected).length + apuestas.filter((a) => a.selected).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo.trim()) {
      toast.error('El título del kit es obligatorio');
      return;
    }

    if (totalSelected === 0) {
      toast.error('Selecciona al menos un elemento para empaquetar el kit');
      return;
    }

    // Convertir misiones seleccionadas separando ruletas de tablón común
    const selectedMisiones = misiones.filter((m) => m.selected);
    const misionesKit: MisionKitItem[] = selectedMisiones
      .filter((m) => !m.is_roulette)
      .map((m) => ({
        titulo: m.title,
        descripcion: m.description,
        dificultad: m.reward > 35 ? 'dificil' : m.reward > 20 ? 'media' : 'facil',
        recompensa_sugerida: m.reward,
        cupo_maximo: m.max_completions || null,
      }));

    const ruletasKit: RuletaKitItem[] = selectedMisiones
      .filter((m) => m.is_roulette)
      .map((m) => ({
        titulo: m.title,
        descripcion: m.description,
        dificultad: 'media',
        recompensa_sugerida: m.reward,
      }));

    // Convertir apuestas seleccionadas
    const apuestasKit: ApuestaKitItem[] = apuestas
      .filter((a) => a.selected)
      .map((a) => {
        const opciones: OpcionApuestaKit[] = (a.options || []).map((opt) => ({
          id: opt.id,
          text: opt.text,
          multiplier: opt.multiplier,
        }));
        return {
          titulo: a.title,
          opciones:
            opciones.length >= 2
              ? opciones
              : [
                  { id: 'opt1', text: 'Sí', multiplier: 2.0 },
                  { id: 'opt2', text: 'No', multiplier: 2.0 },
                ],
        };
      });

    const payload: CreateKitPayload = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      categoria,
      es_publico: esPublico,
      contenido: {
        misiones: misionesKit,
        ruletas: ruletasKit,
        apuestas: apuestasKit,
      },
    };

    setSubmitting(true);
    try {
      await createKit(payload);
      toast.success('¡Grupo empaquetado y kit guardado exitosamente!');
      onClose();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Error al guardar el kit'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="bg-dracula-base border-dracula-gray/30 max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl">
        {/* Cabecera */}
        <div className="border-dracula-gray/20 bg-dracula-card/60 flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-dracula-purple/20 text-dracula-purple flex h-10 w-10 items-center justify-center rounded-xl">
              <Package size={20} />
            </div>
            <div>
              <h2 className="text-dracula-light text-base font-black tracking-wide">
                Guardar Comunidad como Kit
              </h2>
              <p className="text-dracula-gray text-xs">
                Empaqueta los retos de <strong className="text-dracula-purple">{groupName}</strong>
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

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="max-h-[calc(92vh-150px)] overflow-y-auto p-5 space-y-5">
            {/* Metadatos */}
            <div className="space-y-3">
              <div>
                <label className="text-dracula-light mb-1 block text-xs font-bold uppercase">
                  Título del Kit *
                </label>
                <input
                  type="text"
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="bg-dracula-card border-dracula-gray/40 text-dracula-light focus:border-dracula-purple w-full rounded-xl border px-3 py-2 text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-dracula-light mb-1 block text-xs font-bold uppercase">
                  Descripción *
                </label>
                <textarea
                  required
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="bg-dracula-card border-dracula-gray/40 text-dracula-light focus:border-dracula-purple w-full rounded-xl border px-3 py-2 text-xs leading-relaxed focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-dracula-light mb-1 block text-xs font-bold uppercase">
                    Categoría
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="bg-dracula-card border-dracula-gray/40 text-dracula-light focus:border-dracula-purple w-full rounded-xl border px-3 py-2 text-xs font-bold focus:outline-none"
                  >
                    {CATEGORIAS_PREDEFINIDAS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-dracula-light mb-1 block text-xs font-bold uppercase">
                    Visibilidad
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEsPublico(true)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-all ${
                        esPublico
                          ? 'border-dracula-purple bg-dracula-purple/20 text-dracula-purple'
                          : 'border-dracula-gray/30 bg-dracula-card text-dracula-gray'
                      }`}
                    >
                      <Globe size={14} />
                      Comunidad
                    </button>
                    <button
                      type="button"
                      onClick={() => setEsPublico(false)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-all ${
                        !esPublico
                          ? 'border-dracula-purple bg-dracula-purple/20 text-dracula-purple'
                          : 'border-dracula-gray/30 bg-dracula-card text-dracula-gray'
                      }`}
                    >
                      <Lock size={14} />
                      Solo para mí
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Selector de ítems con Checkboxes */}
            <div className="space-y-4">
              <span className="text-dracula-light block text-xs font-bold uppercase">
                Selecciona los elementos a incluir ({totalSelected} seleccionados)
              </span>

              {loading ? (
                <div className="text-dracula-gray py-8 text-center text-xs">
                  Cargando retos del grupo...
                </div>
              ) : (
                <>
                  {/* Misiones */}
                  {misiones.length > 0 && (
                    <div className="bg-dracula-card border-dracula-gray/20 rounded-2xl border p-3 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-emerald-400 text-xs uppercase">
                        <Layers size={14} />
                        <span>Misiones ({misiones.length})</span>
                      </div>
                      <div className="divide-dracula-gray/10 divide-y space-y-1">
                        {misiones.map((m, index) => (
                          <label
                            key={m.id}
                            className="hover:bg-dracula-base/40 flex items-start gap-2.5 rounded-lg p-2 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={m.selected}
                              onChange={(e) => {
                                const updated = [...misiones];
                                updated[index].selected = e.target.checked;
                                setMisiones(updated);
                              }}
                              className="text-dracula-purple focus:ring-dracula-purple mt-0.5 h-4 w-4 rounded"
                            />
                            <div className="flex-1 text-xs">
                              <span className="text-dracula-light block font-bold">
                                {m.title}
                              </span>
                              <span className="text-dracula-gray text-[11px] line-clamp-1">
                                {m.description}
                              </span>
                            </div>
                            <span className="text-dracula-green shrink-0 text-xs font-black">
                              {m.reward} QC
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Apuestas */}
                  {apuestas.length > 0 && (
                    <div className="bg-dracula-card border-dracula-gray/20 rounded-2xl border p-3 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-dracula-pink text-xs uppercase">
                        <Target size={14} />
                        <span>Apuestas ({apuestas.length})</span>
                      </div>
                      <div className="divide-dracula-gray/10 divide-y space-y-1">
                        {apuestas.map((a, index) => (
                          <label
                            key={a.id}
                            className="hover:bg-dracula-base/40 flex items-start gap-2.5 rounded-lg p-2 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={a.selected}
                              onChange={(e) => {
                                const updated = [...apuestas];
                                updated[index].selected = e.target.checked;
                                setApuestas(updated);
                              }}
                              className="text-dracula-pink focus:ring-dracula-pink mt-0.5 h-4 w-4 rounded"
                            />
                            <div className="flex-1 text-xs">
                              <span className="text-dracula-light block font-bold">
                                {a.title}
                              </span>
                              <span className="text-dracula-gray text-[11px]">
                                {a.options?.length || 0} opciones configuradas
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Pie */}
          <div className="border-dracula-gray/20 bg-dracula-card/80 flex items-center justify-end gap-2 border-t px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="text-dracula-gray hover:text-dracula-light px-4 py-2 text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || totalSelected === 0}
              className="btn-press bg-dracula-purple hover:bg-dracula-purple/90 text-dracula-base flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black shadow-lg transition-all disabled:opacity-50"
            >
              <Package size={15} />
              <span>{submitting ? 'Empaquetando...' : 'Empaquetar y Guardar Kit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
