'use client';

import React, { useState } from 'react';
import { X, KeyRound, Lock, UserPlus } from 'lucide-react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { useGroup } from '@/context/GroupContext';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage } from '@/lib/errorHandler';

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCode?: string;
}

/**
 * Modal interactivo para unirse a un grupo existente en QuestFest mediante
 * su código de invitación (formato QF-XXXXX) y contraseña opcional.
 * Al ingresar, al usuario se le asigna el rol 'member' y un saldo inicial de 100 QuestCoins.
 */
export default function JoinGroupModal({
  isOpen,
  onClose,
  defaultCode = '',
}: JoinGroupModalProps) {
  const { refreshGroups } = useGroup();
  const router = useRouter();

  const [codigo, setCodigo] = useState(defaultCode);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim()) {
      toast.error('Por favor, introduce el código de invitación');
      return;
    }

    try {
      setSubmitting(true);
      const cleanCode = codigo.trim().toUpperCase();
      const payload: {
        codigo_unico: string;
        codigo_invitacion: string;
        password?: string;
      } = {
        codigo_unico: cleanCode,
        codigo_invitacion: cleanCode,
        password: password.trim() || undefined,
      };

      const res = await api.post('/api/groups/join', payload);
      toast.success(
        res.data?.message || '¡Te has unido al grupo correctamente!'
      );

      // Recargar grupos en el contexto y seleccionar el nuevo de forma atómica
      const newGroupId = res.data?.id || res.data?.grupo?.id;
      await refreshGroups(newGroupId);

      onClose();
      // Redirigir al feed del grupo ingresado
      router.push('/feed');
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (
        err.response?.status &&
        err.response.status >= 400 &&
        err.response.status < 500
      ) {
        console.warn(
          '[JoinGroupModal] Validación de negocio:',
          getApiErrorMessage(error)
        );
      } else {
        console.error(
          '[JoinGroupModal] Error inesperado al unirse al grupo:',
          error
        );
      }
      const errorMessage = getApiErrorMessage(
        error,
        'Error al unirse al grupo'
      );
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-safe-bottom animate-fade-in fixed inset-0 -bottom-12 z-50 flex h-[100lvh] min-h-[100lvh] w-full items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="bg-dracula-card border-dracula-gray/30 relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border p-6 shadow-2xl">
        {/* Encabezado del Modal */}
        <div className="border-dracula-gray/20 mb-5 flex items-center justify-between border-b pb-3">
          <div className="text-dracula-cyan flex items-center gap-2">
            <UserPlus size={22} />
            <h2 className="text-dracula-light text-lg font-black tracking-wider uppercase">
              Unirse a un Grupo
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-light rounded-lg p-1 transition-colors"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-dracula-gray text-xs leading-relaxed">
            Introduce el código proporcionado por el administrador de tu grupo
            para unirte.
          </p>

          {/* Código de Invitación */}
          <div>
            <label
              htmlFor="join-modal-code"
              className="text-dracula-gray mb-1 block text-xs font-bold tracking-wider uppercase"
            >
              Código de Invitación (QF-XXXXX) *
            </label>
            <div className="relative">
              <KeyRound
                size={18}
                className="text-dracula-gray absolute top-1/2 left-3 -translate-y-1/2"
              />
              <input
                id="join-modal-code"
                name="groupInviteCode"
                type="text"
                autoComplete="off"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="QF-A1B2C"
                className="bg-dracula-base border-dracula-gray/30 text-dracula-cyan placeholder-dracula-gray/50 focus:border-dracula-cyan w-full rounded-xl border py-2.5 pr-3 pl-10 font-mono text-base tracking-widest uppercase transition-all focus:outline-none"
              />
            </div>
          </div>

          {/* Contraseña del Grupo si aplica */}
          <div>
            <label
              htmlFor="join-modal-password"
              className="text-dracula-gray mb-1 block text-xs font-bold tracking-wider uppercase"
            >
              Contraseña del Grupo
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="text-dracula-gray absolute top-1/2 left-3 -translate-y-1/2"
              />
              <input
                id="join-modal-password"
                name="groupPassword"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Dejar en blanco si no tiene"
                className="bg-dracula-base border-dracula-gray/30 text-dracula-light placeholder-dracula-gray/50 focus:border-dracula-cyan w-full rounded-xl border py-2.5 pr-3 pl-10 text-sm transition-all focus:outline-none"
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="border-dracula-gray/30 text-dracula-gray hover:bg-dracula-base flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="from-dracula-cyan text-dracula-base flex-1 rounded-xl bg-gradient-to-r to-[#50fa7b] px-4 py-2.5 text-sm font-black tracking-wider uppercase shadow-[0_0_15px_rgba(139,233,253,0.3)] transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? 'Verificando...' : 'Unirme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
