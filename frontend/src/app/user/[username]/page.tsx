'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Target,
  Dice5,
  Swords,
  Coins,
  ChevronLeft,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  X
} from 'lucide-react';
import api from '@/lib/axios';
import PullToRefresh from '@/components/PullToRefresh';
import { formatSpanishDate } from '@/lib/formatters';

const isVideoUrl = (url: string) => {
  return url.match(/\.(mp4|webm|mov)$/i) || url.includes('/video/upload/');
};

type PublicProfile = {
  username: string;
  avatar_url: string | null;
  bio: string | null;
  saldo_actual: number;
  apuestas_acertadas: number;
  misiones_completadas: number;
  duelos_ganados: number;
};

type PostResponse = {
  id: number;
  type: string;
  author: string;
  author_avatar_url: string | null;
  time_ago: string;
  content: string;
  media_url: string | null;
  is_system: boolean;
};

type ApuestaResponse = {
  id: number;
  titulo: string;
  cantidad: number;
  resultado: string;
  fecha: string;
};

type MisionResponse = {
  id: number;
  titulo: string;
  recompensa: number;
  fecha_completada: string;
};

type DueloResponse = {
  id: number;
  retador: string;
  retado: string;
  juego: string;
  tokens_en_juego: number;
  estado: string;
  ganador: string | null;
  fecha: string;
};

export default function UserPublicProfile() {
  const { username } = useParams() as { username: string };
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'feed' | 'apuestas' | 'misiones' | 'duelos'>('feed');
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  
  const [feed, setFeed] = useState<PostResponse[]>([]);
  const [apuestas, setApuestas] = useState<ApuestaResponse[]>([]);
  const [misiones, setMisiones] = useState<MisionResponse[]>([]);
  const [duelos, setDuelos] = useState<DueloResponse[]>([]);
  
  const [apuestasFilter, setApuestasFilter] = useState<'todas' | 'ganadas' | 'perdidas'>('todas');
  const [duelosFilter, setDuelosFilter] = useState<'todos' | 'en curso' | 'terminados'>('todos');
  
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await api.get(`/api/users/public/${username}`);
      setProfile(res.data);
    } catch (error) {
      console.error('Error fetching public profile:', error);
    }
  };

  const fetchTabData = async (tab: string) => {
    try {
      if (tab === 'feed') {
        const res = await api.get(`/api/users/public/${username}/feed`);
        setFeed(res.data);
      } else if (tab === 'apuestas') {
        const res = await api.get(`/api/users/public/${username}/apuestas`);
        setApuestas(res.data);
      } else if (tab === 'misiones') {
        const res = await api.get(`/api/users/public/${username}/misiones`);
        setMisiones(res.data);
      } else if (tab === 'duelos') {
        const res = await api.get(`/api/users/public/${username}/duelos`);
        setDuelos(res.data);
      }
    } catch (error) {
      console.error(`Error fetching ${tab}:`, error);
    }
  };

  const fetchAll = async () => {
    setIsLoading(true);
    await fetchProfile();
    await fetchTabData(activeTab);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [username]);

  useEffect(() => {
    if (profile) {
      fetchTabData(activeTab);
    }
  }, [activeTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-dracula-base">
        <div className="w-10 h-10 border-4 border-dracula-purple border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm font-bold text-dracula-gray uppercase tracking-widest">Cargando...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-dracula-base text-dracula-light">
        <h2>Usuario no encontrado</h2>
        <button onClick={() => router.back()} className="text-dracula-purple underline">Volver</button>
      </div>
    );
  }

  const filteredApuestas = apuestas.filter(a => {
    if (apuestasFilter === 'ganadas') return a.resultado === 'Ganada';
    if (apuestasFilter === 'perdidas') return a.resultado === 'Perdida';
    return true;
  });

  const filteredDuelos = duelos.filter(d => {
    const isCompleted = d.estado === 'completed';
    if (duelosFilter === 'terminados') return isCompleted;
    if (duelosFilter === 'en curso') return !isCompleted;
    return true;
  });

  return (
    <div className="app-shell-page bg-dracula-base text-dracula-light select-none">
      {/* Cabecera con soporte de Área Segura (iPhone notch) */}
      <header className="flex-shrink-0 bg-dracula-base/95 backdrop-blur-md z-40 app-shell-header border-b border-dracula-gray/20 pt-safe-top pb-3 px-4 select-none">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => router.back()} className="p-1 rounded-full text-dracula-gray hover:text-dracula-light hover:bg-dracula-gray/20 btn-press">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-dracula-light">Perfil de @{profile.username}</h1>
        </div>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-dracula-purple to-[#ff79c6] flex items-center justify-center text-2xl font-black text-dracula-base shadow-[0_0_15px_rgba(189,147,249,0.4)] overflow-hidden">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  profile.username.charAt(0).toUpperCase()
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold text-dracula-light flex items-center gap-2">
                @{profile.username}
              </h2>
              {profile.bio && <p className="text-sm text-dracula-gray mt-1 selectable-text">{profile.bio}</p>}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="flex flex-col items-center p-2 bg-dracula-card rounded-lg border border-dracula-gray/10">
            <Coins size={18} className="text-dracula-yellow mb-1" />
            <span className="text-xs text-dracula-gray">Tokens</span>
            <span className="font-bold text-dracula-light">{profile.saldo_actual}</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-dracula-card rounded-lg border border-dracula-purple/20">
            <Dice5 size={18} className="text-dracula-purple mb-1" />
            <span className="text-xs text-dracula-gray">Apuestas</span>
            <span className="font-bold text-dracula-light">{profile.apuestas_acertadas}</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-dracula-card rounded-lg border border-dracula-green/20">
            <Target size={18} className="text-dracula-green mb-1" />
            <span className="text-xs text-dracula-gray">Misiones</span>
            <span className="font-bold text-dracula-light">{profile.misiones_completadas}</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-dracula-card rounded-lg border border-[#ffb86c]/20">
            <Swords size={18} className="text-[#ffb86c] mb-1" />
            <span className="text-xs text-dracula-gray">Duelos</span>
            <span className="font-bold text-dracula-light">{profile.duelos_ganados}</span>
          </div>
        </div>

        <div className="flex w-full mt-4 border-b border-dracula-gray/20 px-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex-1 text-center pb-3 text-sm font-bold whitespace-nowrap transition-colors btn-press ${
              activeTab === 'feed' ? 'text-dracula-pink border-b-2 border-dracula-pink' : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            Feed
          </button>
          <button
            onClick={() => setActiveTab('apuestas')}
            className={`flex-1 text-center pb-3 text-sm font-bold whitespace-nowrap transition-colors btn-press ${
              activeTab === 'apuestas' ? 'text-dracula-purple border-b-2 border-dracula-purple' : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            Apuestas
          </button>
          <button
            onClick={() => setActiveTab('misiones')}
            className={`flex-1 text-center pb-3 text-sm font-bold whitespace-nowrap transition-colors btn-press ${
              activeTab === 'misiones' ? 'text-dracula-green border-b-2 border-dracula-green' : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            Misiones
          </button>
          <button
            onClick={() => setActiveTab('duelos')}
            className={`flex-1 text-center pb-3 text-sm font-bold whitespace-nowrap transition-colors btn-press ${
              activeTab === 'duelos' ? 'text-[#ffb86c] border-b-2 border-[#ffb86c]' : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            Duelos
          </button>
        </div>
      </header>

      <PullToRefresh onRefresh={fetchAll}>
        <main className="app-shell-scroll px-4 py-4 pb-28 flex-1">
          {activeTab === 'feed' && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              {feed.length === 0 ? (
                <p className="text-center text-dracula-gray mt-8">Sin publicaciones.</p>
              ) : (
                feed.map(post => (
                  <article key={post.id} className="bg-dracula-card p-4 rounded-xl shadow-lg border border-dracula-gray/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-dracula-purple flex items-center justify-center font-bold text-dracula-base text-lg overflow-hidden">
                          {post.author_avatar_url ? (
                            <img src={post.author_avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            post.author.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-dracula-light">{post.author}</span>
                          <span className="text-xs text-dracula-gray">{formatSpanishDate(post.time_ago)}</span>
                        </div>
                      </div>
                      <div className="p-2 bg-dracula-base rounded-full">
                        {post.type === 'mission' && <Target size={18} className="text-dracula-green" />}
                        {post.type === 'duel' && <Swords size={18} className="text-dracula-red" />}
                        {post.type === 'bet' && <Dice5 size={18} className="text-dracula-yellow" />}
                        {post.type === 'social' && <MessageSquare size={18} className="text-dracula-pink" />}
                      </div>
                    </div>
                    <p className="text-dracula-light leading-relaxed">{post.content}</p>
                    {post.media_url && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-dracula-gray/20 bg-black/40 flex justify-center items-center">
                        {isVideoUrl(post.media_url) ? (
                          <video src={post.media_url} controls playsInline className="w-full h-auto object-contain max-h-96" />
                        ) : (
                          <img 
                            src={post.media_url} 
                            alt="Media adjunta" 
                            onClick={() => setFullScreenImage(post.media_url)}
                            className="w-full h-auto object-contain max-h-96 cursor-pointer hover:opacity-90 transition-opacity" 
                            loading="lazy" 
                          />
                        )}
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          )}

          {activeTab === 'apuestas' && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="flex gap-2">
                {(['todas', 'ganadas', 'perdidas'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setApuestasFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-colors ${
                      apuestasFilter === f ? 'bg-dracula-purple text-dracula-base' : 'bg-dracula-card text-dracula-gray border border-dracula-gray/20'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {filteredApuestas.length === 0 ? (
                <p className="text-center text-dracula-gray mt-8">No hay apuestas.</p>
              ) : (
                filteredApuestas.map(a => (
                  <div key={a.id} className="bg-dracula-card p-4 rounded-xl border border-dracula-purple/20 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="font-bold text-dracula-light">{a.titulo}</span>
                      <span className="text-xs text-dracula-gray">{formatSpanishDate(a.fecha)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`font-black flex items-center gap-1 ${a.resultado === 'Ganada' ? 'text-dracula-green' : 'text-dracula-red'}`}>
                        {a.resultado === 'Ganada' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                        {a.cantidad} Tk
                      </span>
                      <span className="text-[10px] uppercase text-dracula-gray">{a.resultado}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'misiones' && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              {misiones.length === 0 ? (
                <p className="text-center text-dracula-gray mt-8">Sin misiones completadas.</p>
              ) : (
                misiones.map(m => (
                  <div key={m.id} className="bg-dracula-card p-4 rounded-xl border border-dracula-green/20 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="font-bold text-dracula-light">{m.titulo}</span>
                      <span className="text-xs text-dracula-gray">{formatSpanishDate(m.fecha_completada)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-black text-dracula-green flex items-center gap-1">
                        <CheckCircle2 size={16} /> +{m.recompensa}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'duelos' && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="flex gap-2">
                {(['todos', 'en curso', 'terminados'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setDuelosFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-colors ${
                      duelosFilter === f ? 'bg-[#ffb86c] text-dracula-base' : 'bg-dracula-card text-dracula-gray border border-dracula-gray/20'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {filteredDuelos.length === 0 ? (
                <p className="text-center text-dracula-gray mt-8">No hay duelos.</p>
              ) : (
                filteredDuelos.map(d => {
                  const isTerminado = d.estado === 'completed';
                  const isWinner = d.ganador === profile.username;
                  
                  return (
                    <div key={d.id} className={`bg-dracula-card p-4 rounded-xl border ${isTerminado ? (isWinner ? 'border-dracula-green/30' : 'border-dracula-red/30') : 'border-[#ffb86c]/30'} flex flex-col gap-2`}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-dracula-purple">vs @{d.retador === profile.username ? d.retado : d.retador}</span>
                        <span className="text-xs text-dracula-gray">{formatSpanishDate(d.fecha)}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="font-bold text-dracula-light">{d.juego}</span>
                        <div className="flex flex-col items-end">
                          <span className={`font-black flex items-center gap-1 ${!isTerminado ? 'text-[#ffb86c]' : (isWinner ? 'text-dracula-green' : 'text-dracula-red')}`}>
                            <Coins size={14}/> {d.tokens_en_juego} Tk
                          </span>
                          <span className="text-[10px] uppercase text-dracula-gray">
                            {!isTerminado ? <span className="flex items-center gap-1"><Clock size={10}/>En curso</span> : (isWinner ? 'Victoria' : 'Derrota')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </main>
      </PullToRefresh>

      {/* Portal de imagen en pantalla completa */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setFullScreenImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-dracula-light bg-black/50 p-2 rounded-full hover:bg-dracula-purple transition-colors z-[101] btn-press"
            onClick={(e) => {
              e.stopPropagation();
              setFullScreenImage(null);
            }}
          >
            <X size={24} />
          </button>
          <img 
            src={fullScreenImage} 
            alt="Fullscreen media" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
