/**
 * ============================================================================
 * SERVICIO DE ADMINISTRACIÓN Y TRIBUNAL (adminService)
 * ============================================================================
 * Encapsula la gestión de usuarios, auditoría de balance del Ledger,
 * resolución de disputas y configuración del sistema por administradores.
 * ============================================================================
 */

import api from '@/lib/axios';
import {
  GlobalStatsResponse,
  Usuario,
  TransactionResponse,
  BoletinConfigPayload,
} from '@/types';

/**
 * Obtiene métricas globales de usuarios y tokens en circulación para el grupo o sistema.
 */
export async function fetchAdminStats(
  groupId?: number
): Promise<GlobalStatsResponse> {
  const response = await api.get<GlobalStatsResponse>(
    '/api/admin/users/stats',
    {
      params: groupId ? { group_id: groupId } : {},
    }
  );
  return response.data;
}

/**
 * Obtiene la lista completa de usuarios del directorio con sus saldos contables.
 */
export async function fetchAdminUsers(groupId?: number): Promise<Usuario[]> {
  const response = await api.get<Usuario[]>('/api/admin/users', {
    params: groupId ? { group_id: groupId } : {},
  });
  return response.data;
}

/**
 * Modifica el saldo contable de un usuario creando un movimiento de compensación en el Ledger.
 */
export async function updateUserBalance(
  userId: number,
  amount: number,
  concept: string,
  groupId?: number
): Promise<void> {
  await api.post(`/api/admin/users/${userId}/balance`, {
    cantidad: amount,
    concepto: concept,
    group_id: groupId || undefined,
  });
}

/**
 * Consulta el historial contable de movimientos del Ledger para un usuario específico.
 */
export async function fetchUserTransactions(
  userId: number,
  groupId?: number
): Promise<TransactionResponse[]> {
  const response = await api.get<TransactionResponse[]>(
    `/api/admin/users/${userId}/transactions`,
    {
      params: groupId ? { group_id: groupId } : {},
    }
  );
  return response.data;
}

/**
 * Valida o rechaza una prueba fotográfica o testimonio de misión en el Tribunal.
 */
export async function resolvePendingProof(
  proofId: number,
  approved: boolean
): Promise<void> {
  const endpoint = approved
    ? `/api/admin/misiones/pruebas/${proofId}/validar`
    : `/api/admin/misiones/pruebas/${proofId}/rechazar`;
  await api.patch(endpoint);
}

/**
 * Actualiza la configuración del boletín matutino.
 */
export async function updateBoletinConfig(
  groupId: number,
  _config: BoletinConfigPayload
): Promise<void> {
  // Configuración de boletín en backend mediante endpoints de settings/boletin
  await api.patch(`/api/settings/boletin/${groupId}`, _config);
}
