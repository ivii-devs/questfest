'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { copyToClipboard } from '@/lib/clipboard';

interface GroupInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
}

/**
 * Modal exclusivo para Administradores de Grupo.
 * Muestra el código de acceso, el enlace directo de adhesión y genera
 * un código QR dinámico para permitir un escaneo presencial rápido.
 * Cumple con la directiva de seguridad: las invitaciones sólo son accesibles para los Group Admins.
 */
export default function GroupInviteModal({
  isOpen,
  onClose,
  groupId,
  groupName,
}: GroupInviteModalProps) {
  const [inviteCode, setInviteCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchInviteData = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/groups/${groupId}/invite`);
        setInviteCode(res.data.codigo_invitacion);
      } catch (error: unknown) {
        console.error('[GroupInviteModal] Error al obtener invitación:', error);
        toast.error('No se pudo cargar la información de invitación');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    fetchInviteData();
  }, [isOpen, groupId, onClose]);

  if (!isOpen) return null;

  const joinUrl =
    typeof window !== 'undefined' && inviteCode
      ? `${window.location.origin}/join/${inviteCode}`
      : '';

  const qrApiUrl = inviteCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}&bgcolor=1e1f29&color=bd93f9&margin=10`
    : '';

  // Copiamos el código empleando la utilidad con fallback para blindar la acción
  // frente a conexiones HTTP en red local y restricciones del motor WebKit en iOS Safari
  const handleCopyCode = async () => {
    if (!inviteCode) return;
    const ok = await copyToClipboard(inviteCode);
    if (ok) {
      setCopiedCode(true);
      toast.success('¡Código copiado al portapapeles!');
      setTimeout(() => setCopiedCode(false), 2500);
    } else {
      toast.error(
        'No se pudo copiar automáticamente. Por favor, selecciona y copia el código.'
      );
    }
  };

  // Copiamos el enlace directo garantizando la misma resiliencia ante cualquier navegador o contexto
  const handleCopyLink = async () => {
    if (!joinUrl) return;
    const ok = await copyToClipboard(joinUrl);
    if (ok) {
      setCopiedLink(true);
      toast.success('¡Enlace copiado al portapapeles!');
      setTimeout(() => setCopiedLink(false), 2500);
    } else {
      toast.error(
        'No se pudo copiar automáticamente. Por favor, copia el enlace del campo de texto.'
      );
    }
  };

  const handleRegenerateCode = async () => {
    if (
      !confirm(
        '¿Seguro que deseas regenerar el código? El código anterior dejará de funcionar inmediatamente.'
      )
    ) {
      return;
    }

    try {
      setRegenerating(true);
      const res = await api.post(`/api/groups/${groupId}/regenerate-code`);
      setInviteCode(res.data.codigo_invitacion);
      toast.success('Nuevo código generado con éxito');
    } catch {
      // Informar al usuario en caso de error al regenerar el código de grupo
      toast.error('Error al regenerar el código');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="pb-safe-bottom animate-fade-in fixed inset-0 -bottom-12 z-50 flex h-[100lvh] min-h-[100lvh] w-full items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="bg-dracula-card border-dracula-gray/30 relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border p-6 shadow-2xl">
        {/* Cabecera del Modal */}
        <div className="border-dracula-gray/20 mb-4 flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="bg-dracula-purple/20 text-dracula-purple rounded-lg p-1.5">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="text-dracula-light text-base font-black tracking-wide uppercase">
                Invitar a {groupName}
              </h2>
              <span className="text-dracula-purple text-[10px] font-bold tracking-wider uppercase">
                Panel Exclusivo de Administrador
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-light rounded-lg p-1 transition-colors"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="border-dracula-purple h-8 w-8 animate-spin rounded-full border-3 border-t-transparent"></div>
            <span className="text-dracula-gray text-xs font-bold">
              Cargando credenciales de acceso...
            </span>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Código QR Dinámico para escanear */}
            <div className="bg-dracula-base/80 border-dracula-gray/20 flex flex-col items-center justify-center rounded-2xl border p-4">
              {qrApiUrl && (
                <div className="border-dracula-purple/30 mb-2 rounded-xl border bg-[#1e1f29] p-2 shadow-lg">
                  <img
                    src={qrApiUrl}
                    alt={`Código QR para unirse a ${groupName}`}
                    className="h-44 w-44 rounded-lg object-contain"
                  />
                </div>
              )}
              <span className="text-dracula-gray flex items-center gap-1 text-[11px] font-semibold">
                <QrCode size={14} className="text-dracula-purple" />
                Escanea este QR con la cámara del móvil para unirte al instante
              </span>
            </div>

            {/* Código Alfanumérico */}
            <div>
              <label className="text-dracula-gray mb-1.5 block text-xs font-bold tracking-wider uppercase">
                Código de Entrada Directo
              </label>
              <div className="flex items-center gap-2">
                <div className="bg-dracula-base border-dracula-purple/40 text-dracula-purple flex-1 rounded-xl border px-4 py-2.5 text-center font-mono text-xl font-black tracking-widest">
                  {inviteCode}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="bg-dracula-purple/20 text-dracula-purple hover:bg-dracula-purple hover:text-dracula-base rounded-xl p-3 font-bold transition-all"
                  aria-label="Copiar código"
                >
                  {copiedCode ? (
                    <Check size={20} className="text-dracula-green" />
                  ) : (
                    <Copy size={20} />
                  )}
                </button>
              </div>
            </div>

            {/* Enlace Directo Compartible */}
            <div>
              <label className="text-dracula-gray mb-1.5 block text-xs font-bold tracking-wider uppercase">
                Enlace Directo
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={joinUrl}
                  className="bg-dracula-base border-dracula-gray/30 text-dracula-gray flex-1 truncate rounded-xl border px-3 py-2 text-xs select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="bg-dracula-card border-dracula-gray/30 text-dracula-light hover:text-dracula-purple rounded-xl border p-2.5 transition-all"
                  aria-label="Copiar enlace"
                >
                  {copiedLink ? (
                    <Check size={18} className="text-dracula-green" />
                  ) : (
                    <Share2 size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Opciones Avanzadas: Regenerar Código */}
            <div className="border-dracula-gray/20 flex items-center justify-between border-t pt-2">
              <button
                type="button"
                onClick={handleRegenerateCode}
                disabled={regenerating}
                className="text-dracula-red flex items-center gap-1 text-xs font-semibold hover:underline disabled:opacity-50"
              >
                <RefreshCw
                  size={12}
                  className={regenerating ? 'animate-spin' : ''}
                />
                Regenerar código (revoca el actual)
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-dracula-card hover:bg-dracula-base text-dracula-light rounded-xl px-4 py-2 text-xs font-bold transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
