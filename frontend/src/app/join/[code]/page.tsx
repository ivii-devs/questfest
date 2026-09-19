'use client';

import React, { useState, use } from 'react';
import { Lock, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';

interface JoinPageProps {
  params: Promise<{ code: string }>;
}

/**
 * Página de aterrizaje para enlaces profundos de invitación (Deep Links: /join/[code]).
 * Permite a cualquier usuario con sesión iniciada unirse directamente a la comunidad
 * correspondiente tras ingresar la contraseña si el grupo está protegido.
 */
export default function DeepLinkJoinPage({ params }: JoinPageProps) {
  const resolvedParams = use(params);
  const code = (resolvedParams?.code || '').toUpperCase();

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { refreshGroups, setActiveGroupById } = useGroup();

  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirigir a login si el usuario no ha iniciado sesión
  if (!authLoading && !user) {
    if (typeof window !== 'undefined') {
      router.push(`/login?redirect=/join/${code}`);
    }
    return null;
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await api.post('/api/groups/join', {
        codigo_unico: code,
        codigo_invitacion: code,
        password: password.trim() || undefined,
      });

      // Recargar grupos en el contexto y seleccionar el nuevo de forma atómica
      const newGroupId = res.data?.id || res.data?.grupo?.id;
      await refreshGroups(newGroupId);
      router.push('/feed');
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status && err.response.status >= 400 && err.response.status < 500) {
        console.warn('[DeepLinkJoin] Validación de negocio:', getApiErrorMessage(error));
      } else {
        console.error('[DeepLinkJoin] Error inesperado al unirse:', error);
      }
      const errorMessage = getApiErrorMessage(error, 'No se pudo procesar la invitación');
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-dracula-light flex flex-col items-center justify-center p-4">
      <div className="bg-dracula-card border border-dracula-gray/30 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
        {/* Cabecera con efecto glow */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-dracula-purple to-[#ff79c6] flex items-center justify-center text-dracula-base font-black text-2xl mx-auto mb-3 shadow-[0_0_20px_rgba(189,147,249,0.4)]">
            <Sparkles size={32} />
          </div>
          <h1 className="text-xl font-black text-dracula-light tracking-wide uppercase">
            Invitación de Grupo
          </h1>
          <p className="text-xs text-dracula-gray mt-1">
            Has sido invitado a competir en una comunidad de QuestFest
          </p>
        </div>

        {/* Tarjeta del Código */}
        <div className="bg-dracula-base border border-dracula-purple/40 rounded-2xl p-4 text-center mb-5">
          <span className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest block mb-1">
            Código de Acceso
          </span>
          <span className="text-2xl font-black font-mono tracking-widest text-dracula-purple">
            {code}
          </span>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="join-group-password" className="block text-xs font-bold text-dracula-gray uppercase tracking-wider mb-1.5">
              Contraseña del Grupo (Si fue establecida)
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dracula-gray" />
              <input
                id="join-group-password"
                name="groupPassword"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Clave de seguridad del grupo"
                className="w-full bg-dracula-base border border-dracula-gray/30 rounded-xl py-2.5 pl-10 pr-3 text-base text-dracula-light placeholder-dracula-gray/50 focus:outline-none focus:border-dracula-purple transition-all"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/groups')}
              className="flex-1 py-3 px-4 rounded-xl border border-dracula-gray/30 text-dracula-gray font-bold text-xs uppercase tracking-wider hover:bg-dracula-base transition-colors btn-press"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-dracula-purple to-[#ff79c6] text-dracula-base font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(189,147,249,0.3)] hover:opacity-95 transition-opacity disabled:opacity-50 btn-press"
            >
              <span>{submitting ? 'Entrando...' : 'Unirme'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>

        <div className="mt-5 text-center">
          <span className="text-[10px] text-dracula-gray flex items-center justify-center gap-1">
            <ShieldCheck size={12} className="text-dracula-green" />
            Invitación verificada por el motor de QuestFest
          </span>
        </div>
      </div>
    </main>
  );
}
