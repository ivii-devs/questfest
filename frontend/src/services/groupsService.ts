/**
 * ============================================================================
 * SERVICIO DE GESTIÓN DE GRUPOS Y MULTI-TENANCY (groupsService)
 * ============================================================================
 * Encapsula la comunicación con la API de comunidades (/api/groups).
 * Proporciona métodos tipados para la gestión del ciclo de vida de grupos.
 * ============================================================================
 */

import api from '@/lib/axios';
import {
  GrupoResponse,
  CreateGroupRequest,
  MiembroGrupoResponse,
} from '@/types';

/**
 * Obtiene todos los grupos a los que pertenece el usuario actual.
 */
export async function fetchMyGroups(): Promise<GrupoResponse[]> {
  const response = await api.get<GrupoResponse[]>('/api/groups/my-groups');
  return response.data;
}

/**
 * Crea una nueva comunidad con el saldo inicial especificado.
 */
export async function createGroup(
  data: CreateGroupRequest
): Promise<GrupoResponse> {
  const response = await api.post<GrupoResponse>('/api/groups/', data);
  return response.data;
}

/**
 * Une al usuario actual a un grupo mediante su código único de 6 caracteres.
 */
export async function joinGroupWithCode(
  code: string,
  accessKey?: string
): Promise<GrupoResponse> {
  const response = await api.post<GrupoResponse>('/api/groups/join', {
    codigo_unico: code,
    password: accessKey || undefined,
  });
  return response.data;
}

/**
 * Lista todos los miembros de un grupo con sus respectivos saldos y roles.
 */
export async function fetchGroupMembers(
  groupId: number
): Promise<MiembroGrupoResponse[]> {
  const response = await api.get<MiembroGrupoResponse[]>(
    `/api/groups/${groupId}/members`
  );
  return response.data;
}

/**
 * Regenera el código alfanumérico de invitación invalidando el anterior.
 */
export async function regenerateInviteCode(groupId: number): Promise<string> {
  const response = await api.post<{ codigo_unico: string }>(
    `/api/groups/${groupId}/regenerate-code`
  );
  return response.data.codigo_unico;
}

/**
 * Modifica el rol de un miembro ('admin' o 'member') dentro del grupo.
 */
export async function updateMemberRole(
  groupId: number,
  memberId: number,
  role: 'admin' | 'member'
): Promise<void> {
  await api.patch(`/api/groups/${groupId}/members/${memberId}/role`, {
    rol: role,
  });
}

/**
 * Elimina definitivamente el grupo. Requiere ser el creador de la comunidad.
 */
export async function deleteGroup(groupId: number): Promise<void> {
  await api.delete(`/api/groups/${groupId}`);
}

/**
 * Abandona la membresía en un grupo específico.
 */
export async function leaveGroup(groupId: number): Promise<void> {
  await api.delete(`/api/groups/${groupId}/leave`);
}
