'use client';

import React, { useState } from 'react';
import { X, KeyRound, Lock, UserPlus } from 'lucide-react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { useGroup } from '@/context/GroupContext';
import { useRouter } from 'next/navigation';

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
export default function JoinGroupModal({ isOpen, onClose, defaultCode = '' }: JoinGroupModalProps) {
  const { refreshGroups, setActiveGroupById } = useGroup();
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
      const payload: Record<string, any> = {
        codigo_invitacion: codigo.trim().toUpperCase(),
        password: password.trim() || undefined,
      };

      const res = await api.post('/api/groups/join', payload);
      toast.success(res.data?.message || '¡Te has unido al grupo correctamente!');

      // Recargar grupos en el contexto y seleccionar el nuevo
      await refreshGroups();
      if (res.data?.grupo?.id) {
        setActiveGroupById(res.data.grupo.id);
      }

      onClose();
      // Redirigir al feed del grupo ingresado
      router.push('/');
    } catch (error: any) {
      console.error('[JoinGroupModal] Error al unirse al grupo:', error);
      const detail = error.response?.data?.detail || 'Error al unirse al grupo';
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-dracula-card border border-dracula-gray/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
        {/* Encabezado del Modal */}
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-dracula-gray/20">
          <div className="flex items-center gap-2 text-dracula-cyan">
            <UserPlus size={22} />
            <h2 className="text-lg font-black text-dracula-light uppercase tracking-wider">Unirse a un Grupo</h2>
          </div>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-light p-1 rounded-lg transition-colors"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-dracula-gray leading-relaxed">
            Introduce el código alfanumérico proporcionado por el administrador de tu grupo para unirte a la competición.
          </p>

          {/* Código de Invitación */}
          <div>
            <label htmlFor="join-modal-code" className="block text-xs font-bold text-dracula-gray uppercase tracking-wider mb-1">
              Código de Invitación (QF-XXXXX) *
            </label>
            <div className="relative">
              <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dracula-gray" />
              <input
                id="join-modal-code"
                name="groupInviteCode"
                type="text"
                autoComplete="off"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="QF-A1B2C"
                className="w-full bg-dracula-base border border-dracula-gray/30 rounded-xl py-2.5 pl-10 pr-3 text-base font-mono tracking-widest text-dracula-cyan placeholder-dracula-gray/50 uppercase focus:outline-none focus:border-dracula-cyan transition-all"
              />
            </div>
          </div>

          {/* Contraseña del Grupo si aplica */}
          <div>
            <label htmlFor="join-modal-password" className="block text-xs font-bold text-dracula-gray uppercase tracking-wider mb-1">
              Contraseña del Grupo (Si está protegido)
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dracula-gray" />
              <input
                id="join-modal-password"
                name="groupPassword"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña establecida por el creador"
                className="w-full bg-dracula-base border border-dracula-gray/30 rounded-xl py-2.5 pl-10 pr-3 text-sm text-dracula-light placeholder-dracula-gray/50 focus:outline-none focus:border-dracula-cyan transition-all"
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-dracula-gray/30 text-dracula-gray font-bold text-sm hover:bg-dracula-base transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-dracula-cyan to-[#50fa7b] text-dracula-base font-black text-sm uppercase tracking-wider shadow-[0_0_15px_rgba(139,233,253,0.3)] hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Verificando...' : 'Unirme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
