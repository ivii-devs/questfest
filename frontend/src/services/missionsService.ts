/**
 * ============================================================================
 * SERVICIO DE MISIONES Y RETOS SOCIALES (missionsService)
 * ============================================================================
 * Gestiona el catálogo de misiones activas, sugerencias comunitarias,
 * votaciones y envío de evidencias ante el Tribunal.
 * ============================================================================
 */

import api from '@/lib/axios';
import { MisionResponse, SuggestMissionPayload } from '@/types';

/**
 * Obtiene las misiones activas disponibles para el grupo especificado.
 */
export async function fetchMissions(
  groupId?: number
): Promise<MisionResponse[]> {
  const response = await api.get<MisionResponse[]>('/api/misiones/', {
    params: groupId ? { group_id: groupId } : {},
  });
  return response.data;
}

/**
 * Obtiene las misiones propuestas que están en fase de votación comunitaria.
 */
export async function fetchSuggestedMissions(
  groupId?: number
): Promise<MisionResponse[]> {
  const response = await api.get<MisionResponse[]>('/api/misiones/suggested', {
    params: groupId ? { group_id: groupId } : {},
  });
  return response.data;
}

/**
 * Obtiene el historial de misiones cerradas o caducadas con sus ganadores.
 */
export async function fetchClosedMissions(
  groupId?: number
): Promise<MisionResponse[]> {
  const response = await api.get<MisionResponse[]>('/api/misiones/closed', {
    params: groupId ? { group_id: groupId } : {},
  });
  return response.data;
}

/**
 * Propone una nueva misión comunitaria al grupo.
 */
export async function suggestMission(
  payload: SuggestMissionPayload
): Promise<void> {
  await api.post('/api/misiones/suggest', payload);
}

/**
 * Envía una prueba o justificación para reclamar la recompensa de una misión.
 */
export async function submitMissionProof(
  missionId: string | number,
  payload: { proof_text?: string; proof_image_url?: string }
): Promise<void> {
  await api.post(`/api/misiones/${missionId}/complete`, payload);
}

/**
 * Emite un voto ('up' o 'down') sobre una misión en fase de sugerencia.
 */
export async function voteMission(
  missionId: string | number,
  voteType: 'up' | 'down'
): Promise<void> {
  await api.post(`/api/misiones/${missionId}/vote`, {
    vote_type: voteType,
  });
}
