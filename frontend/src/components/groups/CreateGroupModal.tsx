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
export default function CreateGroupModal({
  isOpen,
  onClose,
}: CreateGroupModalProps) {
  const { refreshGroups } = useGroup();
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

      // 1. Subir imagen a Cloudinary si fue adjuntada por el usuario.
      // Usamos el endpoint canónico '/api/upload/image' y extraemos 'secure_url'
      // garantizando compatibilidad con el formato devuelto por la API de subida.
      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);
        const uploadRes = await api.post('/api/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        icono_url = uploadRes.data?.secure_url || uploadRes.data?.url;
      }

      // 2. Crear grupo con saldo inicial configurado (por defecto 100 si se dejó vacío)
      const payload: Record<string, unknown> = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        icono_url: icono_url,
        avatar_url: icono_url,
        password: hasPassword ? password.trim() : undefined,
        saldo_inicial:
          saldoInicial === ''
            ? 100
            : Math.max(0, Math.min(10000, Number(saldoInicial))),
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
      if (
        err.response?.status &&
        err.response.status >= 400 &&
        err.response.status < 500
      ) {
        console.warn(
          '[CreateGroupModal] Validación de negocio:',
          getApiErrorMessage(error)
        );
      } else {
        console.error(
          '[CreateGroupModal] Error inesperado al crear grupo:',
          error
        );
      }
      const detail = getApiErrorMessage(error, 'No se pudo crear el grupo');
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-safe-bottom animate-fade-in fixed inset-0 -bottom-12 z-50 flex h-[100lvh] min-h-[100lvh] w-full items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="bg-dracula-card border-dracula-gray/30 relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border p-6 shadow-2xl">
        {/* Cabecera del Modal */}
        <div className="border-dracula-gray/20 mb-5 flex items-center justify-between border-b pb-3">
          <div className="text-dracula-purple flex items-center gap-2">
            <Sparkles size={22} className="animate-spin-slow" />
            <h2 className="text-dracula-light text-lg font-black tracking-wider uppercase">
              Crear Nuevo Grupo
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-dracula-gray hover:text-dracula-light rounded-lg p-1 transition-colors"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre del Grupo */}
          <div>
            <label
              htmlFor="create-group-name"
              className="text-dracula-gray mb-1 block text-xs font-bold tracking-wider uppercase"
            >
              Nombre del Grupo *
            </label>
            <div className="relative">
              <Users
                size={18}
                className="text-dracula-gray absolute top-1/2 left-3 -translate-y-1/2"
              />
              <input
                id="create-group-name"
                name="groupName"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del grupo o evento"
                className="bg-dracula-base border-dracula-gray/30 text-dracula-light placeholder-dracula-gray/50 focus:border-dracula-purple w-full rounded-xl border py-2.5 pr-3 pl-10 text-base transition-all focus:outline-none"
              />
            </div>
          </div>

          {/* Descripción opcional */}
          <div>
            <label
              htmlFor="create-group-desc"
              className="text-dracula-gray mb-1 block text-xs font-bold tracking-wider uppercase"
            >
              Descripción (Opcional)
            </label>
            <textarea
              id="create-group-desc"
              name="groupDescription"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción o normas del grupo (opcional)..."
              rows={2}
              className="bg-dracula-base border-dracula-gray/30 text-dracula-light placeholder-dracula-gray/50 focus:border-dracula-purple w-full resize-none rounded-xl border p-3 text-base transition-all focus:outline-none"
            />
          </div>

          {/* Selector de Foto / Logo desde la Galería */}
          <div>
            <label className="text-dracula-gray mb-1.5 block text-xs font-bold tracking-wider uppercase">
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
              <div className="bg-dracula-base border-dracula-purple/40 relative flex items-center gap-3 rounded-xl border p-3">
                <img
                  src={imagePreview}
                  alt="Previsualización del logo"
                  className="border-dracula-purple h-14 w-14 rounded-xl border object-cover shadow"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-dracula-light block truncate text-xs font-bold">
                    {selectedImage?.name}
                  </span>
                  <span className="text-dracula-green text-[10px] font-semibold">
                    Foto lista para subir
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  className="text-dracula-red hover:bg-dracula-red/10 btn-press rounded-lg p-2 transition-colors"
                  aria-label="Quitar foto"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-dracula-base border-dracula-gray/40 hover:border-dracula-purple/60 text-dracula-gray hover:text-dracula-light group btn-press flex w-full items-center justify-center gap-2.5 rounded-xl border border-dashed p-3.5 text-xs font-bold transition-all"
              >
                <Camera
                  size={18}
                  className="text-dracula-purple transition-transform group-hover:scale-110"
                />
                <span>Seleccionar foto del grupo</span>
              </button>
            )}
          </div>

          {/* Saldo Inicial de QuestCoins */}
          <div>
            <label
              htmlFor="create-group-balance"
              className="text-dracula-gray mb-1 block text-xs font-bold tracking-wider uppercase"
            >
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
              className="bg-dracula-base border-dracula-gray/30 text-dracula-light placeholder-dracula-gray/50 focus:border-dracula-yellow w-full rounded-xl border py-2.5 pr-3 pl-10 text-base transition-all focus:outline-none"
            />
            <p className="text-dracula-gray mt-1 text-[10px]">
              Fondo inicial que recibirás tú y cada nuevo participante al unirse
              al grupo.
            </p>
          </div>

          {/* Toggle de Contraseña de Acceso */}
          <div className="pt-2">
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={hasPassword}
                onChange={(e) => setHasPassword(e.target.checked)}
                className="border-dracula-gray/40 text-dracula-purple focus:ring-dracula-purple/30 bg-dracula-base h-4 w-4 rounded"
              />
              <span className="text-dracula-light flex items-center gap-1.5 text-xs font-bold">
                <Lock size={14} className="text-dracula-yellow" />
                Proteger con contraseña
              </span>
            </label>

            {hasPassword && (
              <div className="animate-fade-in mt-2.5">
                <input
                  id="create-group-password"
                  name="groupPassword"
                  type="password"
                  autoComplete="new-password"
                  aria-label="Contraseña del grupo"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña del grupo"
                  className="bg-dracula-base border-dracula-yellow/50 text-dracula-light placeholder-dracula-gray/50 focus:border-dracula-yellow w-full rounded-xl border px-3 py-2 text-base transition-all focus:outline-none"
                />
                <p className="text-dracula-gray mt-1 text-[10px]">
                  Los participantes deberán introducir este código además del
                  enlace de invitación.
                </p>
              </div>
            )}
          </div>

          {/* Acciones del formulario */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="border-dracula-gray/30 text-dracula-gray hover:bg-dracula-base btn-press flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="from-dracula-purple text-dracula-base btn-press flex-1 rounded-xl bg-gradient-to-r to-[#ff79c6] px-4 py-2.5 text-sm font-black tracking-wider uppercase shadow-[0_0_15px_rgba(189,147,249,0.3)] transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? 'Creando...' : 'Crear Grupo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
