/**
 * ============================================================================
 * SERVICIO DE KITS DE EVENTOS Y PRESETS (kitsService)
 * ============================================================================
 * Gestiona la interacción con los endpoints REST de kits en FastAPI:
 * 1. Catálogo público y personal (oficiales, comunidad, mis-kits).
 * 2. Creación, edición y eliminación de plantillas.
 * 3. Votación popular (Likes) y denuncias de moderación ciudadana.
 * 4. Inyección atómica en lote de retos y apuestas en grupos multi-tenant.
 * ============================================================================
 */

import api from '@/lib/axios';
import {
  KitEventoResponse,
  CreateKitPayload,
  InyeccionKitPayload,
  InyeccionKitResult,
  KitLikeResult,
} from '@/types';

export interface FetchKitsParams {
  tipo?: 'oficial' | 'comunidad' | 'mis-kits';
  categoria?: string;
  query?: string;
  skip?: number;
  limit?: number;
}

/**
 * Consulta el listado de kits aplicando filtros de catálogo, categoría o texto.
 */
export async function fetchKits(
  params: FetchKitsParams = {}
): Promise<KitEventoResponse[]> {
  const response = await api.get<KitEventoResponse[]>('/api/v1/kits', {
    params,
  });
  return response.data;
}

/**
 * Obtiene el detalle completo y desglose estructurado de un kit por su ID.
 */
export async function fetchKitById(kitId: number): Promise<KitEventoResponse> {
  const response = await api.get<KitEventoResponse>(`/api/v1/kits/${kitId}`);
  return response.data;
}

/**
 * Publica un nuevo kit en la plataforma (creado desde cero o empaquetado desde grupo).
 */
export async function createKit(
  payload: CreateKitPayload
): Promise<KitEventoResponse> {
  const response = await api.post<KitEventoResponse>('/api/v1/kits', payload);
  return response.data;
}

/**
 * Modifica metadatos o contenido de un kit existente (restringido al autor).
 */
export async function updateKit(
  kitId: number,
  payload: Partial<CreateKitPayload>
): Promise<KitEventoResponse> {
  const response = await api.put<KitEventoResponse>(
    `/api/v1/kits/${kitId}`,
    payload
  );
  return response.data;
}

/**
 * Elimina definitivamente un kit del catálogo.
 * No altera las misiones y apuestas que ya fueron volcadas en grupos.
 */
export async function deleteKit(kitId: number): Promise<void> {
  await api.delete(`/api/v1/kits/${kitId}`);
}

/**
 * Alterna el voto 'Me Gusta' del usuario de forma atómica e idempotente.
 */
export async function toggleKitLike(kitId: number): Promise<KitLikeResult> {
  const response = await api.post<KitLikeResult>(`/api/v1/kits/${kitId}/like`);
  return response.data;
}

/**
 * Envía una denuncia sobre un kit con contenido inapropiado ante el Tribunal.
 */
export async function reportKit(kitId: number, motivo: string): Promise<void> {
  await api.post(`/api/v1/kits/${kitId}/report`, { motivo });
}

/**
 * Ejecuta la inyección atómica en bloque de los retos y apuestas seleccionados en el grupo.
 */
export async function injectKitIntoGroup(
  groupId: number,
  payload: InyeccionKitPayload
): Promise<InyeccionKitResult> {
  const response = await api.post<InyeccionKitResult>(
    `/api/v1/grupos/${groupId}/kits/inject`,
    payload
  );
  return response.data;
}
