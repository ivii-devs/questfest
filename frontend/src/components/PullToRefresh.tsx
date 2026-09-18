'use client';

import React, { useState } from 'react';
import { Dna } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTouching, setIsTouching] = useState(false);

  const isPulling = currentY > startY && startY > 0;
  const rawDistance = isPulling ? currentY - startY : 0;
  
  // Amortiguación elástica
  const pullingDistance = isPulling ? Math.min(rawDistance * 0.35, 80) : 0;
  const translateY = isRefreshing ? 60 : pullingDistance;

  /*
   * Detección precisa de scroll para App Shell:
   * Verifica si el contenedor con scroll interno está en la parte superior (scrollTop <= 0)
   * antes de iniciar el gesto elástico de recarga táctil.
   */
  const checkIsAtTop = (e: React.TouchEvent) => {
    const target = e.currentTarget as HTMLElement;
    const scrollContainer = target.closest('.app-shell-scroll') || target.querySelector('.app-shell-scroll');
    if (scrollContainer) {
      return scrollContainer.scrollTop <= 0;
    }
    return typeof window !== 'undefined' ? window.scrollY <= 0 : true;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (checkIsAtTop(e)) {
      setStartY(e.touches[0].clientY);
      setIsTouching(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY > 0 && checkIsAtTop(e)) {
      setCurrentY(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = async () => {
    setIsTouching(false);
    if (pullingDistance > 50 && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await Promise.all([
          onRefresh(),
          new Promise(res => setTimeout(res, 1200))
        ]);
      } finally {
        setIsRefreshing(false);
      }
    }
    setStartY(0);
    setCurrentY(0);
  };

  return (
    /*
     * Usamos bg-[var(--theme-app-bg)] en lugar de bg-black para que el contenedor
     * del refresco táctil herede el color de fondo dinámico del tema activo (oscuro o claro),
     * evitando bandas negras o saltos de contraste al deslizar en modo claro.
     */
    <div
      className="relative w-full flex-1 flex flex-col min-h-0 overflow-hidden bg-[var(--theme-app-bg)]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Spinner en la capa de fondo inferior */}
      <div className="absolute top-0 left-0 w-full flex justify-center items-center h-16 z-0">
        <div 
          className={`text-dracula-purple ${isRefreshing ? 'animate-spin' : ''} ${!isTouching ? 'transition-all duration-300 ease-out' : ''}`}
          style={{ 
            transform: `rotate(${pullingDistance * 3}deg) scale(${Math.min(translateY / 50, 1)})`,
            opacity: Math.min(translateY / 30, 1)
          }}
        >
          <Dna size={24} />
        </div>
      </div>

      {/* Contenido desplazable elásticamente */}
      <div
        className={`relative z-10 w-full h-full flex flex-col flex-1 min-h-0 bg-transparent ${!isTouching ? 'transition-transform duration-300 ease-out' : ''}`}
        style={{ transform: `translateY(${translateY}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
