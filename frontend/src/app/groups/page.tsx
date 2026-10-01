'use client';

/**
 * ============================================================================
 * HUB DE BIENVENIDA (Welcome Hub) DE QUESTFEST (/groups)
 * ============================================================================
 * Punto de entrada principal tras el inicio de sesión.
 * Coordina las tres pestañas especializadas de la experiencia móvil:
 * 1. Mis Grupos: Listado de comunidades activas y acceso rápido.
 * 2. Mi Perfil: Identidad global de la cuenta (Avatar y biografía).
 * 3. Ajustes: Preferencias PWA, notificaciones push Web y logout.
 * ============================================================================
 */

import React, { useState } from 'react';
import { Users, User, Settings, LogOut, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useGroup, GroupMembership } from '@/context/GroupContext';
import CreateGroupModal from '@/components/groups/CreateGroupModal';
import JoinGroupModal from '@/components/groups/JoinGroupModal';
import GroupInviteModal from '@/components/groups/GroupInviteModal';
import DeleteGroupModal from '@/components/groups/DeleteGroupModal';
import WelcomeGroupListTab from '@/components/groups/WelcomeGroupListTab';
import WelcomeProfileTab from '@/components/groups/WelcomeProfileTab';
import WelcomeSettingsTab from '@/components/groups/WelcomeSettingsTab';
import WelcomeKitsTab from '@/components/kits/WelcomeKitsTab';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';

function WelcomeHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as
    'grupos' | 'kits' | 'perfil' | 'ajustes' | null;

  const { user, logout } = useAuth();
  const { groups, activeGroup, loading, setActiveGroupById, leaveGroup } =
    useGroup();

  const [activeTab, setActiveTab] = useState<'grupos' | 'kits' | 'perfil' | 'ajustes'>(
    initialTab || 'grupos'
  );

  // Sincroniza la pestaña activa si cambia el query param en la URL
  React.useEffect(() => {
    const tab = searchParams.get('tab') as 'grupos' | 'kits' | 'perfil' | 'ajustes' | null;
    if (tab && ['grupos', 'kits', 'perfil', 'ajustes'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);


  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [inviteModalGroup, setInviteModalGroup] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [deleteModalGroup, setDeleteModalGroup] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const handleSelectGroup = (group: GroupMembership) => {
    setActiveGroupById(group.id);
    toast.success(`Entrando a: ${group.nombre}`);
    router.push('/feed');
  };

  const handleLeaveGroup = async (groupId: number) => {
    const targetGroup = groups.find((g) => g.id === groupId);
    const groupName = targetGroup ? targetGroup.nombre : 'el grupo';

    if (
      !confirm(
        `¿Estás seguro de que deseas abandonar el grupo "${groupName}"? Perderás tu saldo y progreso local.`
      )
    ) {
      return;
    }
    try {
      await leaveGroup(groupId);
      toast.success(`Has abandonado "${groupName}"`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error al abandonar el grupo'));
    }
  };

  return (
    <div className="app-shell-page text-dracula-light bg-black select-none">
      {/* Cabecera Principal del Hub */}
      <header className="bg-dracula-base/95 border-dracula-gray/20 pt-safe-top app-shell-header z-40 flex-shrink-0 border-b px-4 pb-3 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="from-dracula-purple text-dracula-base flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr to-[#ff79c6] font-black shadow-lg select-none">
              QF
            </div>
            <div>
              <h1 className="text-dracula-light text-lg font-black tracking-wide select-none">
                QuestFest Hub
              </h1>
              <p className="text-dracula-gray text-[11px] font-semibold select-none">
                Bienvenido,{' '}
                <span className="text-dracula-purple">
                  @{user?.username || 'jugador'}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="text-dracula-gray hover:text-dracula-red bg-dracula-card hover:bg-dracula-base border-dracula-gray/20 btn-press rounded-xl border p-2 transition-colors"
            title="Cerrar Sesión"
            aria-label="Cerrar Sesión"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* 4 Pestañas Principales del Hub */}
        <div className="bg-dracula-card/80 border-dracula-gray/20 flex rounded-xl border p-1">
          <button
            onClick={() => setActiveTab('grupos')}
            className={`btn-press flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-all ${
              activeTab === 'grupos'
                ? 'bg-dracula-purple text-dracula-base shadow-md'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            <Users size={16} />
            <span className="hidden xs:inline">Mis</span>
            <span>Grupos</span>
            {groups.length > 0 && (
              <span
                className={`py-0.2 rounded-full px-1.5 text-[10px] font-black ${
                  activeTab === 'grupos'
                    ? 'bg-dracula-base text-dracula-purple'
                    : 'bg-dracula-base/80 text-dracula-light'
                }`}
              >
                {groups.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('kits')}
            className={`btn-press flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-all ${
              activeTab === 'kits'
                ? 'bg-dracula-purple text-dracula-base shadow-md'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            <Sparkles size={16} />
            <span>Kits</span>
          </button>

          <button
            onClick={() => setActiveTab('perfil')}
            className={`btn-press flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-all ${
              activeTab === 'perfil'
                ? 'bg-dracula-purple text-dracula-base shadow-md'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            <User size={16} />
            <span className="hidden xs:inline">Mi</span>
            <span>Perfil</span>
          </button>

          <button
            onClick={() => setActiveTab('ajustes')}
            className={`btn-press flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-all ${
              activeTab === 'ajustes'
                ? 'bg-dracula-purple text-dracula-base shadow-md'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            <Settings size={16} />
            <span>Ajustes</span>
          </button>
        </div>
      </header>

      {/* Cuerpo del App Shell con Scroll Interno Aislado */}
      <main className="app-shell-scroll p-4 pb-28">
        {activeTab === 'grupos' && (
          <WelcomeGroupListTab
            groups={groups}
            activeGroup={activeGroup}
            loading={loading}
            onSelectGroup={handleSelectGroup}
            onCreateOpen={() => setIsCreateOpen(true)}
            onJoinOpen={() => setIsJoinOpen(true)}
            onInviteOpen={(target) => setInviteModalGroup(target)}
            onDeleteOpen={(target) => setDeleteModalGroup(target)}
            onLeaveGroup={handleLeaveGroup}
            setActiveGroupById={setActiveGroupById}
            currentUserId={user?.id}
          />
        )}

        {activeTab === 'kits' && (
          <WelcomeKitsTab
            groups={groups}
            currentUserId={user?.id}
            isGlobalAdmin={user?.rol === 'admin'}
            preselectedGroupId={
              searchParams.get('groupId')
                ? Number(searchParams.get('groupId'))
                : undefined
            }
          />
        )}

        {activeTab === 'perfil' && <WelcomeProfileTab />}

        {activeTab === 'ajustes' && <WelcomeSettingsTab />}
      </main>

      {/* Modales */}
      <CreateGroupModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <JoinGroupModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
      />

      {inviteModalGroup && (
        <GroupInviteModal
          isOpen={Boolean(inviteModalGroup)}
          onClose={() => setInviteModalGroup(null)}
          groupId={inviteModalGroup.id}
          groupName={inviteModalGroup.name}
        />
      )}

      {deleteModalGroup && (
        <DeleteGroupModal
          isOpen={Boolean(deleteModalGroup)}
          onClose={() => setDeleteModalGroup(null)}
          groupId={deleteModalGroup.id}
          groupName={deleteModalGroup.name}
        />
      )}
    </div>
  );
}

export default function WelcomeHubPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black">
          <div className="border-dracula-purple h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"></div>
          <span className="text-dracula-gray text-sm font-bold tracking-widest uppercase">
            Cargando Comunidades...
          </span>
        </div>
      }
    >
      <WelcomeHubContent />
    </React.Suspense>
  );
}
