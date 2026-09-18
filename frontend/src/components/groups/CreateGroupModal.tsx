'use client';

import React, { useState, useRef } from 'react';
import { X, Users, Lock, Camera, Sparkles } from 'lucide-react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { useGroup } from '@/context/GroupContext';
import { useRouter } from 'next/navigation';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal para la creación de una nueva comunidad o grupo en QuestFest.
 * El creador adquiere automáticamente el rol de Administrador ('admin') del grupo,
 * lo que le otorga acceso al tribunal de arbitraje, gestión de retos y generación de invitaciones.
 * Permite seleccionar una foto o logo representativo directamente desde la galería del dispositivo móvil.
 */
export default function CreateGroupModal({ isOpen, onClose }: CreateGroupModalProps) {
  const { refreshGroups, setActiveGroupById } = useGroup();
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  /**
   * Gestiona la selección del archivo de imagen desde el carrete o cámara del dispositivo.
   */
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

  /**
   * Limpia la foto seleccionada y revoca la URL del blob en memoria.
   */
  const removeSelectedImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error('Por favor, introduce un nombre para el grupo');
      return;
    }

    if (hasPassword && !password.trim()) {
      toast.error('Has activado contraseña protegida, introduce una clave');
      return;
    }

    try {
      setSubmitting(true);
      let icono_url: string | undefined = undefined;

      // Si el usuario seleccionó una imagen desde su galería, la subimos a Cloudinary
      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);

        const uploadRes = await api.post('/api/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        icono_url = uploadRes.data.secure_url;
      }

      const payload: Record<string, any> = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        icono_url: icono_url,
        avatar_url: icono_url,
        password: hasPassword ? password.trim() : undefined,
      };

      const res = await api.post('/api/groups/', payload);
      toast.success('¡Grupo creado exitosamente!');
      
      // Actualizamos la lista de grupos y establecemos el nuevo grupo como activo
      await refreshGroups();
      if (res.data?.id) {
        setActiveGroupById(res.data.id);
      }

      removeSelectedImage();
      onClose();
      // Redirigimos al feed del nuevo grupo
      router.push('/');
    } catch (error: any) {
      console.error('[CreateGroupModal] Error al crear grupo:', error);
      const detail = error.response?.data?.detail || 'No se pudo crear el grupo';
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-dracula-card border border-dracula-gray/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-dracula-gray/20">
          <div className="flex items-center gap-2 text-dracula-purple">
            <Sparkles size={22} className="animate-spin-slow" />
            <h2 className="text-lg font-black text-dracula-light uppercase tracking-wider">Crear Nuevo Grupo</h2>
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
          {/* Nombre del Grupo */}
          <div>
            <label htmlFor="create-group-name" className="block text-xs font-bold text-dracula-gray uppercase tracking-wider mb-1">
              Nombre de la Comunidad *
            </label>
            <div className="relative">
              <Users size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dracula-gray" />
              <input
                id="create-group-name"
                name="groupName"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Colegas de Fiesta 2026"
                className="w-full bg-dracula-base border border-dracula-gray/30 rounded-xl py-2.5 pl-10 pr-3 text-base text-dracula-light placeholder-dracula-gray/50 focus:outline-none focus:border-dracula-purple transition-all"
              />
            </div>
          </div>

          {/* Descripción opcional */}
          <div>
            <label htmlFor="create-group-desc" className="block text-xs font-bold text-dracula-gray uppercase tracking-wider mb-1">
              Descripción (Opcional)
            </label>
            <textarea
              id="create-group-desc"
              name="groupDescription"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="¿De qué trata este grupo o evento festivo?"
              rows={2}
              className="w-full bg-dracula-base border border-dracula-gray/30 rounded-xl p-3 text-base text-dracula-light placeholder-dracula-gray/50 focus:outline-none focus:border-dracula-purple transition-all resize-none"
            />
          </div>

          {/* Selector de Foto / Logo desde la Galería */}
          <div>
            <label className="block text-xs font-bold text-dracula-gray uppercase tracking-wider mb-1.5">
              Logo o Foto del Grupo (Galería)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />

            {imagePreview ? (
              <div className="relative flex items-center gap-3 p-3 bg-dracula-base border border-dracula-purple/40 rounded-xl">
                <img
                  src={imagePreview}
                  alt="Previsualización del logo"
                  className="w-14 h-14 rounded-xl object-cover border border-dracula-purple shadow"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-dracula-light block truncate">
                    {selectedImage?.name}
                  </span>
                  <span className="text-[10px] text-dracula-green font-semibold">
                    Foto lista para subir
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  className="p-2 text-dracula-red hover:bg-dracula-red/10 rounded-lg transition-colors btn-press"
                  aria-label="Quitar foto"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2.5 p-3.5 bg-dracula-base border border-dashed border-dracula-gray/40 hover:border-dracula-purple/60 rounded-xl text-xs font-bold text-dracula-gray hover:text-dracula-light transition-all group btn-press"
              >
                <Camera size={18} className="text-dracula-purple group-hover:scale-110 transition-transform" />
                <span>Seleccionar foto desde la galería del dispositivo</span>
              </button>
            )}
          </div>

          {/* Toggle de Contraseña de Acceso */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasPassword}
                onChange={(e) => setHasPassword(e.target.checked)}
                className="rounded border-dracula-gray/40 text-dracula-purple focus:ring-dracula-purple/30 bg-dracula-base w-4 h-4"
              />
              <span className="text-xs font-bold text-dracula-light flex items-center gap-1.5">
                <Lock size={14} className="text-dracula-yellow" />
                Proteger con contraseña de entrada
              </span>
            </label>

            {hasPassword && (
              <div className="mt-2.5 animate-fade-in">
                <input
                  id="create-group-password"
                  name="groupPassword"
                  type="password"
                  autoComplete="new-password"
                  aria-label="Contraseña del grupo"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Introduce la clave secreta del grupo"
                  className="w-full bg-dracula-base border border-dracula-yellow/50 rounded-xl py-2 px-3 text-base text-dracula-light placeholder-dracula-gray/50 focus:outline-none focus:border-dracula-yellow transition-all"
                />
                <p className="text-[10px] text-dracula-gray mt-1">
                  Los participantes deberán introducir este código además del enlace de invitación.
                </p>
              </div>
            )}
          </div>

          {/* Acciones del formulario */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-dracula-gray/30 text-dracula-gray font-bold text-sm hover:bg-dracula-base transition-colors btn-press"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-dracula-purple to-[#ff79c6] text-dracula-base font-black text-sm uppercase tracking-wider shadow-[0_0_15px_rgba(189,147,249,0.3)] hover:opacity-95 transition-opacity disabled:opacity-50 btn-press"
            >
              {submitting ? 'Creando...' : 'Crear Grupo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
