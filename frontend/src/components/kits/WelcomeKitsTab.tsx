'use client';

/**
 * ============================================================================
 * PESTAÑA PRINCIPAL DE KITS EN EL HUB (WelcomeKitsTab)
 * ============================================================================
 * Orquesta la experiencia de navegación del catálogo de Kits de Eventos:
 * 1. Cabecera con título, subtítulo y botón de acción rápida `+ Crear Kit`.
 * 2. Tres sub-pestañas de catálogo: 'Oficiales', 'Comunidad' y 'Mis Kits'.
 * 3. Herramientas de descubrimiento: Barra de búsqueda y carrusel de categorías.
 * 4. Rejilla de tarjetas interactivas adaptadas a pantallas táctiles (KitCard).
 * 5. Integración con el asistente de inyección inline y modales de autoría.
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  X,
  PackageOpen,
  Compass,
  User,
} from 'lucide-react';

import { KitEventoResponse, GroupMembership } from '@/types';
import { fetchKits, deleteKit } from '@/services/kitsService';
import KitCard from './KitCard';
import CreateKitModal from './CreateKitModal';
import KitPreviewAndInjectModal from './KitPreviewAndInjectModal';
import ReportKitModal from './ReportKitModal';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/errorHandler';

interface WelcomeKitsTabProps {
  groups: GroupMembership[];
  currentUserId?: number;
  isGlobalAdmin?: boolean;
  preselectedGroupId?: number;
}

const CATEGORIAS_FILTRO = ['Todos', 'Fiesta', 'Viajes', 'Deporte', 'Chill'];

export default function WelcomeKitsTab({
  groups,
  currentUserId,
  isGlobalAdmin = false,
  preselectedGroupId,
}: WelcomeKitsTabProps) {
  // 1. Sub-pestañas de catálogo
  const [activeCatalogTab, setActiveCatalogTab] = useState<
    'oficial' | 'comunidad' | 'mis-kits'
  >('oficial');

  // 2. Herramientas de descubrimiento
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  // 3. Catálogo cargado y estados de red
  const [kits, setKits] = useState<KitEventoResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // 4. Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [kitToEdit, setKitToEdit] = useState<KitEventoResponse | null>(null);
  const [injectKitTarget, setInjectKitTarget] = useState<KitEventoResponse | null>(null);
  const [reportKitId, setReportKitId] = useState<number | null>(null);

  // Filtramos los grupos donde el usuario ostenta el rango 'admin'
  const adminGroups = groups.filter((g) => g.rol === 'admin');

  /**
   * Carga los kits desde la API con los filtros aplicados.
   */
  const loadKits = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchKits({
        tipo: activeCatalogTab,
        categoria: selectedCategory !== 'Todos' ? selectedCategory : undefined,
        query: searchQuery.trim() || undefined,
      });
      setKits(data);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Error al cargar el catálogo de kits'));
    } finally {
      setLoading(false);
    }
  }, [activeCatalogTab, selectedCategory, searchQuery]);

  useEffect(() => {
    loadKits();
  }, [loadKits]);

  /**
   * Gestión de borrado de kits propios con confirmación de seguridad.
   */
  const handleDeleteKit = async (kitId: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este kit del catálogo?')) {
      return;
    }
    try {
      await deleteKit(kitId);
      toast.success('Kit eliminado del catálogo');
      setKits((prev) => prev.filter((k) => k.id !== kitId));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Error al eliminar el kit'));
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {/* 1. Cabecera y Acción Primaria */}
      <div className="bg-dracula-card/80 border-dracula-gray/20 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-dracula-light text-lg font-black tracking-wide">
              Kits de Eventos
            </h2>
            <span className="bg-dracula-purple/20 text-dracula-purple border-dracula-purple/30 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase">
              Plantillas
            </span>
          </div>
          <p className="text-dracula-gray text-xs">
            Plantillas preparadas para encender tu comunidad en segundos
          </p>
        </div>

        <button
          onClick={() => {
            setKitToEdit(null);
            setIsCreateOpen(true);
          }}
          className="btn-press bg-gradient-to-r from-dracula-purple to-[#ff79c6] text-dracula-base flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-black shadow-lg transition-all"
        >
          <Plus size={16} />
          <span>+ Crear Kit</span>
        </button>
      </div>

      {/* 2. Sub-pestañas de Catálogo (Oficiales, Comunidad, Mis Kits) */}
      <div className="bg-dracula-card/80 border-dracula-gray/20 flex rounded-xl border p-1">
        <button
          onClick={() => setActiveCatalogTab('oficial')}
          className={`btn-press flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
            activeCatalogTab === 'oficial'
              ? 'bg-dracula-purple text-dracula-base shadow-md'
              : 'text-dracula-gray hover:text-dracula-light'
          }`}
        >
          <Sparkles size={14} />
          <span>Oficiales</span>
        </button>

        <button
          onClick={() => setActiveCatalogTab('comunidad')}
          className={`btn-press flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
            activeCatalogTab === 'comunidad'
              ? 'bg-dracula-purple text-dracula-base shadow-md'
              : 'text-dracula-gray hover:text-dracula-light'
          }`}
        >
          <Compass size={14} />
          <span>Comunidad</span>
        </button>

        <button
          onClick={() => setActiveCatalogTab('mis-kits')}
          className={`btn-press flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
            activeCatalogTab === 'mis-kits'
              ? 'bg-dracula-purple text-dracula-base shadow-md'
              : 'text-dracula-gray hover:text-dracula-light'
          }`}
        >
          <User size={14} />
          <span>Mis Kits</span>
        </button>
      </div>

      {/* 3. Herramientas de Descubrimiento: Buscador y Categorías */}
      <div className="space-y-3">
        {/* Barra de Búsqueda */}
        <div className="relative">
          <Search
            size={16}
            className="text-dracula-gray absolute top-1/2 left-3.5 -translate-y-1/2"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, reto o categoría..."
            className="bg-dracula-card border-dracula-gray/30 text-dracula-light placeholder:text-dracula-gray/50 focus:border-dracula-purple w-full rounded-xl border py-2.5 pr-9 pl-9 text-xs font-medium focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-dracula-gray hover:text-dracula-light absolute top-1/2 right-3 -translate-y-1/2 p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Carrusel Deslizable de Categorías */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORIAS_FILTRO.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`btn-press shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedCategory === cat
                  ? 'bg-dracula-purple text-dracula-base shadow-sm'
                  : 'bg-dracula-card border-dracula-gray/20 text-dracula-gray hover:text-dracula-light border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Listado de Tarjetas de Kits */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2.5 py-12">
          <div className="border-dracula-purple h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          <span className="text-dracula-gray text-xs font-bold">
            Explorando plantillas de eventos...
          </span>
        </div>
      ) : kits.length === 0 ? (
        <div className="bg-dracula-card/60 border-dracula-gray/20 flex flex-col items-center justify-center rounded-2xl border p-8 text-center">
          <div className="bg-dracula-base text-dracula-gray mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner">
            <PackageOpen size={28} />
          </div>
          <h3 className="text-dracula-light mb-1 text-sm font-black">
            No se encontraron kits
          </h3>
          <p className="text-dracula-gray mb-4 max-w-xs text-xs leading-relaxed">
            {activeCatalogTab === 'mis-kits'
              ? 'Aún no has creado ningún kit. Diseña uno propio o guarda los retos de una comunidad.'
              : 'No hay kits que coincidan con los filtros o la búsqueda seleccionada.'}
          </p>

          <button
            onClick={() => {
              setKitToEdit(null);
              setIsCreateOpen(true);
            }}
            className="btn-press bg-dracula-purple text-dracula-base rounded-xl px-4 py-2 text-xs font-black"
          >
            + Crear Mi Primer Kit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {kits.map((kit) => (
            <KitCard
              key={kit.id}
              kit={kit}
              currentUserId={currentUserId}
              isGlobalAdmin={isGlobalAdmin}
              onUse={(targetKit) => setInjectKitTarget(targetKit)}
              onEdit={(targetKit) => {
                setKitToEdit(targetKit);
                setIsCreateOpen(true);
              }}
              onDelete={handleDeleteKit}
              onReport={(kitId) => setReportKitId(kitId)}
            />
          ))}
        </div>
      )}

      {/* 5. Modales Coordinados */}
      {isCreateOpen && (
        <CreateKitModal
          isOpen={isCreateOpen}
          onClose={() => {
            setIsCreateOpen(false);
            setKitToEdit(null);
          }}
          kitToEdit={kitToEdit}
          onSuccess={() => {
            loadKits();
          }}
        />
      )}

      {injectKitTarget && (
        <KitPreviewAndInjectModal
          isOpen={Boolean(injectKitTarget)}
          onClose={() => setInjectKitTarget(null)}
          kit={injectKitTarget}
          adminGroups={adminGroups}
          preselectedGroupId={preselectedGroupId}
          onInjected={() => {
            loadKits();
          }}
        />
      )}

      {reportKitId && (
        <ReportKitModal
          isOpen={Boolean(reportKitId)}
          onClose={() => setReportKitId(null)}
          kitId={reportKitId}
        />
      )}
    </div>
  );
}
