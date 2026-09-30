'use client';

/**
 * ============================================================================
 * COMPONENTE: SECCIÓN DE INVITACIÓN AL GRUPO (AdminGroupInviteSection)
 * ============================================================================
 * Proporciona a los administradores del grupo los mecanismos de acceso e incorporación:
 * - Visualización del código alfanumérico único generado por CSPRNG.
 * - Copia rápida al portapapeles del código o del enlace directo `/join/[code]`.
 * - Código QR interactivo escaneable desde terminales móviles para onboarding instantáneo.
 * - Acción de regeneración del código para invalidar accesos no deseados de inmediato.
 * ============================================================================
 */

import React, { useState } from 'react';
import { KeyRound, Copy, Check, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { copyToClipboard } from '@/lib/clipboard';

export interface AdminGroupInviteSectionProps {
  inviteCode: string;
  onRegenerateCode: () => Promise<void>;
  regenerating?: boolean;
}

export default function AdminGroupInviteSection({
  inviteCode,
  onRegenerateCode,
  regenerating = false,
}: AdminGroupInviteSectionProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const joinUrl =
    typeof window !== 'undefined' && inviteCode
      ? `${window.location.origin}/join/${inviteCode}`
      : '';

  const qrApiUrl = inviteCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
        joinUrl
      )}&bgcolor=1e1f29&color=bd93f9&margin=10`
    : '';

  // Copiamos el código de invitación con soporte de fallback universal para HTTP y WebKit
  const handleCopyCode = async () => {
    if (!inviteCode) return;
    const ok = await copyToClipboard(inviteCode);
    if (ok) {
      setCopiedCode(true);
      toast.success('¡Código de invitación copiado!');
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      toast.error('No se pudo copiar el código automáticamente.');
    }
  };

  // Copiamos el enlace directo con la misma tolerancia a fallos
  const handleCopyLink = async () => {
    if (!joinUrl) return;
    const ok = await copyToClipboard(joinUrl);
    if (ok) {
      setCopiedLink(true);
      toast.success('¡Enlace directo copiado!');
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      toast.error('No se pudo copiar el enlace automáticamente.');
    }
  };

  return (
    <div className="bg-dracula-card border-dracula-purple/30 rounded-2xl border p-5 shadow-xl">
      <div className="border-dracula-gray/20 text-dracula-purple mb-4 flex items-center gap-2 border-b pb-3 text-sm font-black tracking-wider uppercase">
        <KeyRound size={18} />
        <span>Enlace de Invitación</span>
      </div>

      <div className="bg-dracula-base/70 border-dracula-gray/20 mb-4 flex flex-col items-center gap-4 rounded-xl border p-4 sm:flex-row">
        {qrApiUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrApiUrl}
            alt="QR Invitación"
            className="border-dracula-purple/40 h-32 w-32 shrink-0 rounded-lg border shadow"
          />
        )}

        <div className="w-full flex-1 space-y-3">
          <div>
            <span className="text-dracula-gray mb-1 block text-[10px] font-bold tracking-widest uppercase">
              Código para compartir
            </span>
            <div className="flex items-center gap-2">
              <div className="text-dracula-purple bg-dracula-card border-dracula-gray/20 flex-1 rounded-xl border p-2 text-center font-mono text-lg font-black">
                {inviteCode}
              </div>
              <button
                onClick={handleCopyCode}
                className="bg-dracula-purple text-dracula-base rounded-xl p-2.5 font-bold hover:opacity-90"
                aria-label="Copiar código"
              >
                {copiedCode ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <div>
            <span className="text-dracula-gray mb-1 block text-[10px] font-bold tracking-widest uppercase">
              Enlace directo
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={joinUrl}
                className="bg-dracula-card border-dracula-gray/30 text-dracula-gray flex-1 truncate rounded-xl border p-2 text-xs focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="bg-dracula-card hover:bg-dracula-base border-dracula-gray/30 text-dracula-light rounded-xl border p-2"
                aria-label="Copiar enlace"
              >
                {copiedLink ? (
                  <Check size={16} className="text-dracula-green" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onRegenerateCode}
        disabled={regenerating}
        className="text-dracula-red flex items-center gap-1.5 text-xs font-bold hover:underline"
      >
        <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
        <span>Regenerar código de invitación (revoca el anterior)</span>
      </button>
    </div>
  );
}
