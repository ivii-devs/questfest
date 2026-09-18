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
        className="flex items-center gap-1.5 px-3 py-1.5 bg-dracula-purple/20 border border-dracula-purple/40 text-dracula-purple rounded-xl text-xs font-black uppercase tracking-wider hover:bg-dracula-purple hover:text-dracula-base transition-all"
      >
        <Users size={14} />
        <span>Elegir Grupo</span>
      </Link>
    );
  }

  return (
    <Link
      href="/groups"
      className="flex items-center gap-2 bg-dracula-card hover:bg-dracula-base border border-dracula-gray/20 hover:border-dracula-purple/50 px-3 py-1.5 rounded-xl transition-all shadow-sm max-w-[210px]"
      title="Cambiar de grupo en el Hub"
    >
      <div className="w-5 h-5 rounded-lg bg-dracula-purple/20 text-dracula-purple flex items-center justify-center text-[10px] font-black shrink-0">
        {activeGroup.nombre.charAt(0).toUpperCase()}
      </div>

      <div className="flex flex-col min-w-0">
        <span className="text-xs font-black text-dracula-light truncate leading-none mb-0.5">
          {activeGroup.nombre}
        </span>
        <span className="text-[10px] font-bold text-dracula-yellow flex items-center gap-0.5 leading-none">
          <Coins size={10} />
          {activeGroup.saldo_grupo} QC
        </span>
      </div>

      <ChevronDown size={14} className="text-dracula-gray shrink-0 ml-auto" />
    </Link>
  );
}
