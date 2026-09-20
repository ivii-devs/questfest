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
      toast.success(`El grupo "${groupName}" ha sido eliminado definitivamente.`);
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
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={() => !isDeleting && onClose()}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-dracula-card border border-dracula-red/50 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-[0_0_35px_rgba(255,85,85,0.25)] text-dracula-light space-y-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera con Iconografía de Alerta Crítica */}
        <div className="flex items-start justify-between gap-3 border-b border-dracula-gray/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-dracula-red/20 text-dracula-red flex items-center justify-center shrink-0 border border-dracula-red/30">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h2 className="text-base font-black text-dracula-red tracking-wide">
                Eliminar Grupo Definitivamente
              </h2>
              <p className="text-[11px] text-dracula-gray font-semibold">
                Acción destructiva e irreversible
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 text-dracula-gray hover:text-dracula-light hover:bg-dracula-base rounded-lg transition-colors disabled:opacity-40"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Desglose de Impacto e Información */}
        <div className="space-y-2.5 text-xs text-dracula-light/90 leading-relaxed">
          <p>
            Estás a punto de eliminar por completo la comunidad{' '}
            <strong className="text-dracula-yellow font-black">"{groupName}"</strong>.
          </p>

          <div className="bg-dracula-base/80 border border-dracula-red/30 rounded-xl p-3 space-y-1.5 text-[11px] text-dracula-gray">
            <p className="font-bold text-dracula-red uppercase tracking-wider text-[10px]">
              Se destruirán permanentemente:
            </p>
            <ul className="list-disc list-inside space-y-1 text-dracula-light/80">
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
            <label className="block text-[11px] font-bold text-dracula-gray mb-1.5">
              Para confirmar, escribe{' '}
              <span className="text-dracula-yellow font-black select-all font-mono">
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
              className="w-full bg-dracula-base border border-dracula-gray/30 focus:border-dracula-red focus:ring-1 focus:ring-dracula-red rounded-xl p-2.5 text-sm text-dracula-light placeholder:text-dracula-gray/40 focus:outline-none transition-all font-medium"
            />
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 py-2.5 px-4 bg-dracula-base border border-dracula-gray/30 hover:bg-dracula-gray/10 text-dracula-light font-bold text-xs uppercase tracking-wider rounded-xl transition-colors btn-press disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!isMatch || isDeleting}
              className="flex-1 py-2.5 px-4 bg-dracula-red text-dracula-base font-black text-xs uppercase tracking-wider rounded-xl hover:bg-dracula-red/90 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed btn-press"
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
