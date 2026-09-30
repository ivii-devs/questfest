'use client';

/**
 * ============================================================================
 * COMPONENTE: ZONA DE PELIGRO DEL GRUPO (AdminGroupDangerZone)
 * ============================================================================
 * Proporciona el disparador para la destrucción irreversible del grupo.
 * Soberanía Absoluta del Fundador:
 * - Solo se renderiza si el usuario actual es el creador original del grupo.
 * - Abre el modal de confirmación por escritura exacta (`DeleteGroupModal`).
 * ============================================================================
 */

import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

export interface AdminGroupDangerZoneProps {
  isCurrentUserCreator: boolean;
  onOpenDeleteModal: () => void;
}

export default function AdminGroupDangerZone({
  isCurrentUserCreator,
  onOpenDeleteModal,
}: AdminGroupDangerZoneProps) {
  if (!isCurrentUserCreator) {
    return null;
  }

  return (
    <div className="bg-dracula-card border-dracula-red/40 animate-fade-in space-y-3 rounded-2xl border p-5 shadow-xl">
      <div className="text-dracula-red border-dracula-gray/20 flex items-center gap-2 border-b pb-2 text-sm font-black tracking-wider uppercase">
        <AlertTriangle size={18} />
        <span>Zona de Peligro</span>
      </div>

      <p className="text-dracula-gray text-xs leading-relaxed">
        La eliminación de la comunidad destruye de forma permanente e
        irreversible todas las publicaciones, retos, apuestas, duelos y saldos
        de QuestCoins de todos los participantes. Esta acción no se puede
        deshacer.
      </p>

      <button
        type="button"
        onClick={onOpenDeleteModal}
        className="bg-dracula-red/10 border-dracula-red hover:bg-dracula-red text-dracula-red hover:text-dracula-base btn-press flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black tracking-wider uppercase shadow-md transition-all"
      >
        <Trash2 size={16} />
        <span>Eliminar este Grupo Definitivamente</span>
      </button>
    </div>
  );
}
