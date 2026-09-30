'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
} from 'react';

/**
 * Modos de iluminación soportados en QuestFest:
 * - 'dark': Modo Oscuro (por defecto de QuestFest)
 * - 'light': Modo Claro de alto contraste
 * - 'system': Sincronizado automáticamente con las preferencias del sistema operativo del usuario
 */
export type ThemeMode = 'dark' | 'light' | 'system';

/**
 * Catálogo del Modelo Híbrido de Paletas Cromáticas:
 * - Dinámicas (Multisección / Identidad por Panel):
 *   - 'default': QuestFest Clásico (Dracula Theme)
 *   - 'cyberpunk': Neón Futurista (Fucsia, Amarillo, Verde tóxico, Láser)
 *   - 'sunset': Atardecer Cálido (Índigo, Ámbar, Salvia, Naranja)
 *   - 'pastel': Retro Arcade / Cozy (Lavanda, Vainilla, Menta, Fresa)
 * - Monocromáticas (Minimal Accent unificado en toda la app):
 *   - 'mono-amethyst': Amatista Imperial
 *   - 'mono-sapphire': Zafiro Glaciar
 *   - 'mono-emerald': Esmeralda Puro
 *   - 'mono-gold': Oro Real
 *   - 'mono-crimson': Carmesí Pasión
 */
export type ColorPalette =
  | 'default'
  | 'cyberpunk'
  | 'sunset'
  | 'pastel'
  | 'mono-amethyst'
  | 'mono-sapphire'
  | 'mono-emerald'
  | 'mono-gold'
  | 'mono-crimson';

interface ThemeContextType {
  mode: ThemeMode;
  palette: ColorPalette;
  resolvedTheme: 'dark' | 'light';
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ColorPalette) => void;
}

const THEME_MODE_KEY = 'questfest-theme-mode';
const THEME_PALETTE_KEY = 'questfest-theme-palette';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Proveedor global del Sistema de Temas y Paletas Cromáticas Híbridas.
 *
 * Gestiona la reactividad del tema, la persistencia en el almacenamiento local (localStorage),
 * la sincronización en vivo con las directivas CSS de document.documentElement y la barra
 * de estado móvil del navegador mediante la etiqueta <meta name="theme-color">.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Inicializamos el estado leyendo de localStorage si está disponible (en cliente),
  // manteniendo 'dark' y 'default' como valores iniciales canónicos para SSR.
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [palette, setPaletteState] = useState<ColorPalette>('default');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');
  const [, startTransition] = useTransition();

  // Lectura inicial segura tras el montaje en el cliente
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(
        THEME_MODE_KEY
      ) as ThemeMode | null;
      const savedPalette = localStorage.getItem(
        THEME_PALETTE_KEY
      ) as ColorPalette | null;

      if (
        savedMode &&
        (savedMode === 'dark' ||
          savedMode === 'light' ||
          savedMode === 'system')
      ) {
        setModeState(savedMode);
      }
      if (
        savedPalette &&
        [
          'default',
          'cyberpunk',
          'sunset',
          'pastel',
          'mono-amethyst',
          'mono-sapphire',
          'mono-emerald',
          'mono-gold',
          'mono-crimson',
        ].includes(savedPalette)
      ) {
        setPaletteState(savedPalette);
      }
    } catch {
      // Fallo silencioso en entornos con acceso restringido a localStorage
    }
  }, []);

  // Resolución reactiva del tema (manejo de cambios de modo y preferencias del sistema)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateResolvedTheme = () => {
      const isSystemDark = mediaQuery.matches;
      const currentResolved: 'dark' | 'light' =
        mode === 'system' ? (isSystemDark ? 'dark' : 'light') : mode;

      setResolvedTheme(currentResolved);

      // Inyección de atributos HTML para reactividad instantánea con Tailwind v4
      const root = document.documentElement;
      root.setAttribute('data-theme', currentResolved);
      root.setAttribute('data-palette', palette);

      // Actualización dinámica de la barra de estado de Safari iOS / Chrome Android según la paleta activa
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        const computedBg = window
          .getComputedStyle(root)
          .getPropertyValue('--theme-app-bg')
          .trim();
        metaThemeColor.setAttribute(
          'content',
          computedBg || (currentResolved === 'dark' ? '#000000' : '#f8fafc')
        );
      }
    };

    updateResolvedTheme();

    // Si el usuario eligió 'system', escuchamos cambios en tiempo real del sistema operativo
    const handleChange = () => {
      if (mode === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode, palette]);

  /**
   * Cambia el modo de iluminación (Oscuro, Claro o Sistema) y lo persiste en localStorage.
   */
  const setMode = (newMode: ThemeMode) => {
    startTransition(() => {
      setModeState(newMode);
      try {
        localStorage.setItem(THEME_MODE_KEY, newMode);
      } catch {
        // Ignorado en modos incógnito restrictivos
      }
    });
  };

  /**
   * Cambia la paleta cromática híbrida y la persiste en localStorage.
   */
  const setPalette = (newPalette: ColorPalette) => {
    startTransition(() => {
      setPaletteState(newPalette);
      try {
        localStorage.setItem(THEME_PALETTE_KEY, newPalette);
      } catch {
        // Ignorado en modos incógnito restrictivos
      }
    });
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        palette,
        resolvedTheme,
        setMode,
        setPalette,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook de acceso a las preferencias de tema y paletas cromáticas.
 * Garantiza que el contexto esté debidamente inicializado antes de su consumo.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe ser utilizado dentro de un ThemeProvider');
  }
  return context;
}
