'use client';

/**
 * ============================================================================
 * PESTAÑA DE PERFIL E IDENTIDAD GLOBAL (WelcomeProfileTab)
 * ============================================================================
 * Permite al usuario gestionar su avatar con subida directa a Cloudinary,
 * y editar in-place su nombre de usuario global y biografía.
 * ============================================================================
 */

import React, { useState, useRef } from 'react';
import { Camera, Pencil, Check, X, Loader2, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/errorHandler';

export default function WelcomeProfileTab() {
  const { user, refreshProfile } = useAuth();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Edición in-place de nombre de usuario
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // Edición in-place de biografía
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [isSavingBio, setIsSavingBio] = useState(false);

  const handleAvatarClick = () => {
    if (avatarInputRef.current) {
      avatarInputRef.current.click();
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5 MB');
      return;
    }

    setIsUploadingAvatar(true);
    const toastId = toast.loading('Subiendo nuevo avatar...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await api.post('/api/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadedUrl = uploadRes.data?.secure_url;
      if (!uploadedUrl) {
        throw new Error('No se recibió la URL de la imagen');
      }

      await api.patch('/api/auth/me', { avatar_url: uploadedUrl });
      await refreshProfile();
      toast.success('Avatar actualizado con éxito', { id: toastId });
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Error al subir el avatar'), {
        id: toastId,
      });
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleSaveUsername = async () => {
    const trimmed = usernameDraft.trim();
    if (!trimmed) {
      toast.error('El nombre de usuario no puede estar vacío');
      return;
    }

    if (trimmed === user?.username) {
      setIsEditingUsername(false);
      return;
    }

    setIsSavingUsername(true);
    const toastId = toast.loading('Actualizando nombre...');

    try {
      await api.patch('/api/auth/me', { username: trimmed });
      await refreshProfile();
      toast.success('Nombre de usuario actualizado', { id: toastId });
      setIsEditingUsername(false);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Error al actualizar el nombre'), {
        id: toastId,
      });
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleSaveBio = async () => {
    const trimmed = bioDraft.trim();
    setIsSavingBio(true);
    const toastId = toast.loading('Actualizando estado...');

    try {
      await api.patch('/api/auth/me', { bio: trimmed });
      await refreshProfile();
      toast.success('Biografía actualizada', { id: toastId });
      setIsEditingBio(false);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Error al actualizar la biografía'), {
        id: toastId,
      });
    } finally {
      setIsSavingBio(false);
    }
  };

  return (
    <div className="animate-fade-in mx-auto max-w-lg space-y-5">
      {/* Tarjeta de Identidad Global con Edición Directa In-Place */}
      <div className="bg-dracula-card border-dracula-gray/20 relative overflow-hidden rounded-2xl border p-6 text-center shadow-xl">
        <input
          type="file"
          ref={avatarInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
          disabled={isUploadingAvatar}
        />

        {/* Contenedor Interactivo del Avatar */}
        <div className="relative mx-auto mb-3 inline-block">
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={isUploadingAvatar}
            aria-label="Cambiar foto de perfil"
            className="from-dracula-purple text-dracula-base group btn-press hover:border-dracula-purple relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-transparent bg-gradient-to-tr to-[#ff79c6] text-4xl font-black shadow-[0_0_25px_rgba(189,147,249,0.4)] transition-transform hover:scale-105 disabled:cursor-wait"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                className={`h-full w-full object-cover transition-opacity ${
                  isUploadingAvatar ? 'opacity-40' : 'opacity-100'
                }`}
              />
            ) : (
              <span
                className={isUploadingAvatar ? 'opacity-40' : 'opacity-100'}
              >
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </span>
            )}

            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera size={26} className="text-white drop-shadow-md" />
            </div>

            {isUploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Loader2
                  size={28}
                  className="text-dracula-purple animate-spin"
                />
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={isUploadingAvatar}
            aria-label="Subir foto de perfil"
            className="bg-dracula-base border-dracula-purple/50 text-dracula-purple hover:bg-dracula-purple hover:text-dracula-base btn-press absolute right-0 bottom-0 cursor-pointer rounded-full border p-2 shadow-lg transition-colors"
          >
            <Camera size={14} />
          </button>
        </div>

        <p className="text-dracula-gray mb-4 text-[11px] font-semibold">
          {isUploadingAvatar
            ? 'Subiendo imagen a Cloudinary...'
            : 'Toca la foto para cambiar tu avatar global'}
        </p>

        {/* Campo 1: Nombre de Usuario (Edición In-Place) */}
        <div className="mb-4">
          {isEditingUsername ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveUsername();
              }}
              className="mx-auto flex max-w-xs items-center justify-center gap-2"
            >
              <div className="relative flex-1">
                <span className="text-dracula-gray absolute top-1/2 left-3 -translate-y-1/2 text-sm font-bold">
                  @
                </span>
                <input
                  type="text"
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsEditingUsername(false);
                      setUsernameDraft('');
                    }
                  }}
                  autoFocus
                  disabled={isSavingUsername}
                  className="bg-dracula-base border-dracula-purple text-dracula-light focus:ring-dracula-purple/50 w-full rounded-xl border py-1.5 pr-2.5 pl-7 text-sm font-bold transition-all focus:ring-2 focus:outline-none"
                  placeholder="Nombre de usuario"
                />
              </div>
              <button
                type="submit"
                disabled={isSavingUsername}
                aria-label="Guardar nombre de usuario"
                className="bg-dracula-green text-dracula-base btn-press rounded-xl p-2 font-bold transition-all hover:brightness-110 disabled:opacity-50"
              >
                {isSavingUsername ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingUsername(false);
                  setUsernameDraft('');
                }}
                disabled={isSavingUsername}
                aria-label="Cancelar edición de nombre"
                className="bg-dracula-base border-dracula-gray/30 text-dracula-gray hover:text-dracula-light btn-press rounded-xl border p-2 font-bold transition-all disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <h2
                onClick={() => {
                  setUsernameDraft(user?.username || '');
                  setIsEditingUsername(true);
                }}
                className="text-dracula-light hover:text-dracula-purple group flex cursor-pointer items-center gap-1.5 text-xl font-black transition-colors"
                title="Clic para editar tu nombre de usuario"
              >
                <span>@{user?.username}</span>
                <span className="text-dracula-gray group-hover:text-dracula-purple group-hover:bg-dracula-base/80 rounded-md p-1 opacity-60 transition-all group-hover:opacity-100">
                  <Pencil size={14} />
                </span>
              </h2>
            </div>
          )}
        </div>

        {/* Campo 2: Biografía / Estado (Edición In-Place) */}
        <div className="mb-2">
          {isEditingBio ? (
            <div className="space-y-2 text-left">
              <div className="relative">
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsEditingBio(false);
                      setBioDraft('');
                    }
                  }}
                  autoFocus
                  disabled={isSavingBio}
                  maxLength={150}
                  rows={3}
                  placeholder="Estado o descripción (opcional)..."
                  className="bg-dracula-base border-dracula-purple text-dracula-light focus:ring-dracula-purple/50 placeholder:text-dracula-gray/60 w-full resize-none rounded-xl border p-3 text-sm transition-all placeholder:italic focus:ring-2 focus:outline-none"
                />
                <div className="text-dracula-gray mt-1 text-right text-[10px]">
                  {bioDraft.length} / 150 caracteres
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingBio(false);
                    setBioDraft('');
                  }}
                  disabled={isSavingBio}
                  className="bg-dracula-base border-dracula-gray/30 text-dracula-gray hover:text-dracula-light btn-press flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <X size={14} /> Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveBio}
                  disabled={isSavingBio}
                  className="bg-dracula-purple text-dracula-base btn-press flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold shadow-md transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {isSavingBio ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />{' '}
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Guardar
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => {
                setBioDraft(user?.bio || '');
                setIsEditingBio(true);
              }}
              className="group border-dracula-gray/20 hover:border-dracula-purple/50 bg-dracula-base/60 relative cursor-pointer rounded-xl border p-3 transition-all"
              title="Clic para editar tu descripción o estado"
            >
              <div className="text-dracula-gray group-hover:text-dracula-purple absolute top-2.5 right-2.5 opacity-40 transition-all group-hover:opacity-100">
                <Pencil size={13} />
              </div>
              {user?.bio ? (
                <p className="text-dracula-light/90 pr-5 text-sm italic">
                  &ldquo;{user.bio}&rdquo;
                </p>
              ) : (
                <p className="text-dracula-gray pr-5 text-xs italic">
                  Sin biografía aún. Toca aquí para añadir un estado o
                  descripción...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Banner explicativo del Aislamiento de Estadísticas */}
      <div className="bg-dracula-purple/10 border-dracula-purple/30 flex items-start gap-3 rounded-2xl border p-4">
        <Info size={20} className="text-dracula-purple mt-0.5 shrink-0" />
        <div className="text-dracula-light text-xs leading-relaxed">
          <strong className="text-dracula-purple mb-0.5 block">
            ¿Dónde está mi historial y actividad?
          </strong>
          El saldo de QuestCoins, apuestas, duelos y misiones son independientes
          por cada grupo. Para consultar tu historial y estadísticas de una
          comunidad, entra al grupo y pulsa en la pestaña{' '}
          <strong>Estadísticas</strong>.
        </div>
      </div>
    </div>
  );
}
