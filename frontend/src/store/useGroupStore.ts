'use client';

/**
 * ============================================================================
 * STORE DE MULTI-TENANCY Y GRUPO ACTIVO (useGroupStore)
 * ============================================================================
 * Centraliza la comunidad activa seleccionada por el jugador,
 * su balance específico de grupo y el listado de comunidades suscritas.
 * Evita condiciones de carrera sincronizando el active_group_id en localStorage.
 * ============================================================================
 */

import { create } from 'zustand';
import {
  fetchMyGroups,
  leaveGroup as leaveGroupService,
  deleteGroup as deleteGroupService,
} from '@/services/groupsService';
import { GrupoResponse } from '@/types';

interface GroupState {
  activeGroup: GrupoResponse | null;
  myGroups: GrupoResponse[];
  isLoadingGroups: boolean;

  // Acciones
  setActiveGroup: (group: GrupoResponse | null) => void;
  setActiveGroupById: (id: number) => void;
  fetchGroups: (targetActiveGroupId?: number) => Promise<void>;
  updateActiveGroupBalance: (delta: number) => void;
  leaveGroup: (id: number) => Promise<void>;
  deleteGroup: (id: number) => Promise<void>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  activeGroup: null,
  myGroups: [],
  isLoadingGroups: true,

  setActiveGroup: (group) => {
    set({ activeGroup: group });
    if (typeof window !== 'undefined') {
      if (group) {
        localStorage.setItem('active_group_id', group.id.toString());
      } else {
        localStorage.removeItem('active_group_id');
      }
    }
  },

  setActiveGroupById: (id: number) => {
    const found = get().myGroups.find((g) => g.id === id);
    if (found) {
      get().setActiveGroup(found);
    }
  },

  fetchGroups: async (targetActiveGroupId?: number) => {
    set({ isLoadingGroups: true });
    try {
      const groups = await fetchMyGroups();
      set({ myGroups: groups });

      if (groups.length === 0) {
        get().setActiveGroup(null);
        return;
      }

      // Si se especificó un grupo objetivo explícito
      if (targetActiveGroupId) {
        const target = groups.find((g) => g.id === targetActiveGroupId);
        if (target) {
          get().setActiveGroup(target);
          return;
        }
      }

      // Comprobar preferencia previa persistida
      const savedId =
        typeof window !== 'undefined'
          ? localStorage.getItem('active_group_id')
          : null;
      if (savedId) {
        const numId = parseInt(savedId, 10);
        const match = groups.find((g) => g.id === numId);
        if (match) {
          get().setActiveGroup(match);
          return;
        }
      }

      // Fallback: seleccionar el primer grupo disponible
      get().setActiveGroup(groups[0]);
    } catch (error) {
      console.error('Error al cargar grupos en useGroupStore:', error);
    } finally {
      set({ isLoadingGroups: false });
    }
  },

  updateActiveGroupBalance: (delta: number) => {
    const currentActive = get().activeGroup;
    if (!currentActive) return;

    const newSaldo = Math.max(0, currentActive.saldo_grupo + delta);
    const updatedGroup: GrupoResponse = {
      ...currentActive,
      saldo_grupo: newSaldo,
    };

    const updatedList = get().myGroups.map((g) =>
      g.id === currentActive.id ? updatedGroup : g
    );
    set({ activeGroup: updatedGroup, myGroups: updatedList });
  },

  leaveGroup: async (groupId: number) => {
    await leaveGroupService(groupId);
    await get().fetchGroups();
  },

  deleteGroup: async (groupId: number) => {
    await deleteGroupService(groupId);
    await get().fetchGroups();
  },
}));
