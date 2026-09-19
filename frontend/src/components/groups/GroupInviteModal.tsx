'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, QrCode, RefreshCw, ShieldCheck, Share2 } from 'lucide-react';
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
export default function GroupInviteModal({ isOpen, onClose, groupId, groupName }: GroupInviteModalProps) {
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
      } catch (error: any) {
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

  const joinUrl = typeof window !== 'undefined' && inviteCode 
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
      toast.error('No se pudo copiar automáticamente. Por favor, selecciona y copia el código.');
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
      toast.error('No se pudo copiar automáticamente. Por favor, copia el enlace del campo de texto.');
    }
  };

  const handleRegenerateCode = async () => {
    if (!confirm('¿Seguro que deseas regenerar el código? El código anterior dejará de funcionar inmediatamente.')) {
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
    <div className="fixed inset-0 -bottom-12 min-h-[100lvh] h-[100lvh] w-full z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pb-safe-bottom animate-fade-in">
      <div className="bg-dracula-card border border-dracula-gray/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {/* Cabecera del Modal */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-dracula-gray/20">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-dracula-purple/20 text-dracula-purple rounded-lg">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="text-base font-black text-dracula-light uppercase tracking-wide">
                Invitar a {groupName}
              </h2>
              <span className="text-[10px] text-dracula-purple font-bold tracking-wider uppercase">
                Panel Exclusivo de Administrador
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-light p-1 rounded-lg transition-colors"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-dracula-purple border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold text-dracula-gray">Cargando credenciales de acceso...</span>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Código QR Dinámico para escanear */}
            <div className="flex flex-col items-center justify-center p-4 bg-dracula-base/80 border border-dracula-gray/20 rounded-2xl">
              {qrApiUrl && (
                <div className="p-2 bg-[#1e1f29] rounded-xl border border-dracula-purple/30 shadow-lg mb-2">
                  <img
                    src={qrApiUrl}
                    alt={`Código QR para unirse a ${groupName}`}
                    className="w-44 h-44 rounded-lg object-contain"
                  />
                </div>
              )}
              <span className="text-[11px] text-dracula-gray font-semibold flex items-center gap-1">
                <QrCode size={14} className="text-dracula-purple" />
                Escanea este QR con la cámara del móvil para unirte al instante
              </span>
            </div>

            {/* Código Alfanumérico */}
            <div>
              <label className="block text-xs font-bold text-dracula-gray uppercase tracking-wider mb-1.5">
                Código de Entrada Directo
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-dracula-base border border-dracula-purple/40 rounded-xl py-2.5 px-4 text-center font-mono text-xl font-black tracking-widest text-dracula-purple">
                  {inviteCode}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="p-3 bg-dracula-purple/20 text-dracula-purple hover:bg-dracula-purple hover:text-dracula-base rounded-xl transition-all font-bold"
                  aria-label="Copiar código"
                >
                  {copiedCode ? <Check size={20} className="text-dracula-green" /> : <Copy size={20} />}
                </button>
              </div>
            </div>

            {/* Enlace Directo Compartible */}
            <div>
              <label className="block text-xs font-bold text-dracula-gray uppercase tracking-wider mb-1.5">
                Enlace Directo
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={joinUrl}
                  className="flex-1 bg-dracula-base border border-dracula-gray/30 rounded-xl py-2 px-3 text-xs text-dracula-gray truncate select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="p-2.5 bg-dracula-card border border-dracula-gray/30 text-dracula-light hover:text-dracula-purple rounded-xl transition-all"
                  aria-label="Copiar enlace"
                >
                  {copiedLink ? <Check size={18} className="text-dracula-green" /> : <Share2 size={18} />}
                </button>
              </div>
            </div>

            {/* Opciones Avanzadas: Regenerar Código */}
            <div className="pt-2 flex justify-between items-center border-t border-dracula-gray/20">
              <button
                type="button"
                onClick={handleRegenerateCode}
                disabled={regenerating}
                className="text-xs text-dracula-red hover:underline flex items-center gap-1 font-semibold disabled:opacity-50"
              >
                <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} />
                Regenerar código (revoca el actual)
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 bg-dracula-card hover:bg-dracula-base text-dracula-light font-bold text-xs rounded-xl transition-colors"
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
