/**
 * ============================================================================
 * GESTOR Y SANITIZADOR DE ERRORES DE API: QuestFest
 * ============================================================================
 * ¿Por qué es necesario este módulo?
 * En React 19, cualquier intento de renderizar un objeto plano o un array de objetos
 * como hijo de React (ReactChild) provoca una excepción fatal en tiempo de ejecución:
 * "Objects are not valid as a React child (found: object with keys {type, loc, msg, input})".
 *
 * Cuando FastAPI y Pydantic v2 devuelven un error HTTP 422 (Unprocessable Entity),
 * el payload `error.response.data.detail` es un Array de objetos:
 * `[{ type: "missing", loc: ["body", "..."], msg: "Field required", input: ... }]`.
 * Si se pasa directamente a toasters como `react-hot-toast` o a componentes JSX,
 * React crashea el árbol de la interfaz.
 *
 * Esta utilidad garantiza que SIEMPRE se extraiga una cadena de texto (string)
 * legible, amigable y completamente segura para el usuario y para el renderizado.
 * ============================================================================
 */

export function getApiErrorMessage(error: unknown, fallbackMessage = 'Ha ocurrido un error inesperado'): string {
  if (!error || typeof error !== 'object') {
    return fallbackMessage;
  }

  const err = error as {
    response?: {
      data?: {
        detail?: unknown;
        message?: unknown;
      };
      status?: number;
    };
    message?: string;
  };

  const detail = err.response?.data?.detail;

  // 1. Si detail es una cadena directa (típico de HTTPException en FastAPI: detail="Ya eres miembro...")
  if (typeof detail === 'string' && detail.trim().length > 0) {
    return detail.trim();
  }

  // 2. Si detail es un array (típico de ValidationError 422 de Pydantic v2)
  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const pydanticItem = item as { msg?: string; message?: string };
          return pydanticItem.msg || pydanticItem.message || '';
        }
        return '';
      })
      .filter((msg) => Boolean(msg && msg.trim()));

    if (messages.length > 0) {
      return messages.join('. ');
    }
  }

  // 3. Si detail es un objeto con propiedad msg o message
  if (detail && typeof detail === 'object') {
    const detailObj = detail as { msg?: unknown; message?: unknown };
    if (typeof detailObj.msg === 'string' && detailObj.msg.trim()) {
      return detailObj.msg.trim();
    }
    if (typeof detailObj.message === 'string' && detailObj.message.trim()) {
      return detailObj.message.trim();
    }
  }

  // 4. Si el backend envió una clave 'message' en la raíz de data
  const dataMessage = err.response?.data?.message;
  if (typeof dataMessage === 'string' && dataMessage.trim().length > 0) {
    return dataMessage.trim();
  }

  // 5. Mensaje de error a nivel de red o excepción genérica de Axios
  if (typeof err.message === 'string' && err.message.trim().length > 0 && err.message !== 'AxiosError') {
    return err.message.trim();
  }

  return fallbackMessage;
}
