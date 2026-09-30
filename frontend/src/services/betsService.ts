/**
 * ============================================================================
 * SERVICIO DE APUESTAS Y PREDICCIONES (betsService)
 * ============================================================================
 * Gestiona el catálogo de apuestas grupales, sugerencias y colocación de tickets.
 * ============================================================================
 */

import api from '@/lib/axios';
import { ApuestaResponse, CreateBetPayload, TicketResponse } from '@/types';

/**
 * Obtiene las apuestas activas (propuestas, abiertas y cerradas) de un grupo.
 */
export async function fetchActiveBets(
  groupId?: number
): Promise<ApuestaResponse[]> {
  const response = await api.get<ApuestaResponse[]>('/api/apuestas/', {
    params: groupId ? { group_id: groupId } : {},
  });
  return response.data;
}

/**
 * Sugiere una nueva apuesta comunitaria para ser votada y validada por administradores.
 */
export async function createBet(payload: CreateBetPayload): Promise<void> {
  await api.post('/api/apuestas/suggest', payload);
}

/**
 * Coloca un ticket de apuesta con saldo del grupo o saldo global.
 */
export async function placeBetTicket(
  betId: string | number,
  optionId: string,
  amount: number
): Promise<TicketResponse> {
  const response = await api.post<TicketResponse>(
    `/api/apuestas/${betId}/place`,
    {
      option_id: optionId,
      amount,
    }
  );
  return response.data;
}

/**
 * Emite un voto ('up' o 'down') sobre una sugerencia de apuesta en fase de propuesta.
 */
export async function voteBet(
  betId: string | number,
  voteType: 'up' | 'down'
): Promise<void> {
  await api.post(`/api/apuestas/${betId}/vote`, {
    vote_type: voteType,
  });
}

/**
 * Resuelve una apuesta marcando la opción ganadora y abonando premios en el Ledger.
 * Requiere rol de administrador.
 */
export async function resolveBet(
  betId: string | number,
  winningOptionId: string
): Promise<void> {
  await api.patch(`/api/admin/bets/${betId}/status`, {
    estado: 'cerrada',
    opcion_ganadora_id: winningOptionId,
  });
}

/**
 * Elimina una apuesta existente.
 */
export async function deleteBet(betId: string | number): Promise<void> {
  await api.delete(`/api/apuestas/${betId}`);
}
