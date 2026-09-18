'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  KeyRound,
  Lock,
  Copy,
  Check,
  RefreshCw,
  Edit,
  Save,
  UserCheck,
  Camera,
  X
} from 'lucide-react';
import { useGroup } from '@/context/GroupContext';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

/**
 * Pestaña de Ajustes del Grupo para el Panel de Administración.
 * Permite al administrador del grupo:
 * 1. Ver y actualizar los datos de la comunidad (nombre, descripción, contraseña).
 * 2. Visualizar y regenerar el código de invitación y QR exclusivo de administradores.
 * 3. Gestionar los roles de los miembros (delegar privilegios de admin o revocar a miembro).
 */
export default function TabGrupoSettings() {
  const { activeGroup, refreshGroups } = useGroup();

  const [nombre, setNombre] = useState(activeGroup?.nombre || '');
  const [descripcion, setDescripcion] = useState(activeGroup?.descripcion || '');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(activeGroup?.avatar_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  // Invitaciones
  const [inviteCode, setInviteCode] = useState(activeGroup?.codigo_invitacion || '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Miembros
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const fetchInviteAndMembers = async () => {
    if (!activeGroup) return;
    try {
      setLoadingMembers(true);
      const [inviteRes, membersRes] = await Promise.all([
        api.get(`/api/groups/${activeGroup.id}/invite`),
        api.get(`/api/groups/${activeGroup.id}/members`),
      ]);
      setInviteCode(inviteRes.data.codigo_invitacion);
      setMembers(membersRes.data || []);
    } catch (error) {
      console.error('[TabGrupoSettings] Error al cargar datos del grupo:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (activeGroup) {
      setNombre(activeGroup.nombre);
      setDescripcion(activeGroup.descripcion || '');
      setImagePreview(activeGroup.avatar_url || null);
      setSelectedImage(null);
      fetchInviteAndMembers();
    }
  }, [activeGroup?.id]);

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
    if (imagePreview && imagePreview !== activeGroup?.avatar_url) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(activeGroup?.avatar_url || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!activeGroup) {
    return (
      <div className="p-8 text-center text-dracula-gray text-xs">
        No hay ningún grupo activo seleccionado.
      </div>
    );
  }

  const joinUrl = typeof window !== 'undefined' && inviteCode 
    ? `${window.location.origin}/join/${inviteCode}` 
    : '';

  const qrApiUrl = inviteCode 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinUrl)}&bgcolor=1e1f29&color=bd93f9&margin=10`
    : '';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    toast.success('¡Código de invitación copiado!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    toast.success('¡Enlace directo copiado!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!confirm('¿Deseas invalidar el código actual y generar uno nuevo?')) return;
    try {
      setRegenerating(true);
      const res = await api.post(`/api/groups/${activeGroup.id}/regenerate-code`);
      setInviteCode(res.data.codigo_invitacion);
      toast.success('Nuevo código generado con éxito');
      await refreshGroups();
    } catch {
      toast.error('Error al regenerar código');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveGroupInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error('El nombre no puede estar vacío');
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

      const payload: Record<string, any> = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
      };
      if (icono_url) {
        payload.icono_url = icono_url;
      }
      if (hasPassword && password.trim()) {
        payload.password = password.trim();
      }

      await api.patch(`/api/groups/${activeGroup.id}`, payload);
      toast.success('Información del grupo actualizada correctamente');
      setSelectedImage(null);
      await refreshGroups();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Error al actualizar grupo');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleToggleMemberRole = async (memberUserId: number, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const actionText = newRole === 'admin' ? 'ascender a Administrador' : 'revertir a Miembro normal';

    if (!confirm(`¿Seguro que deseas ${actionText} a este usuario?`)) return;

    try {
      await api.patch(`/api/groups/${activeGroup.id}/members/${memberUserId}/role`, {
        nuevo_rol: newRole,
      });
      toast.success(`Rol actualizado a: ${newRole}`);
      await fetchInviteAndMembers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'No se pudo cambiar el rol');
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-12 animate-fade-in">
      {/* Sección 1: Información del Grupo */}
      <div className="bg-dracula-card border border-dracula-gray/20 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 text-dracula-purple font-black text-sm uppercase tracking-wider mb-4 pb-2 border-b border-dracula-gray/20">
          <Edit size={18} />
          <span>Configuración de {activeGroup.nombre}</span>
        </div>

        <form onSubmit={handleSaveGroupInfo} className="space-y-3.5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-dracula-gray mb-1">
              Nombre del Grupo *
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full bg-dracula-base border border-dracula-gray/30 rounded-xl p-2.5 text-sm text-dracula-light focus:outline-none focus:border-dracula-purple"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-dracula-gray mb-1">
              Descripción
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full bg-dracula-base border border-dracula-gray/30 rounded-xl p-2.5 text-sm text-dracula-light focus:outline-none focus:border-dracula-purple resize-none"
            />
          </div>

          {/* Logo o Foto del Grupo desde la Galería */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-dracula-gray mb-1.5">
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
              <div className="flex items-center gap-3 p-3 bg-dracula-base border border-dracula-purple/30 rounded-xl">
                <img
                  src={imagePreview}
                  alt="Logo del grupo"
                  className="w-14 h-14 rounded-xl object-cover border border-dracula-purple shadow"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-dracula-light block truncate">
                    {selectedImage ? selectedImage.name : 'Foto actual del grupo'}
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] text-dracula-purple font-bold hover:underline mt-0.5 block"
                  >
                    Cambiar imagen de galería
                  </button>
                </div>
                {selectedImage && (
                  <button
                    type="button"
                    onClick={removeSelectedImage}
                    className="p-1.5 text-dracula-red hover:bg-dracula-red/10 rounded-lg transition-colors"
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
                className="w-full flex items-center justify-center gap-2 p-3 bg-dracula-base border border-dashed border-dracula-gray/40 hover:border-dracula-purple/60 rounded-xl text-xs font-bold text-dracula-gray hover:text-dracula-light transition-all group"
              >
                <Camera size={16} className="text-dracula-purple group-hover:scale-110 transition-transform" />
                <span>Elegir foto del grupo desde el carrete o galería</span>
              </button>
            )}
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasPassword}
                onChange={(e) => setHasPassword(e.target.checked)}
                className="rounded text-dracula-purple focus:ring-dracula-purple bg-dracula-base w-4 h-4"
              />
              <span className="text-xs font-bold text-dracula-light flex items-center gap-1">
                <Lock size={14} className="text-dracula-yellow" />
                Actualizar contraseña de acceso
              </span>
            </label>

            {hasPassword && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nueva clave secreta del grupo"
                className="w-full mt-2 bg-dracula-base border border-dracula-yellow/40 rounded-xl p-2.5 text-sm text-dracula-light focus:outline-none focus:border-dracula-yellow"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={savingInfo}
            className="w-full py-2.5 px-4 bg-dracula-purple text-dracula-base font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
          >
            <Save size={16} />
            <span>{savingInfo ? 'Guardando...' : 'Guardar Cambios del Grupo'}</span>
          </button>
        </form>
      </div>

      {/* Sección 2: Invitaciones (Solo Administrador) */}
      <div className="bg-dracula-card border border-dracula-purple/30 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-dracula-gray/20 mb-4">
          <div className="flex items-center gap-2 text-dracula-purple font-black text-sm uppercase tracking-wider">
            <KeyRound size={18} />
            <span>Credenciales de Invitación</span>
          </div>
          <span className="text-[9px] font-black uppercase text-dracula-purple bg-dracula-purple/20 px-2 py-0.5 rounded-full border border-dracula-purple/40">
            Exclusivo Admin
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 bg-dracula-base/70 p-4 rounded-xl border border-dracula-gray/20 mb-4">
          {qrApiUrl && (
            <img
              src={qrApiUrl}
              alt="QR Invitación"
              className="w-32 h-32 rounded-lg border border-dracula-purple/40 shadow shrink-0"
            />
          )}

          <div className="space-y-3 flex-1 w-full">
            <div>
              <span className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest block mb-1">
                Código para compartir
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-lg font-black text-dracula-purple bg-dracula-card p-2 rounded-xl text-center border border-dracula-gray/20">
                  {inviteCode}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="p-2.5 bg-dracula-purple text-dracula-base rounded-xl font-bold hover:opacity-90"
                  aria-label="Copiar código"
                >
                  {copiedCode ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-dracula-gray uppercase tracking-widest block mb-1">
                Enlace directo
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={joinUrl}
                  className="flex-1 bg-dracula-card border border-dracula-gray/30 p-2 rounded-xl text-xs text-dracula-gray truncate focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="p-2 bg-dracula-card hover:bg-dracula-base border border-dracula-gray/30 text-dracula-light rounded-xl"
                  aria-label="Copiar enlace"
                >
                  {copiedLink ? <Check size={16} className="text-dracula-green" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="text-xs text-dracula-red hover:underline flex items-center gap-1.5 font-bold"
        >
          <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
          <span>Regenerar código de invitación (revoca el anterior)</span>
        </button>
      </div>

      {/* Sección 3: Miembros de la Comunidad */}
      <div className="bg-dracula-card border border-dracula-gray/20 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 text-dracula-cyan font-black text-sm uppercase tracking-wider mb-4 pb-2 border-b border-dracula-gray/20">
          <Users size={18} />
          <span>Miembros del Grupo ({members.length})</span>
        </div>

        {loadingMembers ? (
          <div className="py-8 text-center text-xs text-dracula-gray">Cargando miembros...</div>
        ) : members.length === 0 ? (
          <div className="py-6 text-center text-xs text-dracula-gray">No hay participantes registrados.</div>
        ) : (
          <div className="space-y-2.5">
            {members.map((m) => (
              <div
                key={m.usuario_id}
                className="bg-dracula-base/70 border border-dracula-gray/20 rounded-xl p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-dracula-purple to-[#ff79c6] flex items-center justify-center text-xs font-black text-dracula-base shrink-0">
                    {m.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-dracula-light truncate block">
                      @{m.username}
                    </span>
                    <span className="text-[10px] text-dracula-yellow font-bold">
                      {m.saldo_grupo} QuestCoins
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      m.rol === 'admin'
                        ? 'bg-dracula-purple/20 text-dracula-purple border border-dracula-purple/40'
                        : 'bg-dracula-gray/10 text-dracula-gray'
                    }`}
                  >
                    {m.rol}
                  </span>

                  <button
                    onClick={() => handleToggleMemberRole(m.usuario_id, m.rol)}
                    className="p-1.5 bg-dracula-card hover:bg-dracula-base border border-dracula-gray/30 text-dracula-gray hover:text-dracula-light rounded-lg text-[10px] font-bold transition-colors"
                    title={m.rol === 'admin' ? 'Degradar a miembro' : 'Hacer administrador'}
                  >
                    <UserCheck size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
