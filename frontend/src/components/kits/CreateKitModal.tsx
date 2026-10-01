'use client';

/**
 * ============================================================================
 * MODAL DE CREACIÓN Y EDICIÓN DE KITS (CreateKitModal)
 * ============================================================================
 * Permite a cualquier usuario diseñar su propia plantilla de evento desde cero:
 * 1. Definición de metadatos (Título, Descripción, Categoría y Visibilidad).
 * 2. Editor interactivo de Misiones regulares con selección de dificultad y QuestCoins.
 * 3. Editor de Misiones de Ruleta Diaria para el bombo secreto de retos.
 * 4. Diseñador de Mercados de Apuestas con cuotas y opciones personalizables.
 * 5. Reutilizable tanto para alta nueva como para edición de un kit existente.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Layers,
  Dices,
  Target,
  Sparkles,
  Globe,
  Lock,
} from 'lucide-react';
import {
  KitEventoResponse,
  CreateKitPayload,
  MisionKitItem,
  RuletaKitItem,
  ApuestaKitItem,
} from '@/types';
import { createKit, updateKit } from '@/services/kitsService';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';

interface CreateKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedKit: KitEventoResponse) => void;
  kitToEdit?: KitEventoResponse | null;
}

const CATEGORIAS_PREDEFINIDAS = ['Fiesta', 'Viajes', 'Deporte', 'Chill', 'Otro'];

export default function CreateKitModal({
  isOpen,
  onClose,
  onSuccess,
  kitToEdit,
}: CreateKitModalProps) {
  // Metadatos
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('Fiesta');
  const [esPublico, setEsPublico] = useState(true);

  // Pestaña activa del editor de ítems ('misiones' | 'ruletas' | 'apuestas')
  const [itemTab, setItemTab] = useState<'misiones' | 'ruletas' | 'apuestas'>('misiones');

  // Listas de ítems
  const [misiones, setMisiones] = useState<MisionKitItem[]>([]);
  const [ruletas, setRuletas] = useState<RuletaKitItem[]>([]);
  const [apuestas, setApuestas] = useState<ApuestaKitItem[]>([]);

  const [submitting, setSubmitting] = useState(false);

  // Inicializar o limpiar campos
  useEffect(() => {
    if (kitToEdit) {
      setTitulo(kitToEdit.titulo);
      setDescripcion(kitToEdit.descripcion);
      setCategoria(kitToEdit.categoria);
      setEsPublico(kitToEdit.es_publico);
      setMisiones(kitToEdit.contenido?.misiones || []);
      setRuletas(kitToEdit.contenido?.ruletas || []);
      setApuestas(kitToEdit.contenido?.apuestas || []);
    } else {
      setTitulo('');
      setDescripcion('');
      setCategoria('Fiesta');
      setEsPublico(true);
      setMisiones([
        {
          titulo: '',
          descripcion: '',
          dificultad: 'facil',
          recompensa_sugerida: 15,
          cupo_maximo: null,
        },
      ]);
      setRuletas([]);
      setApuestas([]);
    }
  }, [kitToEdit, isOpen]);

  if (!isOpen) return null;

  // Acciones para Misiones
  const addMision = () => {
    setMisiones([
      ...misiones,
      {
        titulo: '',
        descripcion: '',
        dificultad: 'media',
        recompensa_sugerida: 25,
        cupo_maximo: null,
      },
    ]);
  };

  const removeMision = (index: number) => {
    setMisiones(misiones.filter((_, i) => i !== index));
  };

  // Acciones para Ruletas
  const addRuleta = () => {
    setRuletas([
      ...ruletas,
      {
        titulo: '',
        descripcion: '',
        dificultad: 'media',
        recompensa_sugerida: 25,
      },
    ]);
  };

  const removeRuleta = (index: number) => {
    setRuletas(ruletas.filter((_, i) => i !== index));
  };

  // Acciones para Apuestas
  const addApuesta = () => {
    setApuestas([
      ...apuestas,
      {
        titulo: '',
        opciones: [
          { id: 'opt1', text: 'Opción 1', multiplier: 2.0 },
          { id: 'opt2', text: 'Opción 2', multiplier: 2.0 },
        ],
      },
    ]);
  };

  const removeApuesta = (index: number) => {
    setApuestas(apuestas.filter((_, i) => i !== index));
  };

  const addOptionToApuesta = (apuestaIndex: number) => {
    const updated = [...apuestas];
    const newId = `opt${updated[apuestaIndex].opciones.length + 1}`;
    updated[apuestaIndex].opciones.push({
      id: newId,
      text: '',
      multiplier: 2.0,
    });
    setApuestas(updated);
  };

  const removeOptionFromApuesta = (apuestaIndex: number, optIndex: number) => {
    const updated = [...apuestas];
    if (updated[apuestaIndex].opciones.length <= 2) {
      toast.error('Una apuesta requiere al menos dos opciones');
      return;
    }
    updated[apuestaIndex].opciones.splice(optIndex, 1);
    setApuestas(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo.trim()) {
      toast.error('El título del kit es obligatorio');
      return;
    }

    if (!descripcion.trim()) {
      toast.error('La descripción del kit es obligatoria');
      return;
    }

    // Filtrar elementos vacíos
    const cleanMisiones = misiones.filter((m) => m.titulo.trim());
    const cleanRuletas = ruletas.filter((r) => r.titulo.trim());
    const cleanApuestas = apuestas.filter(
      (a) => a.titulo.trim() && a.opciones.every((opt) => opt.text.trim())
    );

    if (
      cleanMisiones.length === 0 &&
      cleanRuletas.length === 0 &&
      cleanApuestas.length === 0
    ) {
      toast.error('Debes incluir al menos un reto, ruleta o apuesta en el kit');
      return;
    }

    const payload: CreateKitPayload = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      categoria,
      es_publico: esPublico,
      contenido: {
        misiones: cleanMisiones,
        ruletas: cleanRuletas,
        apuestas: cleanApuestas,
      },
    };

    setSubmitting(true);
    try {
      let saved: KitEventoResponse;
      if (kitToEdit) {
        saved = await updateKit(kitToEdit.id, payload);
        toast.success('¡Kit actualizado exitosamente!');
      } else {
        saved = await createKit(payload);
        toast.success('¡Kit publicado exitosamente!');
      }
      onSuccess(saved);
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
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-dracula-light text-base font-black tracking-wide">
                {kitToEdit ? 'Editar Kit de Eventos' : 'Crear Nuevo Kit de Eventos'}
              </h2>
              <p className="text-dracula-gray text-xs">
                Empaqueta retos y apuestas reutilizables para cualquier comunidad
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
            {/* Metadatos Generales */}
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
                  placeholder="Ej: Fin de Semana de Casa Rural"
                  className="bg-dracula-card border-dracula-gray/40 text-dracula-light focus:border-dracula-purple w-full rounded-xl border px-3 py-2 text-xs font-semibold focus:outline-none"
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
                  placeholder="Explica para qué tipo de eventos está pensado y qué lo hace divertido..."
                  className="bg-dracula-card border-dracula-gray/40 text-dracula-light focus:border-dracula-purple w-full rounded-xl border px-3 py-2 text-xs leading-relaxed focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-dracula-light mb-1 block text-xs font-bold uppercase">
                    Categoría Temática
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

            {/* Sub-pestañas de Editor de Ítems */}
            <div>
              <div className="border-dracula-gray/20 bg-dracula-card flex rounded-xl border p-1">
                <button
                  type="button"
                  onClick={() => setItemTab('misiones')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                    itemTab === 'misiones'
                      ? 'bg-dracula-purple text-dracula-base shadow-md'
                      : 'text-dracula-gray hover:text-dracula-light'
                  }`}
                >
                  <Layers size={14} />
                  <span>Misiones ({misiones.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setItemTab('ruletas')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                    itemTab === 'ruletas'
                      ? 'bg-dracula-purple text-dracula-base shadow-md'
                      : 'text-dracula-gray hover:text-dracula-light'
                  }`}
                >
                  <Dices size={14} />
                  <span>Ruletas ({ruletas.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setItemTab('apuestas')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                    itemTab === 'apuestas'
                      ? 'bg-dracula-purple text-dracula-base shadow-md'
                      : 'text-dracula-gray hover:text-dracula-light'
                  }`}
                >
                  <Target size={14} />
                  <span>Apuestas ({apuestas.length})</span>
                </button>
              </div>
            </div>

            {/* Contenido según pestaña de ítems */}
            {itemTab === 'misiones' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-dracula-gray text-xs">
                    Misiones que aparecerán en el tablón común
                  </span>
                  <button
                    type="button"
                    onClick={addMision}
                    className="bg-dracula-purple/20 hover:bg-dracula-purple/30 text-dracula-purple flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors"
                  >
                    <Plus size={14} />
                    Añadir Misión
                  </button>
                </div>

                {misiones.map((m, index) => (
                  <div
                    key={index}
                    className="bg-dracula-card border-dracula-gray/20 rounded-xl border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={m.titulo}
                        onChange={(e) => {
                          const updated = [...misiones];
                          updated[index].titulo = e.target.value;
                          setMisiones(updated);
                        }}
                        placeholder={`Título del Reto #${index + 1}`}
                        className="bg-dracula-base border-dracula-gray/30 text-dracula-light flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => removeMision(index)}
                        className="text-dracula-gray hover:text-dracula-red p-1 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={m.descripcion}
                      onChange={(e) => {
                        const updated = [...misiones];
                        updated[index].descripcion = e.target.value;
                        setMisiones(updated);
                      }}
                      placeholder="Descripción de la misión..."
                      className="bg-dracula-base border-dracula-gray/30 text-dracula-gray w-full rounded-lg border px-2.5 py-1.5 text-xs"
                    />

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="text-dracula-gray text-[11px]">Dificultad:</span>
                        <select
                          value={m.dificultad}
                          onChange={(e) => {
                            const updated = [...misiones];
                            const diff = e.target.value;
                            updated[index].dificultad = diff;
                            // Calibración sugerida según nivel
                            if (diff === 'facil') updated[index].recompensa_sugerida = 15;
                            if (diff === 'media') updated[index].recompensa_sugerida = 25;
                            if (diff === 'dificil') updated[index].recompensa_sugerida = 50;
                            setMisiones(updated);
                          }}
                          className="bg-dracula-base border-dracula-gray/30 text-dracula-light rounded-lg border px-2 py-1 text-xs"
                        >
                          <option value="facil">Fácil</option>
                          <option value="media">Media</option>
                          <option value="dificil">Difícil</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-dracula-gray text-[11px]">Recompensa:</span>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={m.recompensa_sugerida}
                          onChange={(e) => {
                            const updated = [...misiones];
                            updated[index].recompensa_sugerida = Number(e.target.value);
                            setMisiones(updated);
                          }}
                          className="bg-dracula-base border-dracula-gray/30 text-dracula-green w-14 rounded-lg border px-2 py-1 text-right text-xs font-bold"
                        />
                        <span className="text-dracula-green text-[11px]">QC</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {itemTab === 'ruletas' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-dracula-gray text-xs">
                    Misiones secretas para la ruleta diaria
                  </span>
                  <button
                    type="button"
                    onClick={addRuleta}
                    className="bg-amber-400/20 hover:bg-amber-400/30 text-amber-400 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors"
                  >
                    <Plus size={14} />
                    Añadir Ruleta
                  </button>
                </div>

                {ruletas.map((r, index) => (
                  <div
                    key={index}
                    className="bg-dracula-card border-dracula-gray/20 rounded-xl border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={r.titulo}
                        onChange={(e) => {
                          const updated = [...ruletas];
                          updated[index].titulo = e.target.value;
                          setRuletas(updated);
                        }}
                        placeholder={`Título de la Ruleta #${index + 1}`}
                        className="bg-dracula-base border-dracula-gray/30 text-dracula-light flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => removeRuleta(index)}
                        className="text-dracula-gray hover:text-dracula-red p-1 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={r.descripcion}
                      onChange={(e) => {
                        const updated = [...ruletas];
                        updated[index].descripcion = e.target.value;
                        setRuletas(updated);
                      }}
                      placeholder="Instrucciones del reto secreto..."
                      className="bg-dracula-base border-dracula-gray/30 text-dracula-gray w-full rounded-lg border px-2.5 py-1.5 text-xs"
                    />

                    <div className="flex items-center gap-1 text-xs font-semibold">
                      <span className="text-dracula-gray text-[11px]">Premio:</span>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={r.recompensa_sugerida}
                        onChange={(e) => {
                          const updated = [...ruletas];
                          updated[index].recompensa_sugerida = Number(e.target.value);
                          setRuletas(updated);
                        }}
                        className="bg-dracula-base border-dracula-gray/30 text-dracula-green w-14 rounded-lg border px-2 py-1 text-right text-xs font-bold"
                      />
                      <span className="text-dracula-green text-[11px]">QC</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {itemTab === 'apuestas' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-dracula-gray text-xs">
                    Mercados de apuestas con arquetipos temáticos
                  </span>
                  <button
                    type="button"
                    onClick={addApuesta}
                    className="bg-dracula-pink/20 hover:bg-dracula-pink/30 text-dracula-pink flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors"
                  >
                    <Plus size={14} />
                    Añadir Apuesta
                  </button>
                </div>

                {apuestas.map((a, apIndex) => (
                  <div
                    key={apIndex}
                    className="bg-dracula-card border-dracula-gray/20 rounded-xl border p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={a.titulo}
                        onChange={(e) => {
                          const updated = [...apuestas];
                          updated[apIndex].titulo = e.target.value;
                          setApuestas(updated);
                        }}
                        placeholder={`¿Cuál es el pronóstico de la apuesta #${apIndex + 1}?`}
                        className="bg-dracula-base border-dracula-gray/30 text-dracula-light flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => removeApuesta(apIndex)}
                        className="text-dracula-gray hover:text-dracula-red p-1 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-dracula-gray text-[11px] font-bold uppercase">
                          Opciones y Cuotas:
                        </span>
                        <button
                          type="button"
                          onClick={() => addOptionToApuesta(apIndex)}
                          className="text-dracula-purple text-[11px] font-bold hover:underline"
                        >
                          + Añadir Opción
                        </button>
                      </div>

                      {a.opciones.map((opt, optIndex) => (
                        <div key={optIndex} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => {
                              const updated = [...apuestas];
                              updated[apIndex].opciones[optIndex].text = e.target.value;
                              setApuestas(updated);
                            }}
                            placeholder={`Opción #${optIndex + 1} (ej: El anfitrión)`}
                            className="bg-dracula-base border-dracula-gray/30 text-dracula-light flex-1 rounded-lg border px-2 py-1 text-xs"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-dracula-gray text-[10px]">x</span>
                            <input
                              type="number"
                              step="0.1"
                              min="1.01"
                              value={opt.multiplier}
                              onChange={(e) => {
                                const updated = [...apuestas];
                                updated[apIndex].opciones[optIndex].multiplier = Number(
                                  e.target.value
                                );
                                setApuestas(updated);
                              }}
                              className="bg-dracula-base border-dracula-gray/30 text-dracula-pink w-14 rounded-lg border px-1.5 py-1 text-right text-xs font-bold"
                            />
                          </div>
                          {a.opciones.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOptionFromApuesta(apIndex, optIndex)}
                              className="text-dracula-gray hover:text-dracula-red p-1"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              disabled={submitting}
              className="btn-press bg-dracula-purple hover:bg-dracula-purple/90 text-dracula-base flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black shadow-lg transition-all disabled:opacity-50"
            >
              <span>{submitting ? 'Guardando...' : kitToEdit ? 'Guardar Cambios' : 'Publicar Kit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
