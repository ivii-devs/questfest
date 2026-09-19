'use client';

/**
 * ============================================================================
 * CONTEXTO DE MULTI-TENANCY DE GRUPOS (GroupContext): QuestFest PWA
 * ============================================================================
 * Gestiona la pertenencia a comunidades, el grupo activo actual del jugador
 * y su saldo local de QuestCoins persistido.
 * 
 * Dinámica:
 * - Recupera los grupos vía `/api/groups/my-groups`.
 * - Recuerda el último grupo activo seleccionado en `localStorage('active_group_id')`.
 * - Proporciona `updateActiveGroupBalance` para reflejar en tiempo real cobros o gastos.
 * ============================================================================
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '@/lib/axios';
import { useAuth } from './AuthContext';

/**
 * Representa la membresía y estado de un usuario dentro de un grupo de QuestFest.
 * Contiene tanto los datos descriptivos de la comunidad como los datos económicos
 * aislados (saldo local de QuestCoins, rol de administrador/miembro y posición en el ranking).
 */
export interface GroupMembership {
  id: number;
  nombre: string;
  descripcion?: string;
  avatar_url?: string;
  codigo_invitacion: string;
  rol: 'admin' | 'member';
  saldo_grupo: number;
  ranking_posicion?: number;
  miembros_totales?: number;
  requiere_password?: boolean;
  saldo_inicial?: number;
}

interface GroupContextType {
  groups: GroupMembership[];
  activeGroup: GroupMembership | null;
  loading: boolean;
  refreshGroups: (targetActiveGroupId?: number) => Promise<void>;
  setActiveGroupById: (id: number) => void;
  leaveGroup: (id: number) => Promise<void>;
  updateActiveGroupBalance: (delta: number) => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export const GroupProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [groups, setGroups] = useState<GroupMembership[]>([]);
  const [activeGroup, setActiveGroup] = useState<GroupMembership | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Carga la lista de grupos a los que pertenece el usuario autenticado
   * y restablece el grupo activo guardado en localStorage o selecciona el primero por defecto.
   * 
   * Sincronización con AuthContext:
   * Si la sesión aún se está verificando ('authLoading' es true), mantenemos 'loading'
   * en true para prevenir condiciones de carrera y redirecciones prematuras a /groups.
   * 
   * Prioridad de Selección:
   * Si se provee 'targetActiveGroupId' (ej. creación o unión inmediata a un grupo),
   * tiene prioridad absoluta sobre la clave persistida en localStorage.
   */
  const refreshGroups = useCallback(async (targetActiveGroupId?: number) => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setGroups([]);
      setActiveGroup(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get('/api/groups/my-groups');
      const fetchedGroups: GroupMembership[] = res.data;
      setGroups(fetchedGroups);

      // Determinamos cuál debe ser el grupo activo
      if (fetchedGroups.length > 0) {
        const storedGroupIdStr = localStorage.getItem('active_group_id');
        const fallbackId = storedGroupIdStr ? parseInt(storedGroupIdStr, 10) : null;
        const preferredId = targetActiveGroupId !== undefined ? targetActiveGroupId : fallbackId;
        
        const matched = preferredId ? fetchedGroups.find(g => g.id === preferredId) : null;
        const currentToSet = matched || fetchedGroups[0];
        
        setActiveGroup(currentToSet);
        localStorage.setItem('active_group_id', currentToSet.id.toString());
      } else {
        setActiveGroup(null);
        localStorage.removeItem('active_group_id');
      }
    } catch (error) {
      console.error('[GroupContext] Error al cargar los grupos del usuario:', error);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  /**
   * Permite al usuario cambiar de grupo activo de forma instantánea.
   * Guarda la preferencia en el almacenamiento local para persistir la selección entre recargas.
   * Emplea una actualización funcional de estado para blindar la búsqueda frente a cierres o renders pendientes.
   */
  const setActiveGroupById = (id: number) => {
    localStorage.setItem('active_group_id', id.toString());
    setGroups(prevGroups => {
      const target = prevGroups.find(g => g.id === id);
      if (target) {
        setActiveGroup(target);
      }
      return prevGroups;
    });
  };

  /**
   * Permite al usuario abandonar un grupo al que pertenezca,
   * recargando automáticamente la lista de grupos tras la confirmación.
   */
  const leaveGroup = async (id: number) => {
    try {
      await api.post(`/api/groups/${id}/leave`);
      await refreshGroups();
    } catch (error) {
      console.error('[GroupContext] Error al abandonar el grupo:', error);
      throw error;
    }
  };

  /**
   * Actualiza optimistamente el saldo local del grupo activo
   * ante apuestas o recompensas completadas en tiempo real.
   */
  const updateActiveGroupBalance = (delta: number) => {
    setActiveGroup(prev => {
      if (!prev) return null;
      const updatedBalance = Math.max(0, prev.saldo_grupo + delta);
      return { ...prev, saldo_grupo: updatedBalance };
    });

    setGroups(prevGroups => 
      prevGroups.map(g => {
        if (activeGroup && g.id === activeGroup.id) {
          return { ...g, saldo_grupo: Math.max(0, g.saldo_grupo + delta) };
        }
        return g;
      })
    );
  };

  // Carga inicial al cambiar de sesión o iniciar la aplicación
  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  return (
    <GroupContext.Provider
      value={{
        groups,
        activeGroup,
        loading,
        refreshGroups,
        setActiveGroupById,
        leaveGroup,
        updateActiveGroupBalance,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};

export const useGroup = () => {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error('useGroup debe ser utilizado dentro de un GroupProvider');
  }
  return context;
};
