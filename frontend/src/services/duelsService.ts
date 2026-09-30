/**
 * ============================================================================
 * SERVICIO DE DUELOS PVP (duelsService)
 * ============================================================================
 * Gestiona el sistema de retos directos 1v1, apuestas con custodia en Escrow
 * y reporte de resultados ante el Tribunal de QuestFest.
 * ============================================================================
 */

import api from '@/lib/axios';
import { DueloResponse, CreateDuelPayload } from '@/types';

/**
 * Recupera la lista de duelos asociados al grupo actual.
 */
export async function fetchDuels(groupId?: number): Promise<DueloResponse[]> {
  const response = await api.get<DueloResponse[]>('/api/duelos/', {
    params: groupId ? { group_id: groupId } : {},
  });
  return response.data;
}

/**
 * Crea y lanza un nuevo reto 1v1 contra otro jugador con depósito en garantía.
 */
export async function createDuel(payload: CreateDuelPayload): Promise<void> {
  await api.post('/api/duelos/', payload);
}

/**
 * Acepta un duelo entrante deduciendo el importe del reto desde el saldo local.
 */
export async function acceptDuel(duelId: number): Promise<void> {
  await api.post(`/api/duelos/${duelId}/action?action=accept`);
}

/**
 * Rechaza un duelo entrante.
 */
export async function rejectDuel(duelId: number): Promise<void> {
  await api.post(`/api/duelos/${duelId}/action?action=reject`);
}

/**
 * Declara el resultado del duelo para arbitraje por el Tribunal de Administración.
 */
export async function declareWinner(
  duelId: number,
  resolution: 'challenger' | 'challenged' | 'draw'
): Promise<void> {
  await api.post(`/api/duelos/${duelId}/action?action=resolve`, {
    resolution,
  });
}
