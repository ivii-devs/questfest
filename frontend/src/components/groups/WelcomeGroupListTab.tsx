'use client';

/**
 * ============================================================================
 * PESTAÑA DE LISTADO DE GRUPOS DEL WELCOME HUB (WelcomeGroupListTab)
 * ============================================================================
 * Presenta las comunidades del jugador en tarjetas horizontales de ancho completo
 * con accesos rápidos, menú contextual de 3 puntos y acciones de unirse o crear.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  UserPlus,
  Coins,
  Trophy,
  MoreVertical,
  LogOut,
  QrCode,
  ChevronRight,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GroupMembership } from '@/types';

export interface WelcomeGroupListTabProps {
  groups: GroupMembership[];
  activeGroup: GroupMembership | null;
  loading: boolean;
  onSelectGroup: (group: GroupMembership) => void;
  onCreateOpen: () => void;
  onJoinOpen: () => void;
  onInviteOpen: (group: { id: number; name: string }) => void;
  onDeleteOpen: (group: { id: number; name: string }) => void;
  onLeaveGroup: (groupId: number) => Promise<void>;
  setActiveGroupById: (id: number) => void;
  currentUserId?: number;
}

export default function WelcomeGroupListTab({
  groups,
  activeGroup,
  loading,
  onSelectGroup,
  onCreateOpen,
  onJoinOpen,
  onInviteOpen,
  onDeleteOpen,
  onLeaveGroup,
  setActiveGroupById,
  currentUserId,
}: WelcomeGroupListTabProps) {
  const router = useRouter();
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  useEffect(() => {
    if (openMenuId === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openMenuId]);

  return (
    <div className="space-y-4">
      {/* Backdrop para cerrar menú contextual */}
      {openMenuId !== null && (
        <div
          className="fixed inset-0 z-30 cursor-default"
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenuId(null);
          }}
          aria-hidden="true"
        />
      )}

      {/* Botones de Acción Superior */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onCreateOpen}
          className="from-dracula-purple text-dracula-base btn-press flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r to-[#ff79c6] px-4 py-3 text-xs font-black tracking-wider uppercase shadow-[0_0_15px_rgba(189,147,249,0.3)]"
        >
          <Plus size={18} />
          <span>Crear Grupo</span>
        </button>

        <button
          onClick={onJoinOpen}
          className="bg-dracula-card border-dracula-cyan/40 text-dracula-cyan hover:bg-dracula-cyan/10 btn-press flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black tracking-wider uppercase"
        >
          <UserPlus size={18} />
          <span>Unirse a Grupo</span>
        </button>
      </div>

      {/* Listado de Grupos */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-dracula-gray text-xs font-bold tracking-widest uppercase">
            Tus Comunidades Activas
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="border-dracula-purple h-8 w-8 animate-spin rounded-full border-3 border-t-transparent"></div>
            <span className="text-dracula-gray text-xs font-bold">
              Cargando tus grupos...
            </span>
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-dracula-card/60 border-dracula-gray/20 flex flex-col items-center rounded-2xl border px-6 py-12 text-center">
            <div className="bg-dracula-purple/10 text-dracula-purple mb-3 flex h-14 w-14 items-center justify-center rounded-2xl">
              <Users size={28} />
            </div>
            <h3 className="text-dracula-light mb-1 text-base font-black">
              Aún no estás en ningún grupo
            </h3>
            <p className="text-dracula-gray mb-4 max-w-xs text-xs">
              Crea un nuevo grupo para competir con tus amigos o únete con un
              código de invitación.
            </p>
            <button
              onClick={onCreateOpen}
              className="bg-dracula-purple text-dracula-base btn-press rounded-xl px-5 py-2.5 text-xs font-black tracking-wider uppercase shadow-lg"
            >
              Crear Mi Primer Grupo
            </button>
          </div>
        ) : (
          groups.map((group) => {
            const isCurrentActive = activeGroup?.id === group.id;
            const isAdmin = group.rol === 'admin';
            const isMenuOpen = openMenuId === group.id;
            const isCreator = Boolean(
              currentUserId &&
              group.creador_id &&
              currentUserId === group.creador_id
            );

            return (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group)}
                className={`bg-dracula-card relative w-full cursor-pointer rounded-2xl border p-4 transition-all ${
                  isMenuOpen ? '' : 'btn-press active:scale-[0.98]'
                } ${
                  isCurrentActive
                    ? 'border-dracula-purple ring-dracula-purple/50 shadow-[0_0_20px_rgba(189,147,249,0.2)] ring-1'
                    : 'border-dracula-gray/20 hover:border-dracula-gray/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Avatar / Inicial del Grupo */}
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <div className="from-dracula-base to-dracula-card border-dracula-purple/40 text-dracula-purple flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-gradient-to-tr text-lg font-black shadow-md">
                      {group.avatar_url ? (
                        <img
                          src={group.avatar_url}
                          alt={group.nombre}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        group.nombre.charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Info Principal */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <h3 className="text-dracula-light truncate text-base font-black">
                          {group.nombre}
                        </h3>
                        {isAdmin ? (
                          <span className="bg-dracula-purple/20 text-dracula-purple border-dracula-purple/40 shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase">
                            ADMIN
                          </span>
                        ) : (
                          <span className="bg-dracula-gray/10 text-dracula-gray shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase">
                            MIEMBRO
                          </span>
                        )}
                      </div>

                      {group.descripcion && (
                        <p className="text-dracula-gray mb-2 line-clamp-1 text-xs">
                          {group.descripcion}
                        </p>
                      )}

                      {/* Metadatos Económicos Aislados */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        <div className="bg-dracula-base/80 border-dracula-yellow/30 flex items-center gap-1.5 rounded-lg border px-2.5 py-1">
                          <Coins size={13} className="text-dracula-yellow" />
                          <span className="text-dracula-yellow text-xs font-black">
                            {group.saldo_grupo}
                          </span>
                          <span className="text-dracula-gray text-[10px] font-bold">
                            QC
                          </span>
                        </div>

                        {group.ranking_posicion && (
                          <div className="bg-dracula-base/80 border-dracula-purple/20 text-dracula-light flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold">
                            <Trophy size={12} className="text-dracula-purple" />
                            <span>#{group.ranking_posicion}</span>
                          </div>
                        )}

                        {group.miembros_totales !== undefined && (
                          <span className="text-dracula-gray flex items-center gap-1 text-[11px] font-semibold">
                            <Users size={12} />
                            {group.miembros_totales} miembros
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Menú de 3 Puntos (...) */}
                  <div
                    className={`relative shrink-0 ${isMenuOpen ? 'z-40' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() =>
                        setOpenMenuId(isMenuOpen ? null : group.id)
                      }
                      className="text-dracula-gray hover:text-dracula-light hover:bg-dracula-base rounded-xl p-2 transition-colors"
                      aria-label="Opciones del grupo"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {/* Dropdown flotante */}
                    {isMenuOpen && (
                      <div className="bg-dracula-base border-dracula-gray/30 animate-scale-in absolute top-10 right-0 z-40 w-48 rounded-xl border py-1.5 shadow-2xl">
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            onSelectGroup(group);
                          }}
                          className="text-dracula-light hover:bg-dracula-purple hover:text-dracula-base flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold transition-colors"
                        >
                          <ChevronRight size={14} />
                          Entrar al Grupo
                        </button>

                        {/* Opciones exclusivas para Administradores */}
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                onInviteOpen({
                                  id: group.id,
                                  name: group.nombre,
                                });
                              }}
                              className="text-dracula-purple hover:bg-dracula-purple hover:text-dracula-base flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold transition-colors"
                            >
                              <QrCode size={14} />
                              Invitar participantes
                            </button>

                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                setActiveGroupById(group.id);
                                router.push('/admin');
                              }}
                              className="text-dracula-cyan hover:bg-dracula-cyan hover:text-dracula-base flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold transition-colors"
                            >
                              <ShieldAlert size={14} />
                              Panel Administrador
                            </button>
                          </>
                        )}

                        <div className="border-dracula-gray/20 my-1 border-t"></div>

                        {/* Opción Salir del Grupo */}
                        <button
                          onClick={async () => {
                            setOpenMenuId(null);
                            await onLeaveGroup(group.id);
                          }}
                          className="text-dracula-red hover:bg-dracula-red hover:text-dracula-base flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold transition-colors"
                        >
                          <LogOut size={14} />
                          Salir del Grupo
                        </button>

                        {/* Opción Eliminar Definitivamente (Solo para el fundador/creador) */}
                        {isCreator && (
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              onDeleteOpen({
                                id: group.id,
                                name: group.nombre,
                              });
                            }}
                            className="text-dracula-red hover:bg-dracula-red hover:text-dracula-base border-dracula-red/20 mt-1 flex w-full items-center gap-2 border-t px-3 py-2 text-left text-xs font-bold transition-colors"
                          >
                            <Trash2 size={14} />
                            Eliminar Grupo
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
