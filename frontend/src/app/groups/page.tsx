'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  User,
  Settings,
  Plus,
  UserPlus,
  Coins,
  Trophy,
  MoreVertical,
  LogOut,
  QrCode,
  ChevronRight,
  ShieldAlert,
  Bell,
  Download,
  Info,
  Check
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useGroup, GroupMembership } from '@/context/GroupContext';
import CreateGroupModal from '@/components/groups/CreateGroupModal';
import JoinGroupModal from '@/components/groups/JoinGroupModal';
import GroupInviteModal from '@/components/groups/GroupInviteModal';
import { subscribeToPushNotifications, isPushActive } from '@/lib/pushNotifications';
import toast from 'react-hot-toast';
import Link from 'next/link';
import ThemeSettingsCard from '@/components/ThemeSettingsCard';

/**
 * Hub de Bienvenida (Welcome Hub) de QuestFest (/groups).
 * 
 * Punto de entrada principal tras el inicio de sesión.
 * Ofrece 3 pestañas principales de navegación:
 * 1. "Mis Grupos": Listado de comunidades en tarjetas apiladas horizontales de ancho completo
 *    con menú de 3 puntos (...), saldo local e invitaciones restringidas a Administradores.
 * 2. "Mi Perfil": Identidad global de la cuenta (Avatar, username, bio).
 * 3. "Ajustes Generales": Configuración general de la aplicación, estado PWA y cierre de sesión.
 */
function WelcomeHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as 'grupos' | 'perfil' | 'ajustes' | null;

  const { user, logout } = useAuth();
  const { groups, activeGroup, loading, setActiveGroupById, leaveGroup } = useGroup();

  const [activeTab, setActiveTab] = useState<'grupos' | 'perfil' | 'ajustes'>(initialTab || 'grupos');

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [inviteModalGroup, setInviteModalGroup] = useState<{ id: number; name: string } | null>(null);

  // Menú flotante de 3 puntos activo (ID del grupo)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Estado de notificaciones Push del dispositivo
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    isPushActive().then(setPushEnabled);
  }, []);

  // Cerrar menú contextual al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSelectGroup = (group: GroupMembership) => {
    setActiveGroupById(group.id);
    toast.success(`Entrando a: ${group.nombre}`);
    router.push('/');
  };

  /**
   * Abandona voluntariamente una comunidad.
   * Al abandonar, se elimina la membresía y el saldo local queda revocado en ese grupo.
   */
  const handleLeaveGroup = async (e: React.MouseEvent, group: GroupMembership) => {
    e.stopPropagation();
    if (!confirm(`¿Estás seguro de que deseas abandonar el grupo "${group.nombre}"? Perderás tu saldo y progreso local.`)) {
      return;
    }
    try {
      await leaveGroup(group.id);
      toast.success(`Has abandonado "${group.nombre}"`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Error al abandonar el grupo');
    }
  };

  return (
    <div className="app-shell-page bg-black text-dracula-light select-none">
      {/* 
        * CABECERA PRINCIPAL DEL HUB (App Shell - Capa Superior Fija):
        * - 'flex-shrink-0': permanece 100% inamovible en su posición física sin posibilidad de desplazarse.
        * - 'pt-safe-top': respeta el notch y Dynamic Island de iPhone.
        * - 'bg-dracula-base/95' con 'shadow': oculta limpiamente el contenido que se desplaza por debajo.
        */}
      <header className="flex-shrink-0 bg-dracula-base/95 backdrop-blur-md z-40 border-b border-dracula-gray/20 pt-safe-top pb-3 px-4 app-shell-header">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-dracula-purple to-[#ff79c6] flex items-center justify-center text-dracula-base font-black shadow-lg select-none">
              QF
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wide text-dracula-light select-none">QuestFest Hub</h1>
              <p className="text-[11px] text-dracula-gray font-semibold select-none">
                Bienvenido, <span className="text-dracula-purple">@{user?.username || 'jugador'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-2 text-dracula-gray hover:text-dracula-red bg-dracula-card hover:bg-dracula-base rounded-xl transition-colors border border-dracula-gray/20 btn-press"
            title="Cerrar Sesión"
            aria-label="Cerrar Sesión"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* 3 Pestañas Principales del Hub con microescalado táctil */}
        <div className="flex bg-dracula-card/80 p-1 rounded-xl border border-dracula-gray/20">
          <button
            onClick={() => setActiveTab('grupos')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 btn-press ${
              activeTab === 'grupos'
                ? 'bg-dracula-purple text-dracula-base shadow-md'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            <Users size={16} />
            <span>Mis Grupos</span>
            {groups.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === 'grupos' ? 'bg-dracula-base text-dracula-purple' : 'bg-dracula-base/80 text-dracula-light'
              }`}>
                {groups.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('perfil')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 btn-press ${
              activeTab === 'perfil'
                ? 'bg-dracula-purple text-dracula-base shadow-md'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            <User size={16} />
            <span>Mi Perfil</span>
          </button>

          <button
            onClick={() => setActiveTab('ajustes')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 btn-press ${
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

      {/* --- CUERPO DEL APP SHELL CON SCROLL INTERNO AISLADO --- */}
      <main className="app-shell-scroll p-4 pb-28">
        {/* ======================================================== */}
        {/* PESTAÑA 1: MIS GRUPOS                                    */}
        {/* ======================================================== */}
        {activeTab === 'grupos' && (
          <div className="space-y-4">
            {/* Botones de Acción Superior */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsCreateOpen(true)}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-dracula-purple to-[#ff79c6] text-dracula-base font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(189,147,249,0.3)] btn-press"
              >
                <Plus size={18} />
                <span>Crear Grupo</span>
              </button>

              <button
                onClick={() => setIsJoinOpen(true)}
                className="py-3 px-4 rounded-xl bg-dracula-card border border-dracula-cyan/40 text-dracula-cyan font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-dracula-cyan/10 btn-press"
              >
                <UserPlus size={18} />
                <span>Unirse a Grupo</span>
              </button>
            </div>

            {/* Listado de Grupos */}
            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold uppercase tracking-widest text-dracula-gray">
                  Tus Comunidades Activas
                </span>
                <span className="text-[11px] text-dracula-gray">
                  Toca una tarjeta para ingresar
                </span>
              </div>

              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-3 border-dracula-purple border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold text-dracula-gray">Cargando tus grupos...</span>
                </div>
              ) : groups.length === 0 ? (
                <div className="py-12 px-6 text-center bg-dracula-card/60 border border-dracula-gray/20 rounded-2xl flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-dracula-purple/10 text-dracula-purple flex items-center justify-center mb-3">
                    <Users size={28} />
                  </div>
                  <h3 className="text-base font-black text-dracula-light mb-1">Aún no estás en ningún grupo</h3>
                  <p className="text-xs text-dracula-gray mb-4 max-w-xs">
                    Crea un nuevo grupo para competir con tus amigos o únete con un código de invitación.
                  </p>
                  <button
                    onClick={() => setIsCreateOpen(true)}
                    className="py-2.5 px-5 bg-dracula-purple text-dracula-base font-black text-xs uppercase rounded-xl tracking-wider shadow-lg btn-press"
                  >
                    Crear Mi Primer Grupo
                  </button>
                </div>
              ) : (
                /* Tarjetas apiladas horizontales de ancho completo con microescalado táctil */
                groups.map((group) => {
                  const isCurrentActive = activeGroup?.id === group.id;
                  const isAdmin = group.rol === 'admin';

                  return (
                    <div
                      key={group.id}
                      onClick={() => handleSelectGroup(group)}
                      className={`w-full bg-dracula-card border rounded-2xl p-4 transition-all relative cursor-pointer btn-press active:scale-[0.98] ${
                        isCurrentActive
                          ? 'border-dracula-purple shadow-[0_0_20px_rgba(189,147,249,0.2)] ring-1 ring-dracula-purple/50'
                          : 'border-dracula-gray/20 hover:border-dracula-gray/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Avatar / Inicial del Grupo */}
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-dracula-base to-dracula-card border border-dracula-purple/40 flex items-center justify-center text-lg font-black text-dracula-purple shadow-md overflow-hidden shrink-0">
                            {group.avatar_url ? (
                              <img
                                src={group.avatar_url}
                                alt={group.nombre}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              group.nombre.charAt(0).toUpperCase()
                            )}
                          </div>

                          {/* Info Principal */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="text-base font-black text-dracula-light truncate">
                                {group.nombre}
                              </h3>
                              {isAdmin ? (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-dracula-purple/20 text-dracula-purple border border-dracula-purple/40 shrink-0">
                                  ADMIN
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-dracula-gray/10 text-dracula-gray shrink-0">
                                  MIEMBRO
                                </span>
                              )}
                            </div>

                            {group.descripcion && (
                              <p className="text-xs text-dracula-gray line-clamp-1 mb-2">
                                {group.descripcion}
                              </p>
                            )}

                            {/* Metadatos Económicos Aislados de este Grupo */}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <div className="flex items-center gap-1.5 bg-dracula-base/80 px-2.5 py-1 rounded-lg border border-dracula-yellow/30">
                                <Coins size={13} className="text-dracula-yellow" />
                                <span className="text-xs font-black text-dracula-yellow">
                                  {group.saldo_grupo}
                                </span>
                                <span className="text-[10px] text-dracula-gray font-bold">QC</span>
                              </div>

                              {group.ranking_posicion && (
                                <div className="flex items-center gap-1 bg-dracula-base/80 px-2 py-1 rounded-lg border border-dracula-purple/20 text-dracula-light text-xs font-bold">
                                  <Trophy size={12} className="text-dracula-purple" />
                                  <span>#{group.ranking_posicion}</span>
                                </div>
                              )}

                              {group.miembros_totales !== undefined && (
                                <span className="text-[11px] text-dracula-gray flex items-center gap-1 font-semibold">
                                  <Users size={12} />
                                  {group.miembros_totales} miembros
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Menú de 3 Puntos (...) */}
                        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === group.id ? null : group.id)}
                            className="p-2 text-dracula-gray hover:text-dracula-light hover:bg-dracula-base rounded-xl transition-colors"
                            aria-label="Opciones del grupo"
                          >
                            <MoreVertical size={18} />
                          </button>

                          {/* Dropdown flotante */}
                          {openMenuId === group.id && (
                            <div className="absolute right-0 top-10 z-30 w-48 bg-dracula-base border border-dracula-gray/30 rounded-xl shadow-2xl py-1.5 animate-scale-in">
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleSelectGroup(group);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-dracula-light hover:bg-dracula-purple hover:text-dracula-base flex items-center gap-2 transition-colors"
                              >
                                <ChevronRight size={14} />
                                Entrar al Grupo
                              </button>

                              {/* Opciones exclusivas para Administradores de Grupo */}
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setInviteModalGroup({ id: group.id, name: group.nombre });
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-bold text-dracula-purple hover:bg-dracula-purple hover:text-dracula-base flex items-center gap-2 transition-colors"
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
                                    className="w-full text-left px-3 py-2 text-xs font-bold text-dracula-cyan hover:bg-dracula-cyan hover:text-dracula-base flex items-center gap-2 transition-colors"
                                  >
                                    <ShieldAlert size={14} />
                                    Panel Administrador
                                  </button>
                                </>
                              )}

                              <div className="my-1 border-t border-dracula-gray/20"></div>

                              <button
                                onClick={(e) => {
                                  setOpenMenuId(null);
                                  handleLeaveGroup(e, group);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-dracula-red hover:bg-dracula-red hover:text-dracula-base flex items-center gap-2 transition-colors"
                              >
                                <LogOut size={14} />
                                Salir del Grupo
                              </button>
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
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 2: MI PERFIL (Identidad Global de la Cuenta)      */}
        {/* ======================================================== */}
        {activeTab === 'perfil' && (
          <div className="space-y-5 animate-fade-in max-w-lg mx-auto">
            {/* Tarjeta de Identidad Global */}
            <div className="bg-dracula-card border border-dracula-gray/20 rounded-2xl p-6 text-center relative overflow-hidden shadow-xl">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-dracula-purple to-[#ff79c6] flex items-center justify-center text-4xl font-black text-dracula-base shadow-[0_0_25px_rgba(189,147,249,0.4)] mx-auto mb-4 overflow-hidden">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user?.username?.charAt(0).toUpperCase() || '?'
                )}
              </div>

              <h2 className="text-xl font-black text-dracula-light mb-0.5">
                @{user?.username}
              </h2>
              <span className="text-xs text-dracula-gray block mb-3">
                Identidad Global de Cuenta
              </span>

              {user?.bio ? (
                <p className="text-sm text-dracula-light/90 italic bg-dracula-base/60 p-3 rounded-xl border border-dracula-gray/20 mb-4">
                  &ldquo;{user.bio}&rdquo;
                </p>
              ) : (
                <p className="text-xs text-dracula-gray italic mb-4">
                  Sin biografía añadida aún.
                </p>
              )}

              <Link
                href="/settings/editar"
                className="inline-flex items-center gap-2 py-2.5 px-5 bg-dracula-base border border-dracula-purple/50 text-dracula-purple hover:bg-dracula-purple hover:text-dracula-base rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md"
              >
                <Settings size={14} />
                <span>Editar Información Global</span>
              </Link>
            </div>

            {/* Banner explicativo del Aislamiento de Estadísticas */}
            <div className="p-4 bg-dracula-purple/10 border border-dracula-purple/30 rounded-2xl flex items-start gap-3">
              <Info size={20} className="text-dracula-purple shrink-0 mt-0.5" />
              <div className="text-xs text-dracula-light leading-relaxed">
                <strong className="block text-dracula-purple mb-0.5">¿Dónde está mi historial y actividad?</strong>
                El saldo de QuestCoins, apuestas, duelos y misiones son independientes por cada grupo.
                Para consultar tu historial y estadísticas de una comunidad, entra al grupo y pulsa en la pestaña <strong>Estadísticas</strong>.
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 3: AJUSTES GENERALES                             */}
        {/* ======================================================== */}
        {activeTab === 'ajustes' && (
          <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
            {/* Control de Tema y Paleta Cromática Híbrida */}
            <ThemeSettingsCard />

            <div className="bg-dracula-card border border-dracula-gray/20 rounded-2xl divide-y divide-dracula-gray/20 overflow-hidden shadow-xl">
              {/* Notificaciones del Dispositivo */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-dracula-cyan/10 text-dracula-cyan rounded-xl">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-dracula-light">Notificaciones Push</h4>
                    <p className="text-xs text-dracula-gray">Avisos de duelos y misiones en vivo</p>
                  </div>
                </div>
                {pushEnabled ? (
                  <span className="py-1 px-2.5 bg-dracula-green/10 text-dracula-green border border-dracula-green/30 rounded-lg text-xs font-bold flex items-center gap-1">
                    <Check size={14} /> Activadas
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      setPushLoading(true);
                      try {
                        const res = await subscribeToPushNotifications();
                        if (res.success) {
                          setPushEnabled(true);
                          toast.success(res.message);
                        } else {
                          if (res.status === 'requires_https' || res.status === 'requires_pwa_install') {
                            toast(res.message, { icon: 'ℹ️', duration: 6500 });
                          } else {
                            toast.error(res.message);
                          }
                        }
                      } catch {
                        toast.error('Error solicitando notificaciones push');
                      } finally {
                        setPushLoading(false);
                      }
                    }}
                    disabled={pushLoading}
                    className="py-1.5 px-3 bg-dracula-base text-dracula-cyan border border-dracula-cyan/30 rounded-lg text-xs font-bold hover:bg-dracula-cyan hover:text-dracula-base transition-colors disabled:opacity-50"
                  >
                    {pushLoading ? 'Activando...' : 'Permitir'}
                  </button>
                )}
              </div>

              {/* Instalación de la PWA */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#50fa7b]/10 text-[#50fa7b] rounded-xl">
                    <Download size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-dracula-light">App Progresiva (PWA)</h4>
                    <p className="text-xs text-dracula-gray">Instala QuestFest en tu pantalla de inicio</p>
                  </div>
                </div>
                <span className="text-[11px] font-black uppercase text-[#50fa7b] bg-[#50fa7b]/10 px-2.5 py-1 rounded-lg">
                  Instalable
                </span>
              </div>

              {/* Cerrar Sesión */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-dracula-red/10 text-dracula-red rounded-xl">
                    <LogOut size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-dracula-red">Cerrar Sesión</h4>
                    <p className="text-xs text-dracula-gray">Salir de tu cuenta en este dispositivo</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="py-1.5 px-3.5 bg-dracula-red text-dracula-base font-bold text-xs rounded-lg hover:opacity-90 transition-opacity"
                >
                  Salir
                </button>
              </div>
            </div>

            <div className="text-center pt-4">
              <span className="text-[11px] text-dracula-gray font-semibold">
                QuestFest v2.0 • Arquitectura Multi-Grupo Aislada
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Modales montados condicionalmente */}
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
          isOpen={!!inviteModalGroup}
          onClose={() => setInviteModalGroup(null)}
          groupId={inviteModalGroup.id}
          groupName={inviteModalGroup.name}
        />
      )}
    </div>
  );
}

export default function WelcomeHubPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-4 border-dracula-purple border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-bold text-dracula-gray uppercase tracking-widest">
            Cargando Comunidades...
          </span>
        </div>
      }
    >
      <WelcomeHubContent />
    </React.Suspense>
  );
}

