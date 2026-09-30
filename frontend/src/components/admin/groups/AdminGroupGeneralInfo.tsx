'use client';

/**
 * ============================================================================
 * COMPONENTE: INFORMACIÓN GENERAL DEL GRUPO (AdminGroupGeneralInfo)
 * ============================================================================
 * Permite al administrador del grupo editar los metadatos de la comunidad:
 * - Nombre y descripción visible.
 * - Foto de perfil o icono (subida hacia Cloudinary vía /api/upload/image).
 * - Saldo inicial asignado automáticamente a los nuevos participantes.
 * - Protección por contraseña (activar, cambiar clave o eliminar protección).
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { Edit, Save, Camera, X, Lock, ShieldCheck } from 'lucide-react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import { GrupoResponse } from '@/types';

export interface AdminGroupGeneralInfoProps {
  activeGroup: GrupoResponse;
  onGroupUpdated: () => Promise<void>;
}

export default function AdminGroupGeneralInfo({
  activeGroup,
  onGroupUpdated,
}: AdminGroupGeneralInfoProps) {
  const [nombre, setNombre] = useState(activeGroup.nombre || '');
  const [descripcion, setDescripcion] = useState(activeGroup.descripcion || '');
  // Permitimos '' mientras el usuario edita para evitar que aparezca un 0 residual ('0100')
  const [saldoInicial, setSaldoInicial] = useState<number | ''>(
    activeGroup.saldo_inicial ?? 100
  );
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    activeGroup.avatar_url || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState('');
  // Sincronización inicial con el estado de protección del grupo activo
  const [hasPassword, setHasPassword] = useState(
    Boolean(activeGroup.requiere_password)
  );
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    setNombre(activeGroup.nombre);
    setDescripcion(activeGroup.descripcion || '');
    setSaldoInicial(activeGroup.saldo_inicial ?? 100);
    setImagePreview(activeGroup.avatar_url || null);
    setSelectedImage(null);
    setHasPassword(Boolean(activeGroup.requiere_password));
    setPassword('');
  }, [
    activeGroup.id,
    activeGroup.nombre,
    activeGroup.descripcion,
    activeGroup.saldo_inicial,
    activeGroup.avatar_url,
    activeGroup.requiere_password,
  ]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecciona un archivo de imagen válido');
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    if (imagePreview && imagePreview !== activeGroup.avatar_url) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(activeGroup.avatar_url || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveGroupInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    // Validación de negocio: Si se activa la protección por contraseña en un grupo
    // previamente desprotegido, es obligatorio introducir la clave inicial
    if (hasPassword && !activeGroup.requiere_password && !password.trim()) {
      toast.error('Debes introducir una contraseña para proteger el grupo');
      return;
    }

    try {
      setSavingInfo(true);
      let icono_url: string | undefined = undefined;

      // Si el administrador seleccionó una nueva foto de su galería móvil, la subimos
      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);
        const uploadRes = await api.post('/api/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        icono_url = uploadRes.data.secure_url;
      }

      const payload: Record<string, unknown> = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        saldo_inicial:
          saldoInicial === ''
            ? (activeGroup.saldo_inicial ?? 100)
            : Math.max(0, Math.min(10000, Number(saldoInicial))),
      };
      if (icono_url) {
        payload.icono_url = icono_url;
      }

      // Sincronización soberana de contraseña:
      // 1. Si la casilla está desmarcada y el grupo requería clave -> enviamos "" para eliminarla
      if (!hasPassword) {
        if (activeGroup.requiere_password) {
          payload.password = '';
        }
      } else if (password.trim()) {
        // 2. Si la casilla está marcada y el usuario escribió una clave -> actualizamos con la nueva clave
        payload.password = password.trim();
      }
      // 3. Si la casilla está marcada, no se escribió nada y el grupo ya tenía clave ->
      // no incluimos 'password' en el payload para preservar el hash existente en el backend.

      await api.patch(`/api/groups/${activeGroup.id}`, payload);
      toast.success('Información del grupo actualizada correctamente');
      setSelectedImage(null);
      setPassword('');
      await onGroupUpdated();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error al actualizar grupo'));
    } finally {
      setSavingInfo(false);
    }
  };

  return (
    <div className="bg-dracula-card border-dracula-gray/20 rounded-2xl border p-5 shadow-xl">
      <div className="text-dracula-purple border-dracula-gray/20 mb-4 flex items-center gap-2 border-b pb-2 text-sm font-black tracking-wider uppercase">
        <Edit size={18} />
        <span>Configuración de {activeGroup.nombre}</span>
      </div>

      <form onSubmit={handleSaveGroupInfo} className="space-y-3.5">
        <div>
          <label className="text-dracula-gray mb-1 block text-[10px] font-bold tracking-wider uppercase">
            Nombre del Grupo *
          </label>
          <input
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="bg-dracula-base border-dracula-gray/30 text-dracula-light focus:border-dracula-purple w-full rounded-xl border p-2.5 text-sm focus:outline-none"
          />
        </div>

        <div>
          <label className="text-dracula-gray mb-1 block text-[10px] font-bold tracking-wider uppercase">
            Descripción
          </label>
          <textarea
            rows={2}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="bg-dracula-base border-dracula-gray/30 text-dracula-light focus:border-dracula-purple w-full resize-none rounded-xl border p-2.5 text-sm focus:outline-none"
          />
        </div>

        {/* Foto del Grupo desde la Galería */}
        <div>
          <label className="text-dracula-gray mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
            Foto del Grupo
          </label>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />

          {imagePreview ? (
            <div className="bg-dracula-base border-dracula-purple/30 flex items-center gap-3 rounded-xl border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Logo del grupo"
                className="border-dracula-purple h-14 w-14 rounded-xl border object-cover shadow"
              />
              <div className="min-w-0 flex-1">
                <span className="text-dracula-light block truncate text-xs font-bold">
                  {selectedImage ? selectedImage.name : 'Foto actual del grupo'}
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-dracula-purple mt-0.5 block text-[10px] font-bold hover:underline"
                >
                  Cambiar foto del grupo
                </button>
              </div>
              {selectedImage && (
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  className="text-dracula-red hover:bg-dracula-red/10 rounded-lg p-1.5 transition-colors"
                  title="Restaurar foto anterior"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-dracula-base border-dracula-gray/40 hover:border-dracula-purple/60 text-dracula-gray hover:text-dracula-light group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-xs font-bold transition-all"
            >
              <Camera
                size={16}
                className="text-dracula-purple transition-transform group-hover:scale-110"
              />
              <span>Seleccionar foto del grupo</span>
            </button>
          )}
        </div>

        {/* Saldo Inicial para Nuevos Miembros */}
        <div>
          <label className="text-dracula-gray mb-1 block text-[10px] font-bold tracking-wider uppercase">
            Saldo inicial para nuevos miembros
          </label>
          <TokenAmountInput
            min={0}
            max={10000}
            value={saldoInicial}
            onChange={setSaldoInicial}
            placeholder="100"
            className="bg-dracula-base border-dracula-gray/30 text-dracula-light focus:border-dracula-yellow w-full rounded-xl border py-2 pr-3 pl-9 text-sm transition-all focus:outline-none"
          />
          <p className="text-dracula-gray mt-1 text-[10px]">
            Cantidad de QuestCoins asignadas automáticamente a los futuros
            miembros que se unan al grupo.
          </p>
        </div>

        <div className="pt-1">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={hasPassword}
              onChange={(e) => {
                setHasPassword(e.target.checked);
                if (!e.target.checked) {
                  setPassword('');
                }
              }}
              className="text-dracula-purple focus:ring-dracula-purple bg-dracula-base h-4 w-4 rounded"
            />
            <span className="text-dracula-light flex items-center gap-1 text-xs font-bold">
              <Lock size={14} className="text-dracula-yellow" />
              Proteger con contraseña
            </span>
          </label>

          {hasPassword && (
            <div className="animate-fade-in mt-2 space-y-2">
              {activeGroup.requiere_password ? (
                <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1.5 text-[11px] text-emerald-400">
                  <ShieldCheck
                    size={14}
                    className="shrink-0 text-emerald-400"
                  />
                  <span>
                    Este grupo ya cuenta con contraseña activa. Deja el campo
                    vacío para conservarla o escribe una nueva para cambiarla.
                  </span>
                </div>
              ) : (
                <p className="text-dracula-gray text-[10px]">
                  Los participantes deberán introducir esta clave secreta para
                  poder unirse al grupo.
                </p>
              )}

              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  activeGroup.requiere_password
                    ? 'Nueva clave (dejar en blanco para mantener la actual)'
                    : 'Introduce la clave secreta del grupo'
                }
                className="bg-dracula-base border-dracula-yellow/40 text-dracula-light focus:border-dracula-yellow w-full rounded-xl border p-2.5 text-sm focus:outline-none"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={savingInfo}
          className="bg-dracula-purple text-dracula-base flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black tracking-wider uppercase shadow-md transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Save size={16} />
          <span>
            {savingInfo ? 'Guardando...' : 'Guardar Cambios del Grupo'}
          </span>
        </button>
      </form>
    </div>
  );
}
