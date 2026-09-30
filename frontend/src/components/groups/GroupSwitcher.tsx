'use client';

import React from 'react';
import { Users, ChevronDown, Coins } from 'lucide-react';
import Link from 'next/link';
import { useGroup } from '@/context/GroupContext';

/**
 * Componente selector de grupo para la barra superior (Header) de las páginas del grupo.
 * Muestra el nombre de la comunidad actual, el saldo local de QuestCoins y un enlace
 * directo al Hub de Bienvenida (/groups) para alternar entre comunidades.
 */
export default function GroupSwitcher() {
  const { activeGroup } = useGroup();

  if (!activeGroup) {
    return (
      <Link
        href="/groups"
        className="bg-dracula-purple/20 border-dracula-purple/40 text-dracula-purple hover:bg-dracula-purple hover:text-dracula-base flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black tracking-wider uppercase transition-all"
      >
        <Users size={14} />
        <span>Elegir Grupo</span>
      </Link>
    );
  }

  return (
    <Link
      href="/groups"
      className="bg-dracula-card hover:bg-dracula-base border-dracula-gray/20 hover:border-dracula-purple/50 flex max-w-[210px] items-center gap-2 rounded-xl border px-3 py-1.5 shadow-sm transition-all"
      title="Cambiar de grupo en el Hub"
    >
      <div className="bg-dracula-purple/20 text-dracula-purple flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-[10px] font-black">
        {activeGroup.nombre.charAt(0).toUpperCase()}
      </div>

      <div className="flex min-w-0 flex-col">
        <span className="text-dracula-light mb-0.5 truncate text-xs leading-none font-black">
          {activeGroup.nombre}
        </span>
        <span className="text-dracula-yellow flex items-center gap-0.5 text-[10px] leading-none font-bold">
          <Coins size={10} />
          {activeGroup.saldo_grupo} QC
        </span>
      </div>

      <ChevronDown size={14} className="text-dracula-gray ml-auto shrink-0" />
    </Link>
  );
}
