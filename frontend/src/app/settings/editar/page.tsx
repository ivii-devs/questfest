'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  Camera,
  Save,
  User,
  FileText,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { useRef, useEffect } from 'react';

export default function EditProfilePage() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState({
    username: '',
    bio: '',
    avatarUrl: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setProfile({
        username: user.username,
        bio: user.bio || '',
        avatarUrl: user.avatar_url || '',
      });
    }
  }, [user]);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading('Subiendo foto...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.put('/api/auth/me/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      await refreshProfile();
      toast.success('Foto actualizada con éxito', { id: toastId });
    } catch {
      toast.error('Error al subir la foto', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!profile.username.trim()) {
      toast.error('El nombre de usuario no puede estar vacío.');
      return;
    }

    const toastId = toast.loading('Guardando perfil...');
    try {
      await api.patch('/api/auth/me', {
        username: profile.username,
        bio: profile.bio,
      });
      await refreshProfile();
      toast.success('Perfil actualizado con éxito', { id: toastId });
      router.push('/groups?tab=perfil');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Error al guardar perfil', {
        id: toastId,
      });
    }
  };

  return (
    <div className="app-shell-page bg-black text-dracula-light select-none">
      {/* Cabecera con soporte de Área Segura (iPhone notch) */}
      <header className="flex-shrink-0 bg-dracula-base/95 backdrop-blur-md z-40 border-b border-dracula-gray/20 pt-safe-top pb-4 px-4 flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="bg-dracula-card p-2 rounded-full text-dracula-gray hover:text-dracula-light transition-colors btn-press"
          >
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold">Editar Perfil</h1>
        </div>
        <button
          onClick={handleSave}
          className="text-dracula-purple font-bold flex items-center gap-1.5 bg-dracula-purple/10 px-3 py-1.5 rounded-lg hover:bg-dracula-purple/20 transition-colors btn-press"
        >
          <Save size={16} /> Guardar
        </button>
      </header>

      <main className="app-shell-scroll p-4 pb-28 flex flex-col gap-6 animate-fadeIn">
        {/* Foto de Perfil */}
        <div className="flex flex-col items-center justify-center mt-2">
          <div
            className="relative group cursor-pointer btn-press"
            onClick={handlePhotoClick}
          >
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
            />
            {/* Círculo de la foto */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-dracula-purple to-[#ff79c6] flex items-center justify-center text-4xl font-black text-dracula-base shadow-lg overflow-hidden border-2 border-dracula-base group-hover:border-dracula-purple transition-colors">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : profile.username ? (
                profile.username.charAt(0).toUpperCase()
              ) : (
                '?'
              )}

              {/* Overlay oscuro al pasar el ratón */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={28} className="text-white" />
              </div>
            </div>

            {/* Icono de cámara pequeño inferior */}
            <div className="absolute bottom-0 right-0 bg-dracula-card p-2 rounded-full border border-dracula-gray/20 shadow-lg text-dracula-purple">
              <Camera size={16} />
            </div>
          </div>
          <span className="text-xs text-dracula-gray mt-3 font-semibold">
            {isUploading ? 'Cargando...' : 'Toca para cambiar la foto desde la galería'}
          </span>
        </div>

        {/* Formulario */}
        <div className="flex flex-col gap-4 mt-2">
          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-profile-username" className="text-[10px] font-bold uppercase text-dracula-gray flex items-center gap-1">
              <User size={12} /> Nombre de Usuario *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dracula-gray font-bold">
                @
              </span>
              <input
                id="edit-profile-username"
                name="username"
                type="text"
                autoComplete="username"
                value={profile.username}
                onChange={(e) =>
                  setProfile({ ...profile, username: e.target.value })
                }
                className="w-full bg-dracula-card border border-dracula-gray/20 rounded-xl py-3 pl-8 pr-3 text-base font-bold text-dracula-light focus:outline-none focus:border-dracula-purple transition-colors"
                placeholder="Tu alias"
              />
            </div>
          </div>

          {/* Bio / Descripción */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-profile-bio" className="text-[10px] font-bold uppercase text-dracula-gray flex items-center gap-1">
              <FileText size={12} /> Estado / Descripción
            </label>
            <textarea
              id="edit-profile-bio"
              name="bio"
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className="w-full bg-dracula-card border border-dracula-gray/20 rounded-xl p-3 text-base text-dracula-light focus:outline-none focus:border-dracula-purple transition-colors resize-none h-24"
              placeholder="¿Qué se cuece hoy? Escribe algo sobre ti..."
              maxLength={150}
            />
            <span className="text-[10px] text-right text-dracula-gray">
              {profile.bio.length} / 150
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
