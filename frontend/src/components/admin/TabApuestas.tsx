'use client';

import { useState, useEffect } from 'react';
import { Check, X, Trophy, CheckCircle2, ThumbsUp, ThumbsDown, Trash, Pencil, Plus } from 'lucide-react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export default function TabApuestas() {
  const [activeTab, setActiveTab] = useState<'sugerencias' | 'mercado'>('sugerencias');
  const [bets, setBets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States for editing a bet
  const [editingBetId, setEditingBetId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{ title: string, options: {text: string, multiplier: number}[] }>({ title: '', options: [] });

  // States for resolving a bet
  const [resolvingBetId, setResolvingBetId] = useState<string | null>(null);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string>('');

  const fetchBets = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/apuestas/');
      setBets(res.data);
    } catch {
      toast.error('Error al cargar apuestas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBets();
  }, []);

  const handleStatusUpdate = async (betId: string, estado: string, opcion_ganadora_id?: string) => {
    const promise = api.patch(`/api/admin/bets/${betId}/status`, {
      estado,
      opcion_ganadora_id
    });

    toast.promise(promise, {
      loading: 'Procesando...',
      success: 'Acción completada con éxito',
      error: 'Error al actualizar apuesta',
    });

    try {
      await promise;
      if (resolvingBetId === betId) {
        setResolvingBetId(null);
        setSelectedWinnerId('');
      }
      fetchBets();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditInit = (bet: any) => {
    setEditingBetId(bet.id);
    const optionsArray = bet.options ? bet.options.map((opt: any) => ({ text: opt.text, multiplier: parseFloat(opt.multiplier) })) : [];
    setEditFormData({ title: bet.title, options: optionsArray });
  };

  const handleEditSave = async (betId: string) => {
    // Filtrar opciones en blanco
    const validOptions = editFormData.options.filter(opt => opt.text.trim() !== '' && opt.multiplier > 1.0);
    if (validOptions.length < 2) {
      toast.error("Debe haber al menos 2 opciones válidas (multiplicador > 1)");
      return;
    }
    if (editFormData.title.trim().length < 5) {
      toast.error("El título debe tener al menos 5 caracteres");
      return;
    }

    const promise = api.put(`/api/admin/bets/${betId}`, {
      title: editFormData.title,
      options: validOptions
    });

    toast.promise(promise, {
      loading: 'Guardando...',
      success: 'Apuesta editada con éxito',
      error: 'Error al editar apuesta'
    });

    try {
      await promise;
      setEditingBetId(null);
      fetchBets();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBet = async (id: string) => {
    const promise = api.delete('/api/apuestas/' + id);
    toast.promise(promise, {
      loading: 'Borrando apuesta...',
      success: 'Apuesta eliminada',
      error: 'Error al borrar apuesta'
    });
    try {
      await promise;
      fetchBets();
    } catch (e) {
      console.error(e);
    }
  };

  const propuestas = bets.filter(b => b.estado === 'propuesta');
  const abiertas = bets.filter(b => b.estado === 'abierta');

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-20">
      {/* Pestañas internas */}
      <div className="flex border-b border-dracula-gray/20">
        <button
          onClick={() => setActiveTab('sugerencias')}
          className={`flex-1 py-3 text-sm font-bold transition-colors relative ${
            activeTab === 'sugerencias' ? 'text-[#ffb86c]' : 'text-dracula-gray hover:text-dracula-light'
          }`}
        >
          Sugerencias
          {propuestas.length > 0 && (
            <span className="ml-2 bg-[#ffb86c] text-dracula-base px-1.5 py-0.5 rounded-full text-[10px]">
              {propuestas.length}
            </span>
          )}
          {activeTab === 'sugerencias' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#ffb86c]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('mercado')}
          className={`flex-1 py-3 text-sm font-bold transition-colors relative ${
            activeTab === 'mercado' ? 'text-dracula-yellow' : 'text-dracula-gray hover:text-dracula-light'
          }`}
        >
          Mercado Activo
          {abiertas.length > 0 && (
            <span className="ml-2 bg-dracula-yellow text-dracula-base px-1.5 py-0.5 rounded-full text-[10px]">
              {abiertas.length}
            </span>
          )}
          {activeTab === 'mercado' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-dracula-yellow" />
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-dracula-gray">Cargando apuestas...</div>
      ) : (
        <div className="flex flex-col gap-4">
          {activeTab === 'sugerencias' && (
            <>
              {propuestas.length === 0 ? (
                <div className="text-center py-10 text-dracula-gray text-sm">No hay sugerencias pendientes</div>
              ) : (
                propuestas.map(bet => (
                  <article key={bet.id} className="bg-dracula-card border border-dracula-gray/20 p-4 rounded-xl shadow-md">
                    {editingBetId === bet.id ? (
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="text-[10px] text-dracula-gray uppercase tracking-widest font-bold mb-1 block">Título de la Apuesta</label>
                          <input 
                            type="text" 
                            className="w-full bg-dracula-base border border-dracula-gray/20 text-dracula-light text-sm rounded-lg p-2.5 focus:outline-none focus:border-dracula-purple"
                            value={editFormData.title}
                            onChange={(e) => setEditFormData({...editFormData, title: e.target.value})}
                          />
                        </div>
                        
                        <div className="bg-dracula-base p-3 rounded-lg border border-dracula-gray/10">
                          <div className="flex justify-between items-center mb-3">
                            <p className="text-[10px] text-dracula-gray uppercase tracking-widest font-bold">Opciones</p>
                            <button 
                              onClick={() => setEditFormData({...editFormData, options: [...editFormData.options, {text: '', multiplier: 1.5}]})}
                              className="text-[10px] bg-dracula-purple/20 text-dracula-purple px-2 py-1 rounded hover:bg-dracula-purple/30 transition-colors flex items-center gap-1"
                            >
                              <Plus size={12} /> Añadir opción
                            </button>
                          </div>
                          
                          <ul className="flex flex-col gap-2">
                            {editFormData.options.map((opt, idx) => (
                              <li key={idx} className="flex gap-2 items-center">
                                <input 
                                  type="text" 
                                  placeholder="Texto de opción"
                                  className="flex-1 bg-dracula-card border border-dracula-gray/20 text-dracula-light text-xs rounded-lg p-2 focus:outline-none focus:border-dracula-purple"
                                  value={opt.text}
                                  onChange={(e) => {
                                    const newOpts = [...editFormData.options];
                                    newOpts[idx].text = e.target.value;
                                    setEditFormData({...editFormData, options: newOpts});
                                  }}
                                />
                                <div className="flex items-center bg-dracula-card border border-dracula-gray/20 rounded-lg overflow-hidden w-24">
                                  <span className="text-xs text-dracula-gray px-2 border-r border-dracula-gray/20">x</span>
                                  <input 
                                    type="number" 
                                    step="0.1"
                                    min="1.1"
                                    className="w-full bg-transparent text-[#ffb86c] text-xs p-2 focus:outline-none font-mono"
                                    value={opt.multiplier}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                      const newOpts = [...editFormData.options];
                                      newOpts[idx].multiplier = parseFloat(e.target.value) || 1.1;
                                      setEditFormData({...editFormData, options: newOpts});
                                    }}
                                  />
                                </div>
                                <button 
                                  onClick={() => {
                                    const newOpts = [...editFormData.options];
                                    newOpts.splice(idx, 1);
                                    setEditFormData({...editFormData, options: newOpts});
                                  }}
                                  className="p-2 text-dracula-red hover:bg-dracula-red/10 rounded-lg transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => setEditingBetId(null)}
                            className="flex-1 py-2 text-xs font-bold text-dracula-gray bg-dracula-base rounded-lg border border-dracula-gray/20 hover:bg-dracula-gray/10 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleEditSave(bet.id)}
                            className="flex-[2] py-2 text-xs font-bold bg-dracula-purple text-dracula-base rounded-lg flex items-center justify-center gap-1.5 transition-colors hover:opacity-90 shadow-md"
                          >
                            <CheckCircle2 size={14} /> Guardar Cambios
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col gap-1">
                            <h3 className="font-bold text-dracula-light text-base">{bet.title}</h3>
                            <div className="flex items-center gap-2 text-xs font-bold">
                              <span className="text-dracula-green flex items-center gap-1"><ThumbsUp size={12}/> {bet.upvotes || 0}</span>
                              <span className="text-dracula-gray">|</span>
                              <span className="text-dracula-red flex items-center gap-1"><ThumbsDown size={12}/> {bet.downvotes || 0}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleEditInit(bet)}
                              className="text-dracula-purple bg-dracula-purple/10 hover:bg-dracula-purple/20 p-1.5 rounded transition-colors"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <span className="text-[10px] uppercase font-bold text-dracula-purple bg-dracula-purple/10 px-2 py-1 rounded">
                              @{bet.creator}
                            </span>
                          </div>
                        </div>
                        
                        <div className="bg-dracula-base p-3 rounded-lg mb-4 border border-dracula-gray/10">
                          <p className="text-[10px] text-dracula-gray uppercase tracking-widest font-bold mb-2">Opciones propuestas</p>
                          <ul className="flex flex-col gap-1.5">
                            {bet.options?.map((opt: any) => (
                              <li key={opt.id} className="flex justify-between text-xs">
                                <span className="text-dracula-light">{opt.text}</span>
                                <span className="font-mono text-[#ffb86c]">x{opt.multiplier.toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex gap-3">
                          <button 
                            onClick={() => handleStatusUpdate(bet.id, 'abierta')}
                            className="flex-[2] bg-dracula-green/20 hover:bg-dracula-green/30 text-dracula-green border border-dracula-green/50 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Check size={16} /> Aprobar
                          </button>
                          <button 
                            onClick={() => handleStatusUpdate(bet.id, 'rechazada')}
                            className="flex-1 bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border border-dracula-red/30 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <X size={16} /> Rechazar
                          </button>
                          <button 
                            onClick={() => handleDeleteBet(bet.id)}
                            className="flex-none px-3 bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border border-dracula-red/30 py-2 rounded-lg font-bold flex items-center justify-center transition-colors"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))
              )}
            </>
          )}

          {activeTab === 'mercado' && (
            <>
              {abiertas.length === 0 ? (
                <div className="text-center py-10 text-dracula-gray text-sm">No hay apuestas activas en el mercado</div>
              ) : (
                abiertas.map(bet => (
                  <article key={bet.id} className="bg-dracula-card border border-dracula-gray/20 p-4 rounded-xl shadow-md">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-dracula-light text-base">{bet.title}</h3>
                    </div>

                    <div className="bg-dracula-base p-3 rounded-lg mb-4 border border-dracula-gray/10">
                      <ul className="flex flex-col gap-1.5">
                        {bet.options?.map((opt: any) => (
                          <li key={opt.id} className="flex justify-between text-xs">
                            <span className="text-dracula-light">{opt.text}</span>
                            <span className="font-mono text-dracula-yellow">x{opt.multiplier.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {resolvingBetId === bet.id ? (
                      <div className="border border-dracula-green/30 bg-dracula-green/5 p-3 rounded-xl animate-fadeIn">
                        <label className="text-[10px] font-bold text-dracula-green uppercase tracking-widest block mb-2">
                          Selecciona la opción ganadora
                        </label>
                        <select 
                          value={selectedWinnerId}
                          onChange={(e) => setSelectedWinnerId(e.target.value)}
                          className="w-full bg-dracula-base border border-dracula-gray/20 text-dracula-light text-sm rounded-lg p-2.5 mb-3 focus:outline-none focus:border-dracula-green"
                        >
                          <option value="">-- Elige un ganador --</option>
                          {bet.options?.map((opt: any) => (
                            <option key={opt.id} value={opt.id}>{opt.text}</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { setResolvingBetId(null); setSelectedWinnerId(''); }}
                            className="flex-1 py-2 text-xs font-bold text-dracula-gray bg-dracula-base rounded-lg border border-dracula-gray/20 hover:bg-dracula-gray/10 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button 
                            disabled={!selectedWinnerId}
                            onClick={() => handleStatusUpdate(bet.id, 'cerrada', selectedWinnerId)}
                            className={`flex-[2] py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                              selectedWinnerId 
                                ? 'bg-dracula-green text-dracula-base hover:opacity-90 shadow-md' 
                                : 'bg-dracula-base text-dracula-gray border border-dracula-gray/20 opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <CheckCircle2 size={14} /> Pagar Premios
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 w-full">
                        <button 
                          onClick={() => setResolvingBetId(bet.id)}
                          className="flex-1 bg-dracula-yellow/10 hover:bg-dracula-yellow/20 text-dracula-yellow border border-dracula-yellow/30 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                          <Trophy size={16} /> Resolver Ganador
                        </button>
                        <button 
                          onClick={() => handleDeleteBet(bet.id)}
                          className="flex-none px-4 bg-dracula-red/10 hover:bg-dracula-red/20 text-dracula-red border border-dracula-red/30 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
