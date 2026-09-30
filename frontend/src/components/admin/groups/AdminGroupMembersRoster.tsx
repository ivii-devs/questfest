'use client';

/**
 * ============================================================================
 * COMPONENTE: LISTADO DE MIEMBROS Y ROLES (AdminGroupMembersRoster)
 * ============================================================================
 * Muestra el censo completo de participantes en el grupo activo.
 * Implementa la Soberanía del Fundador:
 * - Solamente el creador original del grupo posee privilegios para ascender
 *   a otros participantes a 'admin' o degradarlos de vuelta a 'member'.
 * - El fundador tiene inmunidad contable y administrativa: no puede ser degradado.
 * ============================================================================
 */

import React from 'react';
import { Users, Crown, Lock, UserCheck } from 'lucide-react';
import { MiembroGrupoResponse } from '@/types';

export interface AdminGroupMembersRosterProps {
  members: MiembroGrupoResponse[];
  loadingMembers: boolean;
  isCurrentUserCreator: boolean;
  activeGroupCreatorId?: number | null;
  onToggleRole: (memberUserId: number, currentRole: string) => Promise<void>;
}

export default function AdminGroupMembersRoster({
  members,
  loadingMembers,
  isCurrentUserCreator,
  activeGroupCreatorId,
  onToggleRole,
}: AdminGroupMembersRosterProps) {
  return (
    <div className="bg-dracula-card border-dracula-gray/20 rounded-2xl border p-5 shadow-xl">
      <div className="text-dracula-cyan border-dracula-gray/20 mb-4 flex items-center gap-2 border-b pb-2 text-sm font-black tracking-wider uppercase">
        <Users size={18} />
        <span>Miembros del Grupo ({members.length})</span>
      </div>

      {loadingMembers ? (
        <div className="text-dracula-gray py-8 text-center text-xs">
          Cargando miembros...
        </div>
      ) : members.length === 0 ? (
        <div className="text-dracula-gray py-6 text-center text-xs">
          No hay participantes registrados.
        </div>
      ) : (
        <div className="space-y-2.5">
          {members.map((member) => {
            const isTargetCreator = Boolean(
              member.es_creador ||
              (activeGroupCreatorId &&
                member.usuario_id === activeGroupCreatorId)
            );

            return (
              <div
                key={member.usuario_id}
                className="bg-dracula-base/70 border-dracula-gray/20 flex items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="from-dracula-purple text-dracula-base flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr to-[#ff79c6] text-xs font-black">
                    {member.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-dracula-light block truncate text-xs font-black">
                      @{member.username}
                    </span>
                    <span className="text-dracula-yellow text-[10px] font-bold">
                      {member.saldo_grupo} QuestCoins
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {/* Badge distintivo de Creador / Fundador */}
                  {isTargetCreator && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[9px] font-black text-amber-300 uppercase shadow-sm">
                      <Crown size={11} className="text-amber-400" />
                      <span>Creador</span>
                    </span>
                  )}

                  {/* Badge de Rol actual */}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                      member.rol === 'admin'
                        ? 'bg-dracula-purple/20 text-dracula-purple border-dracula-purple/40 border'
                        : 'bg-dracula-gray/10 text-dracula-gray'
                    }`}
                  >
                    {member.rol}
                  </span>

                  {/* Botón de Gestión de Rol (Soberanía Exclusiva del Fundador) */}
                  {!isCurrentUserCreator ? (
                    <button
                      type="button"
                      disabled
                      className="bg-dracula-card/40 border-dracula-gray/20 text-dracula-gray/40 cursor-not-allowed rounded-lg border p-1.5 text-[10px] font-bold"
                      title="Solo el creador del grupo puede gestionar los roles de los miembros"
                      aria-label="Solo el creador del grupo puede gestionar los roles de los miembros"
                    >
                      <Lock size={14} />
                    </button>
                  ) : isTargetCreator ? (
                    <button
                      type="button"
                      disabled
                      className="bg-dracula-card/40 border-dracula-gray/20 text-dracula-gray/40 cursor-not-allowed rounded-lg border p-1.5 text-[10px] font-bold"
                      title="El creador del grupo no puede ser desasignado como administrador"
                      aria-label="El creador del grupo no puede ser desasignado como administrador"
                    >
                      <Lock size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onToggleRole(member.usuario_id, member.rol)
                      }
                      className={`bg-dracula-card hover:bg-dracula-base rounded-lg border p-1.5 text-[10px] font-bold transition-colors ${
                        member.rol === 'admin'
                          ? 'border-dracula-red/30 text-dracula-red hover:text-dracula-red/80'
                          : 'border-dracula-gray/30 text-dracula-gray hover:text-dracula-light'
                      }`}
                      title={
                        member.rol === 'admin'
                          ? 'Revocar rol de administrador'
                          : 'Ascender a Administrador'
                      }
                      aria-label={
                        member.rol === 'admin'
                          ? 'Revocar rol de administrador'
                          : 'Ascender a Administrador'
                      }
                    >
                      <UserCheck size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
