'use client';

/**
 * ============================================================================
 * PESTAÑA DE CONFIGURACIÓN DEL GRUPO (TabGrupoSettings)
 * ============================================================================
 * Orquestador principal de la administración del grupo en el panel de control.
 * Coordina las 4 secciones modulares:
 * 1. AdminGroupGeneralInfo: Datos y ajustes generales, clave y saldo inicial.
 * 2. AdminGroupInviteSection: Código QR, enlace y clave alfanumérica de acceso.
 * 3. AdminGroupMembersRoster: Gestión soberana de roles de miembros.
 * 4. AdminGroupDangerZone: Destrucción definitiva del grupo (exclusiva del creador).
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';
import DeleteGroupModal from '@/components/groups/DeleteGroupModal';
import { MiembroGrupoResponse } from '@/types';
import AdminGroupGeneralInfo from './groups/AdminGroupGeneralInfo';
import AdminGroupInviteSection from './groups/AdminGroupInviteSection';
import AdminGroupMembersRoster from './groups/AdminGroupMembersRoster';
import AdminGroupDangerZone from './groups/AdminGroupDangerZone';

export default function TabGrupoSettings() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeGroup, refreshGroups } = useGroup();

  // Soberanía del Fundador: Determina si el usuario logueado es el fundador/creador del grupo activo
  const isCurrentUserCreator = Boolean(
    user && activeGroup?.creador_id && user.id === activeGroup.creador_id
  );

  // Invitaciones
  const [inviteCode, setInviteCode] = useState(
    activeGroup?.codigo_invitacion || ''
  );
  const [regenerating, setRegenerating] = useState(false);

  // Miembros
  const [members, setMembers] = useState<MiembroGrupoResponse[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Modal de Eliminación de Grupo (Zona de Peligro)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchInviteAndMembers = useCallback(async () => {
    if (!activeGroup) return;
    try {
      setLoadingMembers(true);
      const [inviteRes, membersRes] = await Promise.all([
        api.get(`/api/groups/${activeGroup.id}/invite`),
        api.get(`/api/groups/${activeGroup.id}/members`),
      ]);
      setInviteCode(inviteRes.data.codigo_invitacion);
      setMembers(membersRes.data || []);
    } catch (error) {
      console.error(
        '[TabGrupoSettings] Error al cargar datos del grupo:',
        error
      );
    } finally {
      setLoadingMembers(false);
    }
  }, [activeGroup]);

  useEffect(() => {
    if (activeGroup) {
      fetchInviteAndMembers();
    }
  }, [activeGroup, fetchInviteAndMembers]);

  const handleRegenerate = async () => {
    if (!activeGroup) return;
    if (!confirm('¿Deseas invalidar el código actual y generar uno nuevo?'))
      return;
    try {
      setRegenerating(true);
      const res = await api.post(
        `/api/groups/${activeGroup.id}/regenerate-code`
      );
      setInviteCode(res.data.codigo_invitacion);
      toast.success('Nuevo código generado con éxito');
      await refreshGroups();
    } catch {
      toast.error('Error al regenerar código');
    } finally {
      setRegenerating(false);
    }
  };

  const handleToggleMemberRole = async (
    memberUserId: number,
    currentRole: string
  ) => {
    if (!activeGroup) return;
    // Soberanía del Fundador: Solo el creador del grupo tiene potestad para delegar o revocar roles
    if (!isCurrentUserCreator) {
      toast.error(
        'Solo el creador del grupo tiene permisos para cambiar los roles de los miembros.'
      );
      return;
    }

    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const actionText =
      newRole === 'admin'
        ? 'ascender a Administrador'
        : 'revertir a Miembro normal';

    if (!confirm(`¿Seguro que deseas ${actionText} a este usuario?`)) return;

    try {
      await api.patch(
        `/api/groups/${activeGroup.id}/members/${memberUserId}/role`,
        {
          rol: newRole,
          nuevo_rol: newRole,
        }
      );
      toast.success(
        `Rol actualizado a: ${newRole === 'admin' ? 'Administrador' : 'Miembro'}`
      );
      await fetchInviteAndMembers();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo cambiar el rol'));
    }
  };

  if (!activeGroup) {
    return (
      <div className="text-dracula-gray p-8 text-center text-xs">
        No hay ningún grupo activo seleccionado.
      </div>
    );
  }

  return (
    <div className="animate-fade-in mx-auto max-w-xl space-y-6 pb-12">
      {/* Sección 1: Información del Grupo */}
      <AdminGroupGeneralInfo
        activeGroup={activeGroup}
        onGroupUpdated={async () => {
          await refreshGroups();
        }}
      />

      {/* Sección 2: Invitaciones (Solo Administrador) */}
      <AdminGroupInviteSection
        inviteCode={inviteCode}
        onRegenerateCode={handleRegenerate}
        regenerating={regenerating}
      />

      {/* Sección 3: Miembros de la Comunidad */}
      <AdminGroupMembersRoster
        members={members}
        loadingMembers={loadingMembers}
        isCurrentUserCreator={isCurrentUserCreator}
        activeGroupCreatorId={activeGroup.creador_id}
        onToggleRole={handleToggleMemberRole}
      />

      {/* Sección 4: Zona de Peligro (Soberanía Exclusiva del Creador / Fundador) */}
      <AdminGroupDangerZone
        isCurrentUserCreator={isCurrentUserCreator}
        onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
      />

      {/* Modal de confirmación obligatoria mediante nombre exacto */}
      <DeleteGroupModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        groupId={activeGroup.id}
        groupName={activeGroup.nombre}
        onSuccess={() => {
          router.replace('/groups');
        }}
      />
    </div>
  );
}
