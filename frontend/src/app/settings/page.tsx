'use client';

import {
  ChevronLeft,
  UserCircle,
  BellRing,
  BookOpen,
  ShieldAlert,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import ThemeSettingsCard from '@/components/ThemeSettingsCard';

export default function AjustesPage() {
  const { user, logout } = useAuth();
  const USER_ROLE = user?.rol || 'player';
  
  const [activeTab, setActiveTab] = useState<'main' | 'rules' | 'notifications'>('main');
  const [rulesContent, setRulesContent] = useState('');
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [editRulesValue, setEditRulesValue] = useState('');

  useEffect(() => {
    if (activeTab === 'rules') {
      api.get('/api/settings/rules')
        .then(res => {
          setRulesContent(res.data.reglas);
          setEditRulesValue(res.data.reglas);
        })
        .catch(() => toast.error('Error al cargar reglas'));
    }
  }, [activeTab]);

  const saveRules = async () => {
    try {
      await api.put('/api/settings/rules', { reglas: editRulesValue });
      setRulesContent(editRulesValue);
      setIsEditingRules(false);
      toast.success('Reglas guardadas correctamente');
    } catch {
      toast.error('Error al guardar reglas');
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Sesión cerrada');
  };

  if (activeTab === 'rules') {
    return (
      <div className="app-shell-page bg-black text-dracula-light select-none">
        <header className="flex-shrink-0 bg-dracula-base/95 backdrop-blur-md z-40 border-b border-dracula-gray/20 pt-safe-top pb-4 px-4 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveTab('main')} className="bg-dracula-card p-2 rounded-full text-dracula-gray hover:text-dracula-light transition-colors btn-press">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-xl font-bold">Reglas del Juego</h1>
          </div>
          {USER_ROLE === 'admin' && !isEditingRules && (
            <button onClick={() => setIsEditingRules(true)} className="text-dracula-green font-bold text-sm btn-press">Editar</button>
          )}
          {USER_ROLE === 'admin' && isEditingRules && (
            <button onClick={saveRules} className="text-dracula-purple font-bold text-sm btn-press">Guardar</button>
          )}
        </header>
        <main className="app-shell-scroll p-4 pb-28 flex flex-col gap-4 animate-fadeIn">
          {isEditingRules ? (
            <textarea
              value={editRulesValue}
              onChange={(e) => setEditRulesValue(e.target.value)}
              className="w-full bg-dracula-card border border-dracula-gray/20 rounded-xl p-3 text-base text-dracula-light focus:outline-none focus:border-dracula-purple transition-colors resize-none h-96"
            />
          ) : (
            <div className="text-sm text-dracula-gray whitespace-pre-wrap selectable-text">{rulesContent}</div>
          )}
        </main>
      </div>
    );
  }

  if (activeTab === 'notifications') {
    return (
      <div className="app-shell-page bg-black text-dracula-light select-none">
        <header className="flex-shrink-0 bg-dracula-base/95 backdrop-blur-md z-40 border-b border-dracula-gray/20 pt-safe-top pb-4 px-4 flex items-center gap-3 select-none">
          <button onClick={() => setActiveTab('main')} className="bg-dracula-card p-2 rounded-full text-dracula-gray hover:text-dracula-light transition-colors btn-press">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Notificaciones</h1>
        </header>
        <main className="app-shell-scroll p-4 pb-28 flex flex-col gap-4 animate-fadeIn">
          <div className="text-sm text-dracula-gray">No hay notificaciones nuevas.</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell-page bg-black text-dracula-light select-none">
      {/* Cabecera con botón de volver al Perfil */}
      <header className="flex-shrink-0 bg-dracula-base/95 backdrop-blur-md z-40 border-b border-dracula-gray/20 pt-safe-top pb-4 px-4 flex items-center gap-3 select-none">
        <Link
          href="/groups?tab=ajustes"
          className="bg-dracula-card p-2 rounded-full text-dracula-gray hover:text-dracula-light transition-colors btn-press"
        >
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold">Ajustes</h1>
      </header>

      <main className="app-shell-scroll p-4 pb-28 flex flex-col gap-6 animate-fadeIn">
        {/* Personalización de Tema y Paleta Híbrida */}
        <ThemeSettingsCard />

        {/* Bloque 1: Ajustes Generales */}
        <div className="flex flex-col gap-2">
          <h2 className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest px-2 mb-1">
            General
          </h2>

          <Link
            href="/settings/editar"
            className="w-full bg-dracula-card p-4 rounded-xl border border-dracula-gray/10 flex items-center justify-between group hover:border-dracula-purple/50 transition-colors btn-press"
          >
            <div className="flex items-center gap-3">
              <UserCircle size={20} className="text-dracula-purple" />
              <span className="text-sm font-bold">Editar Perfil</span>
            </div>
            <ChevronRight
              size={18}
              className="text-dracula-gray group-hover:text-dracula-purple transition-colors"
            />
          </Link>

          <button onClick={() => setActiveTab('notifications')} className="w-full bg-dracula-card p-4 rounded-xl border border-dracula-gray/10 flex items-center justify-between group hover:border-dracula-purple/50 transition-colors btn-press">
            <div className="flex items-center gap-3">
              <BellRing size={20} className="text-dracula-yellow" />
              <span className="text-sm font-bold">Notificaciones</span>
            </div>
            <ChevronRight
              size={18}
              className="text-dracula-gray group-hover:text-dracula-yellow transition-colors"
            />
          </button>

          <button onClick={() => setActiveTab('rules')} className="w-full bg-dracula-card p-4 rounded-xl border border-dracula-gray/10 flex items-center justify-between group hover:border-dracula-green/50 transition-colors btn-press">
            <div className="flex items-center gap-3">
              <BookOpen size={20} className="text-dracula-green" />
              <span className="text-sm font-bold">Reglas del Juego</span>
            </div>
            <ChevronRight
              size={18}
              className="text-dracula-gray group-hover:text-dracula-green transition-colors"
            />
          </button>
        </div>

        {/* Bloque 2: Zona de Peligro / Administración */}
        <div className="flex flex-col gap-2 mt-2">
          <h2 className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest px-2 mb-1">
            Cuenta
          </h2>

          {/* MODO DIOS: Solo visible si el usuario es Admin */}
          {USER_ROLE === 'admin' && (
            <Link
              href="/admin"
              className="w-full bg-dracula-red/10 p-4 rounded-xl border border-dracula-red/30 flex items-center justify-between group hover:bg-dracula-red/20 transition-colors mb-2 btn-press"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert
                  size={20}
                  className="text-dracula-red animate-pulse"
                />
                <span className="text-sm font-black text-dracula-red tracking-wide">
                  Panel MODO ADMIN
                </span>
              </div>
              <ChevronRight size={18} className="text-dracula-red" />
            </Link>
          )}

          {/* Cerrar Sesión */}
          <button onClick={handleLogout} className="w-full bg-dracula-card p-4 rounded-xl border border-dracula-gray/10 flex items-center gap-3 hover:bg-dracula-gray/10 transition-colors btn-press">
            <LogOut size={20} className="text-dracula-gray" />
            <span className="text-sm font-bold text-dracula-gray">
              Cerrar Sesión
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
