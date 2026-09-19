'use client';

import React, { useState, useRef } from 'react';
import { X, Users, Lock, Camera, Sparkles } from 'lucide-react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { useGroup } from '@/context/GroupContext';
import { useRouter } from 'next/navigation';
import { getApiErrorMessage } from '@/lib/errorHandler';
import TokenAmountInput from '@/components/ui/TokenAmountInput';

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
  // Permitimos que el saldo inicial sea temporalmente '' durante el tecleo o borrado
  // para evitar que se autocomplete con un '0' residual delante del nuevo número introducido
  const [saldoInicial, setSaldoInicial] = useState<number | ''>(100);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  /**
   * Gestiona la selección del archivo de imagen desde el carrete o cámara del dispositivo.
   * Valida que el archivo no supere los 5 MB para evitar saturar el ancho de banda PWA.
   */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar los 5 MB');
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Limpia la previsualización y el archivo seleccionado.
   */
  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Envía la solicitud de creación de grupo al backend.
   * Si se seleccionó una imagen, se sube primero como FormData multiparte.
   * A continuación, se persiste la entidad en el backend y se activa automáticamente.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error('El nombre del grupo es obligatorio');
      return;
    }

    setSubmitting(true);
    try {
      let icono_url: string | undefined = undefined;

      // 1. Subir imagen si fue adjuntada por el usuario
      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);
        const uploadRes = await api.post('/api/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        icono_url = uploadRes.data?.url;
      }

      // 2. Crear grupo con saldo inicial configurado (por defecto 100 si se dejó vacío)
      const payload: Record<string, any> = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        icono_url: icono_url,
        avatar_url: icono_url,
        password: hasPassword ? password.trim() : undefined,
        saldo_inicial: saldoInicial === '' ? 100 : Math.max(0, Math.min(10000, Number(saldoInicial))),
      };

      const res = await api.post('/api/groups/', payload);
      toast.success('¡Grupo creado exitosamente!');
      
      // Actualizamos la lista de grupos y establecemos el nuevo grupo como activo de forma atómica
      await refreshGroups(res.data?.id);

      removeSelectedImage();
      onClose();
      // Redirigimos al feed del nuevo grupo
      router.push('/feed');
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status && err.response.status >= 400 && err.response.status < 500) {
        console.warn('[CreateGroupModal] Validación de negocio:', getApiErrorMessage(error));
      } else {
        console.error('[CreateGroupModal] Error inesperado al crear grupo:', error);
      }
      const detail = getApiErrorMessage(error, 'No se pudo crear el grupo');
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 -bottom-12 min-h-[100lvh] h-[100lvh] w-full z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pb-safe-bottom animate-fade-in">
      <div className="bg-dracula-card border border-dracula-gray/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative max-h-[calc(100dvh-2rem)] overflow-y-auto">
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
              Nombre del Grupo *
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
                <span>Seleccionar foto del grupo</span>
              </button>
            )}
          </div>

          {/* Saldo Inicial de QuestCoins */}
          <div>
            <label htmlFor="create-group-balance" className="block text-xs font-bold text-dracula-gray uppercase tracking-wider mb-1">
              Saldo inicial de QuestCoins
            </label>
            <TokenAmountInput
              id="create-group-balance"
              name="groupBalance"
              min={0}
              max={10000}
              value={saldoInicial}
              onChange={setSaldoInicial}
              placeholder="100"
              className="w-full bg-dracula-base border border-dracula-gray/30 rounded-xl py-2.5 pl-10 pr-3 text-base text-dracula-light placeholder-dracula-gray/50 focus:outline-none focus:border-dracula-yellow transition-all"
            />
            <p className="text-[10px] text-dracula-gray mt-1">
              Fondo inicial que recibirás tú y cada nuevo participante al unirse al grupo.
            </p>
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
                Proteger con contraseña
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
