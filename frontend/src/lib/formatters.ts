/**
 * ============================================================================
 * FORMATEADORES DE TIEMPO Y FECHAS: QuestFest
 * ============================================================================
 * Proporciona normalización y formato amigable en español peninsular ('es-ES').
 *
 * Trampa de compatibilidad móvil (Safari iOS):
 * En WebKit / Safari móvil, pasar una cadena ISO sin sufijo de zona horaria (ej. "2026-09-17T14:30:00")
 * al constructor `new Date()` la interpreta erróneamente como hora local del dispositivo,
 * desfasando los horarios.
 *
 * Esta función detecta si la cadena carece de 'Z' o desplazamiento (+/-HH:MM) y le
 * anexa 'Z' para garantizar su interpretación inequívoca en UTC antes de convertirla
 * a la zona horaria del evento ('Europe/Madrid').
 * ============================================================================
 */

export function formatSpanishDate(
  dateString: string | null | undefined
): string {
  if (!dateString) return '';

  // Si la fecha no tiene indicador explícito de zona horaria, asumimos UTC agregando 'Z'
  const hasTimezone =
    dateString.endsWith('Z') || /([+-]\d{2}:\d{2})$/.test(dateString);
  const date = new Date(hasTimezone ? dateString : dateString + 'Z');

  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // El formato Intl en es-ES suele generar "jue, 17/06, 17:34"; limpiamos comas
  const formatted = formatter.format(date).replace(/,/g, '').trim();

  // Capitalizamos la primera letra del día de la semana (ej. "Jue 17/06 17:34")
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
