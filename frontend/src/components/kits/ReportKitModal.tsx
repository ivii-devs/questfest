'use client';

/**
 * ============================================================================
 * MODAL DE DENUNCIA DE CONTENIDO (ReportKitModal)
 * ============================================================================
 * Permite a la comunidad reportar kits con contenido inapropiado o fraudulento.
 *
 * Política de Moderación Responsable (Zero-Censura Ciega):
 * El kit denunciado permanece en línea mientras se cursa el reporte para prevenir
 * boicots coordinados entre comunidades rivales. El reporte queda registrado
 * para su inspección por el Tribunal de Administración Global.
 * ============================================================================
 */

import React, { useState } from 'react';
import { X, Flag, AlertTriangle } from 'lucide-react';
import { reportKit } from '@/services/kitsService';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';

interface ReportKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  kitId: number | null;
}

export default function ReportKitModal({
  isOpen,
  onClose,
  kitId,
}: ReportKitModalProps) {
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !kitId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      toast.error('Por favor, describe el motivo de la denuncia');
      return;
    }

    setSubmitting(true);
    try {
      await reportKit(kitId, motivo.trim());
      toast.success('Denuncia registrada. El Tribunal revisará el contenido.');
      setMotivo('');
      onClose();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Error al enviar la denuncia'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-dracula-base border-dracula-gray/30 w-full max-w-md overflow-hidden rounded-3xl border shadow-2xl">
        <div className="border-dracula-gray/20 bg-dracula-card/60 flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-dracula-yellow/20 text-dracula-yellow flex h-10 w-10 items-center justify-center rounded-xl">
              <Flag size={20} />
            </div>
            <div>
              <h2 className="text-dracula-light text-base font-black tracking-wide">
                Reportar Kit de Comunidad
              </h2>
              <p className="text-dracula-gray text-xs">
                Auditoría ciudadana de retos y apuestas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-light rounded-xl p-2 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-dracula-yellow/10 border-dracula-yellow/30 flex items-start gap-2.5 rounded-2xl border p-3 text-xs">
            <AlertTriangle size={18} className="text-dracula-yellow shrink-0 mt-0.5" />
            <p className="text-dracula-gray leading-relaxed">
              QuestFest aplica una política <strong>anti-censura ciega</strong>. El kit no se
              eliminará automáticamente para evitar abusos; un moderador revisará tu reporte.
            </p>
          </div>

          <div>
            <label className="text-dracula-light mb-1.5 block text-xs font-bold uppercase">
              Motivo de la Denuncia *
            </label>
            <textarea
              required
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explica qué norma o contenido ofensivo contiene este kit..."
              className="bg-dracula-card border-dracula-gray/40 text-dracula-light focus:border-dracula-purple w-full rounded-xl border p-3 text-xs leading-relaxed focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-dracula-gray hover:text-dracula-light px-4 py-2 text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-press bg-dracula-red hover:bg-dracula-red/90 text-dracula-base flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black shadow-lg transition-all disabled:opacity-50"
            >
              <Flag size={14} />
              <span>{submitting ? 'Enviando...' : 'Enviar Reporte'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
