'use client';

/**
 * ============================================================================
 * COMPONENTE REUTILIZABLE: TokenAmountInput
 * ============================================================================
 * Campo de entrada numérico especializado para la economía de QuestFest
 * (QuestCoins, tokens en juego en duelos, inversiones en apuestas y recompensas).
 *
 * ¿Por qué existe este componente?
 * Los campos numéricos estándar de HTML5 (`<input type="number">`) presentan
 * varias fricciones críticas en entornos móviles y PWAs táctiles:
 *
 * 1. Trampa del cero residual ('0100'):
 *    Al usar `parseInt(e.target.value) || 0`, cuando el usuario pulsa retroceso
 *    para limpiar el campo, el valor temporal `""` se convertía forzosamente en `0`.
 *    Al escribir de nuevo el valor deseado (ej. 100), el `0` previo permanecía
 *    delante, creando valores erróneos como "0100". Este componente permite que
 *    el estado sea cadena vacía (`''`) mientras el usuario está editando.
 *
 * 2. Posicionamiento del puntero al inicio:
 *    Al pulsar sobre etiquetas o zonas con padding izquierdo para iconos decorativos,
 *    el navegador tiende a ubicar el cursor en el índice 0 (antes del número).
 *    Implementamos auto-selección en foco (`select()`) para que, al tocar o hacer
 *    clic en el campo, todo el valor actual quede resaltado y sea reemplazado
 *    limpiamente con la primera pulsación del usuario.
 *
 * 3. Iconografía segura:
 *    El icono decorativo frontal incorpora `pointer-events-none` absoluto para que
 *    ningún clic sobre el icono intercepte el foco del input.
 *
 * 4. PWA y Teclado Táctil:
 *    Se configuran `inputMode="numeric"` y `pattern="[0-9]*"` para garantizar que
 *    en iOS y Android se despliegue directamente el teclado numérico de la PWA,
 *    restringiendo caracteres científicos no deseados ('e', '+', '-').
 * ============================================================================
 */

import React, { FocusEvent, KeyboardEvent, ChangeEvent } from 'react';
import { Coins, LucideIcon } from 'lucide-react';

export interface TokenAmountInputProps {
  /** Identificador único para el elemento HTML */
  id?: string;
  /** Nombre del campo para serialización de formularios */
  name?: string;
  /** Valor numérico actual o cadena vacía si está en proceso de borrado */
  value: number | '';
  /** Notificación de cambio con el nuevo valor numérico limpio o cadena vacía */
  onChange: (value: number | '') => void;
  /** Texto sugerido cuando el campo no tiene valor */
  placeholder?: string;
  /** Límite numérico mínimo permitido */
  min?: number;
  /** Límite numérico máximo permitido (ej. 10000 en balances) */
  max?: number;
  /** Estado inhabilitado del control */
  disabled?: boolean;
  /** Marca si el campo es de cumplimentación obligatoria */
  required?: boolean;
  /** Clases CSS Tailwind personalizadas para el input */
  className?: string;
  /** Icono decorativo (Componente Lucide, elemento React o emoji en string) */
  icon?: LucideIcon | React.ReactNode;
  /** Clases de color para el icono decorativo si es Lucide */
  iconColor?: string;
  /** Etiqueta accesible para lectores de pantalla */
  ariaLabel?: string;
  /** Enfoque automático al montar el componente */
  autoFocus?: boolean;
  /** Callback opcional al perder el foco */
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
}

export default function TokenAmountInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  min = 0,
  max,
  disabled = false,
  required = false,
  className = '',
  icon: CustomIcon,
  iconColor = 'text-dracula-yellow',
  ariaLabel,
  autoFocus = false,
  onBlur,
}: TokenAmountInputProps) {
  /**
   * Al recibir el foco (por clic, toque táctil o navegación con tabulador),
   * seleccionamos automáticamente todo el texto.
   * Esto elimina la molestia de tener que llevar el cursor manualmente al final
   * o pulsar retroceso varias veces: el usuario simplemente escribe y sustituye.
   */
  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.select();
  };

  /**
   * Controla las pulsaciones de teclas para bloquear caracteres que el navegador
   * permite en inputs de tipo número pero que no tienen sentido en monedas QuestFest
   * (exponentes como 'e', signos de suma/resta o decimales).
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === 'e' ||
      e.key === 'E' ||
      e.key === '+' ||
      e.key === '-' ||
      e.key === '.' ||
      e.key === ','
    ) {
      e.preventDefault();
    }
  };

  /**
   * Procesa la entrada de texto de forma estricta:
   * - Permite cadena vacía sin forzar un '0' inmediato.
   * - Elimina ceros no significativos a la izquierda (ej. '0100' -> 100).
   * - Aplica el límite máximo para evitar desbordamientos enteros.
   */
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Si el campo ha sido vaciado por el usuario, emitimos '' para que la interfaz
    // permanezca en blanco limpiamente mostrando el placeholder correspondiente
    if (raw === '') {
      onChange('');
      return;
    }

    // Eliminamos ceros sobrantes al inicio para prevenir el patrón "0100" cuando
    // el usuario añade cifras delante o detrás de un cero residual
    const withoutLeadingZeros = raw.replace(/^0+(?=\d)/, '');

    const parsed = parseInt(withoutLeadingZeros, 10);
    if (isNaN(parsed)) {
      onChange('');
      return;
    }

    // Controlamos el techo máximo si se especificó (ej: max={10000})
    let finalValue = parsed;
    if (max !== undefined && finalValue > max) {
      finalValue = max;
    }

    onChange(finalValue);
  };

  /**
   * Manejo al perder el foco (Opción B seleccionada por el usuario):
   * El campo permanece exactamente como el usuario lo haya dejado (incluso vacío),
   * delegando las validaciones obligatorias al momento de pulsar el botón de envío.
   */
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (onBlur) {
      onBlur(e);
    }
  };

  // Renderizado del icono decorativo izquierdo
  const renderIcon = () => {
    if (!CustomIcon) {
      // Icono por defecto de QuestCoins
      return <Coins size={18} className={`${iconColor} pointer-events-none`} />;
    }

    if (typeof CustomIcon === 'string') {
      // Soporte para emojis directos (como 💰)
      return (
        <span className="pointer-events-none text-base select-none">
          {CustomIcon}
        </span>
      );
    }

    if (React.isValidElement(CustomIcon)) {
      // Si se pasa un elemento JSX ya instanciado (ej: <DollarSign size={16} />)
      return (
        <span className="pointer-events-none flex items-center justify-center">
          {CustomIcon}
        </span>
      );
    }

    // Si se pasa una referencia de componente (ej: icon={Coins} o icon={DollarSign})
    const IconComponent = CustomIcon as LucideIcon;
    return (
      <IconComponent size={18} className={`${iconColor} pointer-events-none`} />
    );
  };

  return (
    <div className="relative w-full">
      {/* Contenedor del icono decorativo con pointer-events-none absoluto
          para garantizar que ningún clic sea interceptado por el SVG */}
      <div className="pointer-events-none absolute top-1/2 left-3 z-10 flex -translate-y-1/2 items-center justify-center">
        {renderIcon()}
      </div>

      <input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className={className}
      />
    </div>
  );
}
