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
  X,
  Crown,
  Trash2,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useGroup } from '@/context/GroupContext';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { copyToClipboard } from '@/lib/clipboard';
import { getApiErrorMessage } from '@/lib/errorHandler';
import TokenAmountInput from '@/components/ui/TokenAmountInput';
import DeleteGroupModal from '@/components/groups/DeleteGroupModal';

/**
 * Representa la información de un participante del grupo devuelto por la API.
 */
interface GroupMember {
  usuario_id: number;
  username: string;
  avatar_url?: string | null;
  rol: 'admin' | 'member';
  saldo_grupo: number;
  fecha_union?: string;
  es_creador?: boolean;
}

/**
 * Pestaña de Ajustes del Grupo para el Panel de Administración.
 * Permite al administrador del grupo:
 * 1. Ver y actualizar los datos de la comunidad (nombre, descripción, foto, saldo inicial y contraseña).
 * 2. Visualizar y regenerar el código de invitación y QR exclusivo de administradores.
 * 3. Gestionar los roles de los miembros (delegar privilegios de admin o revocar a miembro).
 */
export default function TabGrupoSettings() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeGroup, refreshGroups } = useGroup();

  // Soberanía del Fundador: Determina si el usuario logueado es el fundador/creador del grupo activo
  const isCurrentUserCreator = Boolean(
    user && activeGroup?.creador_id && user.id === activeGroup.creador_id
  );

  const [nombre, setNombre] = useState(activeGroup?.nombre || '');
  const [descripcion, setDescripcion] = useState(activeGroup?.descripcion || '');
  // Permitimos '' mientras el usuario edita para evitar que aparezca un 0 residual ('0100')
  const [saldoInicial, setSaldoInicial] = useState<number | ''>(activeGroup?.saldo_inicial ?? 100);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(activeGroup?.avatar_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState('');
  // Sincronización inicial con el estado de protección del grupo activo
  const [hasPassword, setHasPassword] = useState(Boolean(activeGroup?.requiere_password));
  const [savingInfo, setSavingInfo] = useState(false);

  // Invitaciones
  const [inviteCode, setInviteCode] = useState(activeGroup?.codigo_invitacion || '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Miembros
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Modal de Eliminación de Grupo (Zona de Peligro)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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
      setSaldoInicial(activeGroup.saldo_inicial ?? 100);
      setImagePreview(activeGroup.avatar_url || null);
      setSelectedImage(null);
      // Sincronizamos el estado de la casilla y limpiamos el campo de clave tras recargas
      setHasPassword(Boolean(activeGroup.requiere_password));
      setPassword('');
      fetchInviteAndMembers();
    }
  }, [activeGroup?.id, activeGroup?.saldo_inicial, activeGroup?.requiere_password]);

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

      const payload: Record<string, any> = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        saldo_inicial: saldoInicial === '' ? (activeGroup?.saldo_inicial ?? 100) : Math.max(0, Math.min(10000, Number(saldoInicial))),
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
      await refreshGroups();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Error al actualizar grupo'));
    } finally {
      setSavingInfo(false);
    }
  };

  const handleToggleMemberRole = async (memberUserId: number, currentRole: string) => {
    // Soberanía del Fundador: Solo el creador del grupo tiene potestad para delegar o revocar roles
    if (!isCurrentUserCreator) {
      toast.error('Solo el creador del grupo tiene permisos para cambiar los roles de los miembros.');
      return;
    }

    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const actionText = newRole === 'admin' ? 'ascender a Administrador' : 'revertir a Miembro normal';

    if (!confirm(`¿Seguro que deseas ${actionText} a este usuario?`)) return;

    try {
      await api.patch(`/api/groups/${activeGroup.id}/members/${memberUserId}/role`, {
        rol: newRole,
        nuevo_rol: newRole,
      });
      toast.success(`Rol actualizado a: ${newRole === 'admin' ? 'Administrador' : 'Miembro'}`);
      await fetchInviteAndMembers();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo cambiar el rol'));
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

          {/* Foto del Grupo desde la Galería */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-dracula-gray mb-1.5">
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
                    Cambiar foto del grupo
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
                <span>Seleccionar foto del grupo</span>
              </button>
            )}
          </div>

          {/* Saldo Inicial para Nuevos Miembros */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-dracula-gray mb-1">
              Saldo inicial para nuevos miembros
            </label>
            <TokenAmountInput
              min={0}
              max={10000}
              value={saldoInicial}
              onChange={setSaldoInicial}
              placeholder="100"
              className="w-full bg-dracula-base border border-dracula-gray/30 rounded-xl py-2 pl-9 pr-3 text-sm text-dracula-light focus:outline-none focus:border-dracula-yellow transition-all"
            />
            <p className="text-[10px] text-dracula-gray mt-1">
              Cantidad de QuestCoins asignadas automáticamente a los futuros miembros que se unan al grupo.
            </p>
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasPassword}
                onChange={(e) => {
                  setHasPassword(e.target.checked);
                  if (!e.target.checked) {
                    setPassword('');
                  }
                }}
                className="rounded text-dracula-purple focus:ring-dracula-purple bg-dracula-base w-4 h-4"
              />
              <span className="text-xs font-bold text-dracula-light flex items-center gap-1">
                <Lock size={14} className="text-dracula-yellow" />
                Proteger con contraseña
              </span>
            </label>

            {hasPassword && (
              <div className="mt-2 space-y-2 animate-fade-in">
                {activeGroup.requiere_password ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-2.5 py-1.5 rounded-xl">
                    <ShieldCheck size={14} className="shrink-0 text-emerald-400" />
                    <span>Este grupo ya cuenta con contraseña activa. Deja el campo vacío para conservarla o escribe una nueva para cambiarla.</span>
                  </div>
                ) : (
                  <p className="text-[10px] text-dracula-gray">
                    Los participantes deberán introducir esta clave secreta para poder unirse al grupo.
                  </p>
                )}

                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    activeGroup.requiere_password
                      ? "Nueva clave (dejar en blanco para mantener la actual)"
                      : "Introduce la clave secreta del grupo"
                  }
                  className="w-full bg-dracula-base border border-dracula-yellow/40 rounded-xl p-2.5 text-sm text-dracula-light focus:outline-none focus:border-dracula-yellow"
                />
              </div>
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
        <div className="flex items-center gap-2 pb-3 border-b border-dracula-gray/20 mb-4 text-dracula-purple font-black text-sm uppercase tracking-wider">
          <KeyRound size={18} />
          <span>Enlace de Invitación</span>
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
            {members.map((m) => {
              const isTargetCreator = Boolean(
                m.es_creador || (activeGroup?.creador_id && m.usuario_id === activeGroup.creador_id)
              );

              return (
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
                    {/* Badge distintivo de Creador / Fundador */}
                    {isTargetCreator && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                        <Crown size={11} className="text-amber-400" />
                        <span>Creador</span>
                      </span>
                    )}

                    {/* Badge de Rol actual */}
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        m.rol === 'admin'
                          ? 'bg-dracula-purple/20 text-dracula-purple border border-dracula-purple/40'
                          : 'bg-dracula-gray/10 text-dracula-gray'
                      }`}
                    >
                      {m.rol}
                    </span>

                    {/* Botón de Gestión de Rol (Soberanía Exclusiva del Fundador) */}
                    {!isCurrentUserCreator ? (
                      <button
                        type="button"
                        disabled
                        className="p-1.5 bg-dracula-card/40 border border-dracula-gray/20 text-dracula-gray/40 rounded-lg text-[10px] font-bold cursor-not-allowed"
                        title="Solo el creador del grupo puede gestionar los roles de los miembros"
                        aria-label="Solo el creador del grupo puede gestionar los roles de los miembros"
                      >
                        <Lock size={14} />
                      </button>
                    ) : isTargetCreator ? (
                      <button
                        type="button"
                        disabled
                        className="p-1.5 bg-dracula-card/40 border border-dracula-gray/20 text-dracula-gray/40 rounded-lg text-[10px] font-bold cursor-not-allowed"
                        title="El creador del grupo no puede ser desasignado como administrador"
                        aria-label="El creador del grupo no puede ser desasignado como administrador"
                      >
                        <Lock size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleMemberRole(m.usuario_id, m.rol)}
                        className={`p-1.5 bg-dracula-card hover:bg-dracula-base border rounded-lg text-[10px] font-bold transition-colors ${
                          m.rol === 'admin'
                            ? 'border-dracula-red/30 text-dracula-red hover:text-dracula-red/80'
                            : 'border-dracula-gray/30 text-dracula-gray hover:text-dracula-light'
                        }`}
                        title={m.rol === 'admin' ? 'Revocar rol de administrador' : 'Ascender a Administrador'}
                        aria-label={m.rol === 'admin' ? 'Revocar rol de administrador' : 'Ascender a Administrador'}
                      >
                        <UserCheck size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sección 4: Zona de Peligro (Soberanía Exclusiva del Creador / Fundador) */}
      {isCurrentUserCreator && (
        <div className="bg-dracula-card border border-dracula-red/40 rounded-2xl p-5 shadow-xl space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 text-dracula-red font-black text-sm uppercase tracking-wider pb-2 border-b border-dracula-gray/20">
            <AlertTriangle size={18} />
            <span>Zona de Peligro</span>
          </div>

          <p className="text-xs text-dracula-gray leading-relaxed">
            La eliminación de la comunidad destruye de forma permanente e irreversible todas las publicaciones,
            retos, apuestas, duelos y saldos de QuestCoins de todos los participantes. Esta acción no se puede deshacer.
          </p>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="w-full py-2.5 px-4 bg-dracula-red/10 border border-dracula-red hover:bg-dracula-red text-dracula-red hover:text-dracula-base font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-md btn-press"
          >
            <Trash2 size={16} />
            <span>Eliminar este Grupo Definitivamente</span>
          </button>
        </div>
      )}

      {/* Modal de confirmación obligatoria mediante nombre exacto */}
      {activeGroup && (
        <DeleteGroupModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          groupId={activeGroup.id}
          groupName={activeGroup.nombre}
          onSuccess={() => {
            router.replace('/groups');
          }}
        />
      )}
    </div>
  );
}
