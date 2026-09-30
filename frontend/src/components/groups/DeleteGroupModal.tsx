'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { useGroup } from '@/context/GroupContext';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';

interface DeleteGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
  onSuccess?: () => void;
}

/**
 * Modal de Seguridad Crítica para Eliminación Definitiva de Comunidades.
 *
 * Principios de Diseño:
 * 1. Fricción Intencionada contra Borrados Accidentales: Exige escribir el nombre exacto
 *    de la comunidad para habilitar el botón destructivo.
 * 2. Transparencia de Impacto: Notifica con detalle la pérdida irreversible de publicaciones,
 *    apuestas, retos y saldos locales de QuestCoins para todos los participantes.
 * 3. Adaptabilidad PWA: Diálogo modal centrado con área táctil cómoda (mínimo 48px),
 *    estética Drácula y soporte de tecla Escape para accesibilidad física y móvil.
 */
export default function DeleteGroupModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  onSuccess,
}: DeleteGroupModalProps) {
  const { deleteGroup } = useGroup();
  const [confirmName, setConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Reiniciamos el campo de verificación cada vez que se despliega el modal
  useEffect(() => {
    if (isOpen) {
      setConfirmName('');
      setIsDeleting(false);
    }
  }, [isOpen]);

  // Accesibilidad: Cierre mediante teclado con la tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  // El botón destructivo solo se activa si el texto coincide de forma estricta
  const isMatch = confirmName.trim() === groupName.trim();

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatch || isDeleting) return;

    try {
      setIsDeleting(true);
      await deleteGroup(groupId);
      toast.success(
        `El grupo "${groupName}" ha sido eliminado definitivamente.`
      );
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar el grupo.'));
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={() => !isDeleting && onClose()}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-dracula-card border-dracula-red/50 text-dracula-light animate-scale-in w-full max-w-md space-y-4 rounded-2xl border p-5 shadow-[0_0_35px_rgba(255,85,85,0.25)] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera con Iconografía de Alerta Crítica */}
        <div className="border-dracula-gray/20 flex items-start justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-dracula-red/20 text-dracula-red border-dracula-red/30 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h2 className="text-dracula-red text-base font-black tracking-wide">
                Eliminar Grupo Definitivamente
              </h2>
              <p className="text-dracula-gray text-[11px] font-semibold">
                Acción destructiva e irreversible
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-dracula-gray hover:text-dracula-light hover:bg-dracula-base rounded-lg p-1.5 transition-colors disabled:opacity-40"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Desglose de Impacto e Información */}
        <div className="text-dracula-light/90 space-y-2.5 text-xs leading-relaxed">
          <p>
            Estás a punto de eliminar por completo la comunidad{' '}
            <strong className="text-dracula-yellow font-black">
              &ldquo;{groupName}&rdquo;
            </strong>
            .
          </p>

          <div className="bg-dracula-base/80 border-dracula-red/30 text-dracula-gray space-y-1.5 rounded-xl border p-3 text-[11px]">
            <p className="text-dracula-red text-[10px] font-bold tracking-wider uppercase">
              Se destruirán permanentemente:
            </p>
            <ul className="text-dracula-light/80 list-inside list-disc space-y-1">
              <li>El muro social, comentarios y publicaciones.</li>
              <li>Todas las misiones, retos y evidencias multimedia.</li>
              <li>Las apuestas colectivas, pronósticos y duelos 1vs1.</li>
              <li>Los saldos de QuestCoins locales de todos los miembros.</li>
            </ul>
          </div>
        </div>

        {/* Formulario de Confirmación con Validación por Nombre */}
        <form onSubmit={handleDelete} className="space-y-4 pt-1">
          <div>
            <label className="text-dracula-gray mb-1.5 block text-[11px] font-bold">
              Para confirmar, escribe{' '}
              <span className="text-dracula-yellow font-mono font-black select-all">
                {groupName}
              </span>
              :
            </label>
            <input
              type="text"
              autoFocus
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={groupName}
              disabled={isDeleting}
              className="bg-dracula-base border-dracula-gray/30 focus:border-dracula-red focus:ring-dracula-red text-dracula-light placeholder:text-dracula-gray/40 w-full rounded-xl border p-2.5 text-sm font-medium transition-all focus:ring-1 focus:outline-none"
            />
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="bg-dracula-base border-dracula-gray/30 hover:bg-dracula-gray/10 text-dracula-light btn-press flex-1 rounded-xl border px-4 py-2.5 text-xs font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!isMatch || isDeleting}
              className="bg-dracula-red text-dracula-base hover:bg-dracula-red/90 btn-press flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black tracking-wider uppercase shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Eliminando...</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>Eliminar Grupo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
