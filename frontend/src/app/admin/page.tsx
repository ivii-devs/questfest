'use client';

/**
 * ============================================================================
 * PANEL DE CONTROL ADMINISTRATIVO ("MODO DIOS"): QuestFest PWA
 * ============================================================================
 * Centro de mando del Tribunal Arbitral de QuestFest.
 *
 * Privilegios requeridos:
 * - Rol global de cuenta: 'admin', O
 * - Rol administrativo dentro del grupo activo: 'admin'
 *
 * Módulos integrados:
 * 1. 'grupo': Ajustes de comunidad (avatar, nombre, descripción, códigos de invitación).
 * 2. 'sistema': Configuración clave-valor del boletín diario matutino (notificaciones/resumen).
 * 3. 'notificaciones': Difusión de avisos Push a la comunidad.
 * 4. 'usuarios': Gestión de cuentas, edición de roles y balances de saldo.
 * 5. 'ruleta': Configuración de multiplicadores y premios de la ruleta server-driven.
 * 6. 'apuestas': Liquidación atómica, creación y cancelación de mercados comunitarios.
 * 7. 'misiones': Auditoría de pruebas multimedia y aprobación de sugerencias ciudadanas.
 * 8. 'duelos': Arbitraje de disputas PvP, declaración de vencedor y multas disciplinarias.
 * 9. 'filtros': Reglas de moderación y palabras prohibidas.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import {
  ShieldAlert,
  Dice5,
  Target,
  Swords,
  Settings2,
  ChevronLeft,
  Filter,
  BellIcon,
  User,
  Ruler,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import TabSistema from '@/components/admin/TabSistema';
import TabApuestas from '@/components/admin/TabApuestas';
import TabMisiones from '@/components/admin/TabMisiones';
import TabDuelos from '@/components/admin/TabDuelos';
import TabFiltros from '@/components/admin/TabFiltros';
import TabNotificaciones from '@/components/admin/TabNotificaciones';
import TabUsuarios from '@/components/admin/TabUsuarios';
import TabRuleta from '@/components/admin/TabRuleta';
import TabGrupoSettings from '@/components/admin/TabGrupoSettings';
import GroupSwitcher from '@/components/groups/GroupSwitcher';

export type AdminTab =
  | 'grupo'
  | 'sistema'
  | 'notificaciones'
  | 'usuarios'
  | 'ruleta'
  | 'apuestas'
  | 'misiones'
  | 'duelos'
  | 'filtros';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { activeGroup, loading: groupLoading } = useGroup();

  const [activeTab, setActiveTab] = useState<AdminTab>('grupo');

  // Evaluación de privilegios: superusuario global O administrador de la comunidad activa
  const isAdmin = user?.rol === 'admin' || activeGroup?.rol === 'admin';

  /**
   * Guardia de navegación: si la autenticación y el grupo concluyeron su carga
   * y el usuario no ostenta rango de administrador, se redirige inmediatamente a home.
   */
  useEffect(() => {
    if (!authLoading && !groupLoading && !isAdmin) {
      router.replace('/feed');
    }
  }, [authLoading, groupLoading, isAdmin, router]);

  if (authLoading || groupLoading) {
    return (
      <div className="text-dracula-purple flex min-h-screen items-center justify-center bg-black font-bold">
        Verificando Credenciales de Administración...
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="app-shell-page text-dracula-light bg-black select-none">
      {/* --- CABECERA MODO DIOS CON ÁREA SEGURA --- */}
      <header className="bg-dracula-base/95 border-dracula-red pt-safe-top z-40 flex-shrink-0 border-b-2 px-4 pb-0 backdrop-blur-md select-none">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert size={28} className="text-dracula-red animate-pulse" />
            <div>
              <h1 className="text-dracula-red text-xl leading-tight font-black tracking-widest uppercase">
                Panel Admin
              </h1>
              {activeGroup && (
                <span className="text-dracula-purple flex items-center gap-1 text-xs font-bold">
                  Comunidad: {activeGroup.nombre}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GroupSwitcher />
            <Link
              href="/feed"
              className="bg-dracula-card text-dracula-gray hover:text-dracula-light btn-press rounded-lg p-2 transition-colors"
            >
              <ChevronLeft size={20} />
            </Link>
          </div>
        </div>

        {/* Menú de Pestañas Deslizable */}
        <div className="hide-scrollbar mb-0 flex w-full gap-2 overflow-x-auto pb-1">
          {[
            {
              id: 'grupo',
              label: 'Grupo',
              icon: Users,
              color: 'text-dracula-cyan border-dracula-cyan',
            },
            {
              id: 'sistema',
              label: 'Sistema',
              icon: Settings2,
              color: 'text-dracula-gray border-dracula-gray',
            },
            {
              id: 'notificaciones',
              label: 'Avisos',
              icon: BellIcon,
              color: 'text-[#8be9fd] border-[#8be9fd]',
            },
            {
              id: 'usuarios',
              label: 'Usuarios',
              icon: User,
              color: 'text-[#ff79c6] border-[#ff79c6]',
            },
            {
              id: 'ruleta',
              label: 'Ruleta',
              icon: Ruler,
              color: 'text-[#ffb86c] border-[#ffb86c]',
            },
            {
              id: 'apuestas',
              label: 'Apuestas',
              icon: Dice5,
              color: 'text-dracula-yellow border-dracula-yellow',
            },
            {
              id: 'misiones',
              label: 'Misiones',
              icon: Target,
              color: 'text-dracula-green border-dracula-green',
            },
            {
              id: 'duelos',
              label: 'Duelos',
              icon: Swords,
              color: 'text-dracula-red border-dracula-red',
            },
            {
              id: 'filtros',
              label: 'Filtros',
              icon: Filter,
              color: 'text-dracula-purple border-dracula-purple',
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`admin-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`btn-press flex min-w-[100px] flex-1 items-center justify-center gap-1.5 pb-3 text-sm font-bold transition-colors ${
                  isActive ? `border-b-2 ${tab.color}` : 'text-dracula-gray'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* --- CONTENIDO DINÁMICO DE LAS PESTAÑAS CON SCROLL INTERNO AISLADO --- */}
      <main className="app-shell-scroll p-4 pb-28">
        {activeTab === 'grupo' && <TabGrupoSettings />}

        {activeTab === 'sistema' && <TabSistema />}

        {activeTab === 'notificaciones' && <TabNotificaciones />}

        {activeTab === 'usuarios' && <TabUsuarios />}

        {activeTab === 'ruleta' && <TabRuleta />}

        {activeTab === 'apuestas' && <TabApuestas />}

        {activeTab === 'misiones' && <TabMisiones />}

        {activeTab === 'duelos' && <TabDuelos />}

        {activeTab === 'filtros' && <TabFiltros />}
      </main>
    </div>
  );
}
