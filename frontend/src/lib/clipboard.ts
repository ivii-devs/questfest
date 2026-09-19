/**
 * Utilidad resiliente para copiar texto al portapapeles.
 * 
 * ¿Por qué esta abstracción?
 * La API moderna `navigator.clipboard` exige estrictamente un contexto seguro (HTTPS o localhost).
 * En entornos de pruebas con IP local (ej. http://192.168.x.x:3000 para probar en móviles o PWAs),
 * en navegadores WebKit/Safari o en ciertos WebViews, `navigator.clipboard` es `undefined`, provocando
 * el clásico error en tiempo de ejecución: "TypeError: undefined is not an object".
 * 
 * Además, en iOS Safari las operaciones asíncronas sobre el portapapeles pueden fallar si se pierde
 * el contexto transitorio del gesto del usuario (User Activation). Esta utilidad intenta primero la API
 * nativa moderna y, en caso de fallo o ausencia de soporte, aplica de inmediato una técnica de respaldo
 * (fallback) universal mediante `document.execCommand('copy')`.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Verificación de entorno de ejecución en cliente para evitar fallos durante SSR
  if (typeof window === 'undefined' || !text) {
    return false;
  }

  // 1. Intento primario: API moderna Asynchronous Clipboard
  // Verificamos explícitamente la existencia de 'clipboard' y 'writeText' antes de invocar
  if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Si el navegador deniega el permiso (ej. pestaña en segundo plano o contexto restringido),
      // no propagamos la excepción y permitimos que el flujo continúe hacia el método de respaldo.
    }
  }

  // 2. Método de respaldo (Fallback): Creación temporal de un elemento textarea en el DOM
  // Este mecanismo tiene compatibilidad universal con navegadores antiguos, HTTP y WebKit
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Configuramos estilos fijos e invisibles para prevenir desplazamientos bruscos (scroll jumps)
    // o alteraciones visuales en la interfaz táctil de la PWA
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';

    // En iOS Safari, marcarlo como 'readonly' previene que aparezca el teclado virtual en pantalla
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);

    // Selección del contenido con compatibilidad explícita para el motor WebKit de iOS
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    // Ejecución del comando de copia heredado
    const successful = document.execCommand('copy');

    // Limpieza inmediata del elemento en el DOM para evitar fugas de memoria
    document.body.removeChild(textArea);

    return successful;
  } catch (error) {
    // Si ambos métodos fallan (por ejemplo, directivas de seguridad CSP extremadamente estrictas),
    // reportamos el fallo de forma controlada sin tumbar la aplicación
    console.warn('[clipboard] No fue posible copiar el texto al portapapeles:', error);
    return false;
  }
}
