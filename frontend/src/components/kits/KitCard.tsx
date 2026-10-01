'use client';

/**
 * ============================================================================
 * TARJETA DE KIT DE EVENTO (KitCard)
 * ============================================================================
 * Representa visualmente un kit dentro del catálogo del Hub.
 *
 * Características Mobile-First:
 * 1. Portada temática con degradado Dracula y badge de verificación oficial.
 * 2. Contador de descargas ('usos') y botón Me Gusta interactivo con actualización optimista.
 * 3. Desglose claro de retos incluidos (misiones de tablón, ruletas diarias y apuestas).
 * 4. Botón táctil accesible de 48px de altura mínima para inyección en grupos.
 * 5. Menú contextual para denuncias (comunidad) o edición/borrado (autor).
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Flame,
  Heart,
  MoreVertical,
  Flag,
  Edit2,
  Trash2,
  Layers,
  Dices,
  Target,
  ArrowRight,
} from 'lucide-react';
import { KitEventoResponse } from '@/types';
import { toggleKitLike } from '@/services/kitsService';
import toast from 'react-hot-toast';

interface KitCardProps {
  kit: KitEventoResponse;
  onUse: (kit: KitEventoResponse) => void;
  onEdit?: (kit: KitEventoResponse) => void;
  onDelete?: (kitId: number) => void;
  onReport?: (kitId: number) => void;
  currentUserId?: number;
  isGlobalAdmin?: boolean;
}

export default function KitCard({
  kit,
  onUse,
  onEdit,
  onDelete,
  onReport,
  currentUserId,
  isGlobalAdmin = false,
}: KitCardProps) {
  // Estado local para actualización optimista de likes
  const [likesCount, setLikesCount] = useState(kit.likes_count);
  const [isLiked, setIsLiked] = useState(Boolean(kit.is_liked_by_user));
  const [liking, setLiking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Soberanía sobre el kit: autor o superadmin
  const isOwner = Boolean(currentUserId && kit.autor_id === currentUserId);
  const canManage = isOwner || isGlobalAdmin;

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (liking) return;

    // Actualización optimista instantánea para respuesta fluida en pantallas táctiles
    const previousLiked = isLiked;
    const previousCount = likesCount;
    const nextLiked = !previousLiked;
    const nextCount = nextLiked ? previousCount + 1 : Math.max(0, previousCount - 1);

    setIsLiked(nextLiked);
    setLikesCount(nextCount);
    setLiking(true);

    try {
      const res = await toggleKitLike(kit.id);
      setIsLiked(res.liked);
      setLikesCount(res.likes_count);
    } catch {
      // Revertir si falló la llamada a la API
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
      toast.error('No se pudo actualizar el me gusta');
    } finally {
      setLiking(false);
    }
  };

  return (
    <div className="bg-dracula-card border-dracula-gray/20 hover:border-dracula-purple/50 relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 shadow-lg transition-all">
      {/* Portada / Cabecera de la Tarjeta */}
      <div>
        <div className="mb-3 flex items-start justify-between gap-2">
          {/* Badge de Categoría y Verificación */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="bg-dracula-purple/20 text-dracula-purple border-dracula-purple/30 rounded-full border px-2.5 py-0.5 text-[11px] font-black tracking-wider uppercase">
              {kit.categoria}
            </span>

            {kit.es_oficial ? (
              <span className="bg-gradient-to-r from-[#50fa7b]/20 to-[#8be9fd]/20 text-dracula-green border-dracula-green/40 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black">
                <Sparkles size={11} />
                OFICIAL
              </span>
            ) : (
              <span className="text-dracula-gray text-[11px] font-medium">
                por{' '}
                <strong className="text-dracula-light">
                  @{kit.autor_username || 'comunidad'}
                </strong>
              </span>
            )}
          </div>

          {/* Menú Contextual */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="text-dracula-gray hover:text-dracula-light p-1.5 transition-colors"
              aria-label="Opciones del kit"
            >
              <MoreVertical size={18} />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowMenu(false)}
                />
                <div className="bg-dracula-base border-dracula-gray/30 absolute right-0 z-30 min-w-[140px] rounded-xl border p-1 shadow-2xl">
                  {canManage && onEdit && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEdit(kit);
                      }}
                      className="text-dracula-light hover:bg-dracula-card flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
                    >
                      <Edit2 size={14} className="text-dracula-cyan" />
                      Editar Kit
                    </button>
                  )}

                  {canManage && onDelete && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDelete(kit.id);
                      }}
                      className="text-dracula-red hover:bg-dracula-card flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
                    >
                      <Trash2 size={14} />
                      Eliminar Kit
                    </button>
                  )}

                  {!kit.es_oficial && onReport && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onReport(kit.id);
                      }}
                      className="text-dracula-yellow hover:bg-dracula-card flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
                    >
                      <Flag size={14} />
                      Reportar Kit
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Título y Descripción */}
        <h3 className="text-dracula-light mb-1.5 text-base font-black tracking-wide">
          {kit.titulo}
        </h3>
        <p className="text-dracula-gray mb-3 line-clamp-2 text-xs leading-relaxed">
          {kit.descripcion}
        </p>

        {/* Resumen del Contenido (Desglose de retos) */}
        <div className="bg-dracula-base/60 border-dracula-gray/20 mb-4 flex flex-wrap items-center gap-2 rounded-xl border p-2 text-xs">
          <div className="flex items-center gap-1 font-bold text-emerald-400">
            <Layers size={13} />
            <span>{kit.total_misiones} misiones</span>
          </div>
          <span className="text-dracula-gray/40">•</span>
          <div className="flex items-center gap-1 font-bold text-amber-400">
            <Dices size={13} />
            <span>{kit.total_ruletas} ruletas</span>
          </div>
          <span className="text-dracula-gray/40">•</span>
          <div className="text-dracula-pink flex items-center gap-1 font-bold">
            <Target size={13} />
            <span>{kit.total_apuestas} apuestas</span>
          </div>
        </div>
      </div>

      {/* Pie de la Tarjeta: Métricas y Botón Primario */}
      <div className="border-dracula-gray/10 flex items-center justify-between border-t pt-3">
        {/* Métricas: Usos y Me Gusta */}
        <div className="flex items-center gap-3">
          <span
            className="text-dracula-gray flex items-center gap-1 text-xs font-bold"
            title="Veces inyectado en grupos"
          >
            <Flame size={14} className="text-orange-400" />
            {kit.descargas_count}
          </span>

          <button
            onClick={handleLikeToggle}
            className={`btn-press flex items-center gap-1 text-xs font-bold transition-all ${
              isLiked ? 'text-dracula-pink' : 'text-dracula-gray hover:text-dracula-light'
            }`}
            title="Me gusta"
            aria-label="Dar me gusta"
          >
            <Heart
              size={14}
              className={isLiked ? 'fill-dracula-pink stroke-dracula-pink' : ''}
            />
            {likesCount}
          </button>
        </div>

        {/* Botón de Acción Principal (Touch target móvil de 44-48px) */}
        <button
          onClick={() => onUse(kit)}
          className="btn-press bg-dracula-purple hover:bg-dracula-purple/90 text-dracula-base flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black shadow-md transition-all"
        >
          <span>Usar en un grupo</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
