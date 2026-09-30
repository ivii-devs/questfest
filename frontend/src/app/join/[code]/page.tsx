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
  const { refreshGroups } = useGroup();

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
      if (
        err.response?.status &&
        err.response.status >= 400 &&
        err.response.status < 500
      ) {
        console.warn(
          '[DeepLinkJoin] Validación de negocio:',
          getApiErrorMessage(error)
        );
      } else {
        console.error('[DeepLinkJoin] Error inesperado al unirse:', error);
      }
      const errorMessage = getApiErrorMessage(
        error,
        'No se pudo procesar la invitación'
      );
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="text-dracula-light flex min-h-screen flex-col items-center justify-center bg-black p-4">
      <div className="bg-dracula-card border-dracula-gray/30 relative w-full max-w-md overflow-hidden rounded-3xl border p-6 shadow-2xl">
        {/* Cabecera con efecto glow */}
        <div className="mb-6 text-center">
          <div className="from-dracula-purple text-dracula-base mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr to-[#ff79c6] text-2xl font-black shadow-[0_0_20px_rgba(189,147,249,0.4)]">
            <Sparkles size={32} />
          </div>
          <h1 className="text-dracula-light text-xl font-black tracking-wide uppercase">
            Invitación de Grupo
          </h1>
          <p className="text-dracula-gray mt-1 text-xs">
            Has sido invitado a competir en una comunidad de QuestFest
          </p>
        </div>

        {/* Tarjeta del Código */}
        <div className="bg-dracula-base border-dracula-purple/40 mb-5 rounded-2xl border p-4 text-center">
          <span className="text-dracula-gray mb-1 block text-[10px] font-bold tracking-widest uppercase">
            Código de Acceso
          </span>
          <span className="text-dracula-purple font-mono text-2xl font-black tracking-widest">
            {code}
          </span>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label
              htmlFor="join-group-password"
              className="text-dracula-gray mb-1.5 block text-xs font-bold tracking-wider uppercase"
            >
              Contraseña del Grupo (Si fue establecida)
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="text-dracula-gray absolute top-1/2 left-3 -translate-y-1/2"
              />
              <input
                id="join-group-password"
                name="groupPassword"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Clave de seguridad del grupo"
                className="bg-dracula-base border-dracula-gray/30 text-dracula-light placeholder-dracula-gray/50 focus:border-dracula-purple w-full rounded-xl border py-2.5 pr-3 pl-10 text-base transition-all focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/groups')}
              className="border-dracula-gray/30 text-dracula-gray hover:bg-dracula-base btn-press flex-1 rounded-xl border px-4 py-3 text-xs font-bold tracking-wider uppercase transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="from-dracula-purple text-dracula-base btn-press flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r to-[#ff79c6] px-4 py-3 text-xs font-black tracking-wider uppercase shadow-[0_0_15px_rgba(189,147,249,0.3)] transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              <span>{submitting ? 'Entrando...' : 'Unirme'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>

        <div className="mt-5 text-center">
          <span className="text-dracula-gray flex items-center justify-center gap-1 text-[10px]">
            <ShieldCheck size={12} className="text-dracula-green" />
            Invitación verificada por el motor de QuestFest
          </span>
        </div>
      </div>
    </main>
  );
}
