/**
 * ============================================================================
 * HOOK DE SCROLL INFINITO (useInfiniteScroll): QuestFest PWA
 * ============================================================================
 * Implementa la carga progresiva de elementos al desplazarse mediante
 * la API estándar del navegador `IntersectionObserver`.
 * 
 * Ventajas frente a `window.addEventListener('scroll')`:
 * 1. Cero Bloqueo de Hilo Principal: `IntersectionObserver` se ejecuta de forma asíncrona
 *    en el motor del navegador fuera del bucle de eventos de JavaScript, evitando caídas
 *    de frames (jank) y ahorrando batería en dispositivos móviles.
 * 2. Patrón Ref Callback: `lastElementRef` se engancha al último elemento DOM renderizado.
 *    Cuando este entra en el viewport (`isIntersecting`), se dispara `onLoadMore()`.
 * 3. Prevención de Fugas: Se desconecta el observador previo (`disconnect()`) antes de
 *    vincular el nuevo nodo, impidiendo peticiones duplicadas.
 * ============================================================================
 */

import { useRef, useCallback } from 'react';

export function useInfiniteScroll(
  isLoadingMore: boolean,
  hasMore: boolean,
  onLoadMore: () => void
) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Si ya hay una página en curso de carga, no hacemos nada
      if (isLoadingMore) return;
      
      // Limpiamos la observación anterior para evitar listeners fantasma
      if (observerRef.current) observerRef.current.disconnect();
      
      observerRef.current = new IntersectionObserver((entries) => {
        // Cuando el centinela se hace visible en pantalla y quedan más registros
        if (entries[0].isIntersecting && hasMore) {
          onLoadMore();
        }
      });
      
      if (node) observerRef.current.observe(node);
    },
    [isLoadingMore, hasMore, onLoadMore]
  );

  return { lastElementRef };
}
