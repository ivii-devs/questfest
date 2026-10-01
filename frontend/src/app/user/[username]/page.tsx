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
  X,
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
  is_system?: boolean;
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

  const [activeTab, setActiveTab] = useState<
    'feed' | 'apuestas' | 'misiones' | 'duelos'
  >('feed');
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const [feed, setFeed] = useState<PostResponse[]>([]);
  const [apuestas, setApuestas] = useState<ApuestaResponse[]>([]);
  const [misiones, setMisiones] = useState<MisionResponse[]>([]);
  const [duelos, setDuelos] = useState<DueloResponse[]>([]);

  const [apuestasFilter, setApuestasFilter] = useState<
    'todas' | 'ganadas' | 'perdidas'
  >('todas');
  const [duelosFilter, setDuelosFilter] = useState<
    'todos' | 'en curso' | 'terminados'
  >('todos');

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
      <div className="bg-dracula-base flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="border-dracula-purple h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"></div>
        <span className="text-dracula-gray text-sm font-bold tracking-widest uppercase">
          Cargando...
        </span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-dracula-base text-dracula-light flex min-h-screen flex-col items-center justify-center gap-3">
        <h2>Usuario no encontrado</h2>
        <button
          onClick={() => router.back()}
          className="text-dracula-purple underline"
        >
          Volver
        </button>
      </div>
    );
  }

  const filteredApuestas = apuestas.filter((a) => {
    if (apuestasFilter === 'ganadas') return a.resultado === 'Ganada';
    if (apuestasFilter === 'perdidas') return a.resultado === 'Perdida';
    return true;
  });

  const filteredDuelos = duelos.filter((d) => {
    const isCompleted = d.estado === 'completed';
    if (duelosFilter === 'terminados') return isCompleted;
    if (duelosFilter === 'en curso') return !isCompleted;
    return true;
  });

  return (
    <div className="app-shell-page bg-dracula-base text-dracula-light select-none">
      {/* Cabecera con soporte de Área Segura (iPhone notch) */}
      <header className="bg-dracula-base/95 app-shell-header border-dracula-gray/20 pt-safe-top z-40 flex-shrink-0 border-b px-4 pb-3 backdrop-blur-md select-none">
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="text-dracula-gray hover:text-dracula-light hover:bg-dracula-gray/20 btn-press rounded-full p-1"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-dracula-light text-xl font-bold">
            Perfil de @{profile.username}
          </h1>
        </div>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="from-dracula-purple text-dracula-base flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr to-[#ff79c6] text-2xl font-black shadow-[0_0_15px_rgba(189,147,249,0.4)]">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  profile.username.charAt(0).toUpperCase()
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <h2 className="text-dracula-light flex items-center gap-2 text-2xl font-bold">
                @{profile.username}
              </h2>
              {profile.bio && (
                <p className="text-dracula-gray selectable-text mt-1 text-sm">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <div className="bg-dracula-card border-dracula-gray/10 flex flex-col items-center rounded-lg border p-2">
            <Coins size={18} className="text-dracula-yellow mb-1" />
            <span className="text-dracula-gray text-xs">Tokens</span>
            <span className="text-dracula-light font-bold">
              {profile.saldo_actual}
            </span>
          </div>
          <div className="bg-dracula-card border-dracula-purple/20 flex flex-col items-center rounded-lg border p-2">
            <Dice5 size={18} className="text-dracula-purple mb-1" />
            <span className="text-dracula-gray text-xs">Apuestas</span>
            <span className="text-dracula-light font-bold">
              {profile.apuestas_acertadas}
            </span>
          </div>
          <div className="bg-dracula-card border-dracula-green/20 flex flex-col items-center rounded-lg border p-2">
            <Target size={18} className="text-dracula-green mb-1" />
            <span className="text-dracula-gray text-xs">Misiones</span>
            <span className="text-dracula-light font-bold">
              {profile.misiones_completadas}
            </span>
          </div>
          <div className="bg-dracula-card flex flex-col items-center rounded-lg border border-[#ffb86c]/20 p-2">
            <Swords size={18} className="mb-1 text-[#ffb86c]" />
            <span className="text-dracula-gray text-xs">Duelos</span>
            <span className="text-dracula-light font-bold">
              {profile.duelos_ganados}
            </span>
          </div>
        </div>

        <div className="border-dracula-gray/20 scrollbar-hide mt-4 flex w-full overflow-x-auto border-b px-2">
          <button
            onClick={() => setActiveTab('feed')}
            className={`btn-press flex-1 pb-3 text-center text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'feed'
                ? 'text-dracula-pink border-dracula-pink border-b-2'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            Feed
          </button>
          <button
            onClick={() => setActiveTab('apuestas')}
            className={`btn-press flex-1 pb-3 text-center text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'apuestas'
                ? 'text-dracula-purple border-dracula-purple border-b-2'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            Apuestas
          </button>
          <button
            onClick={() => setActiveTab('misiones')}
            className={`btn-press flex-1 pb-3 text-center text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'misiones'
                ? 'text-dracula-green border-dracula-green border-b-2'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            Misiones
          </button>
          <button
            onClick={() => setActiveTab('duelos')}
            className={`btn-press flex-1 pb-3 text-center text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'duelos'
                ? 'border-b-2 border-[#ffb86c] text-[#ffb86c]'
                : 'text-dracula-gray hover:text-dracula-light'
            }`}
          >
            Duelos
          </button>
        </div>
      </header>

      <PullToRefresh onRefresh={fetchAll}>
        <main className="app-shell-scroll flex-1 px-4 py-4 pb-28">
          {activeTab === 'feed' && (
            <div className="animate-fadeIn flex flex-col gap-4">
              {feed.length === 0 ? (
                <p className="text-dracula-gray mt-8 text-center">
                  Sin publicaciones.
                </p>
              ) : (
                feed.map((post) => (
                  <article
                    key={post.id}
                    className="bg-dracula-card border-dracula-gray/10 flex flex-col gap-3 rounded-xl border p-4 shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-dracula-purple text-dracula-base flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-lg font-bold">
                          {post.author_avatar_url ? (
                            <img
                              src={post.author_avatar_url}
                              alt="Avatar"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            post.author.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-dracula-light font-bold">
                            {post.author}
                          </span>
                          <span className="text-dracula-gray text-xs">
                            {formatSpanishDate(post.time_ago)}
                          </span>
                        </div>
                      </div>
                      <div className="bg-dracula-base rounded-full p-2">
                        {post.type === 'mission' && (
                          <Target size={18} className="text-dracula-green" />
                        )}
                        {post.type === 'duel' && (
                          <Swords size={18} className="text-dracula-red" />
                        )}
                        {post.type === 'bet' && (
                          <Dice5 size={18} className="text-dracula-yellow" />
                        )}
                        {post.type === 'social' && (
                          <MessageSquare
                            size={18}
                            className="text-dracula-pink"
                          />
                        )}
                      </div>
                    </div>
                    <p className="text-dracula-light leading-relaxed">
                      {post.content}
                    </p>
                    {post.media_url && (
                      <div className="border-dracula-gray/20 mt-2 flex items-center justify-center overflow-hidden rounded-xl border bg-black/40">
                        {isVideoUrl(post.media_url) ? (
                          <video
                            src={post.media_url}
                            controls
                            playsInline
                            className="h-auto max-h-96 w-full object-contain"
                          />
                        ) : (
                          <img
                            src={post.media_url}
                            alt="Media adjunta"
                            onClick={() => setFullScreenImage(post.media_url)}
                            className="h-auto max-h-96 w-full cursor-pointer object-contain transition-opacity hover:opacity-90"
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
            <div className="animate-fadeIn flex flex-col gap-4">
              <div className="flex gap-2">
                {(['todas', 'ganadas', 'perdidas'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setApuestasFilter(f)}
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase transition-colors ${
                      apuestasFilter === f
                        ? 'bg-dracula-purple text-dracula-base'
                        : 'bg-dracula-card text-dracula-gray border-dracula-gray/20 border'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {filteredApuestas.length === 0 ? (
                <p className="text-dracula-gray mt-8 text-center">
                  No hay apuestas.
                </p>
              ) : (
                filteredApuestas.map((a) => (
                  <div
                    key={a.id}
                    className="bg-dracula-card border-dracula-purple/20 flex items-center justify-between rounded-xl border p-4"
                  >
                    <div className="flex flex-col">
                      <span className="text-dracula-light font-bold">
                        {a.titulo}
                      </span>
                      <span className="text-dracula-gray text-xs">
                        {formatSpanishDate(a.fecha)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span
                        className={`flex items-center gap-1 font-black ${a.resultado === 'Ganada' ? 'text-dracula-green' : 'text-dracula-red'}`}
                      >
                        {a.resultado === 'Ganada' ? (
                          <TrendingUp size={16} />
                        ) : (
                          <TrendingDown size={16} />
                        )}
                        {a.cantidad} Tk
                      </span>
                      <span className="text-dracula-gray text-[10px] uppercase">
                        {a.resultado}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'misiones' && (
            <div className="animate-fadeIn flex flex-col gap-4">
              {misiones.length === 0 ? (
                <p className="text-dracula-gray mt-8 text-center">
                  Sin misiones completadas.
                </p>
              ) : (
                misiones.map((m) => (
                  <div
                    key={m.id}
                    className="bg-dracula-card border-dracula-green/20 flex items-center justify-between rounded-xl border p-4"
                  >
                    <div className="flex flex-col">
                      <span className="text-dracula-light font-bold">
                        {m.titulo}
                      </span>
                      <span className="text-dracula-gray text-xs">
                        {formatSpanishDate(m.fecha_completada)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-dracula-green flex items-center gap-1 font-black">
                        <CheckCircle2 size={16} /> +{m.recompensa}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'duelos' && (
            <div className="animate-fadeIn flex flex-col gap-4">
              <div className="flex gap-2">
                {(['todos', 'en curso', 'terminados'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setDuelosFilter(f)}
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase transition-colors ${
                      duelosFilter === f
                        ? 'text-dracula-base bg-[#ffb86c]'
                        : 'bg-dracula-card text-dracula-gray border-dracula-gray/20 border'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {filteredDuelos.length === 0 ? (
                <p className="text-dracula-gray mt-8 text-center">
                  No hay duelos.
                </p>
              ) : (
                filteredDuelos.map((d) => {
                  const isTerminado = d.estado === 'completed';
                  const isWinner = d.ganador === profile.username;

                  return (
                    <div
                      key={d.id}
                      className={`bg-dracula-card rounded-xl border p-4 ${isTerminado ? (isWinner ? 'border-dracula-green/30' : 'border-dracula-red/30') : 'border-[#ffb86c]/30'} flex flex-col gap-2`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-dracula-purple text-xs font-bold">
                          vs @
                          {d.retador === profile.username
                            ? d.retado
                            : d.retador}
                        </span>
                        <span className="text-dracula-gray text-xs">
                          {formatSpanishDate(d.fecha)}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <span className="text-dracula-light font-bold">
                          {d.juego}
                        </span>
                        <div className="flex flex-col items-end">
                          <span
                            className={`flex items-center gap-1 font-black ${!isTerminado ? 'text-[#ffb86c]' : isWinner ? 'text-dracula-green' : 'text-dracula-red'}`}
                          >
                            <Coins size={14} /> {d.tokens_en_juego} Tk
                          </span>
                          <span className="text-dracula-gray text-[10px] uppercase">
                            {!isTerminado ? (
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                En curso
                              </span>
                            ) : isWinner ? (
                              'Victoria'
                            ) : (
                              'Derrota'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </main>
      </PullToRefresh>

      {/* Portal de imagen en pantalla completa */}
      {fullScreenImage && (
        <div
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
          onClick={() => setFullScreenImage(null)}
        >
          <button
            className="text-dracula-light hover:bg-dracula-purple btn-press absolute top-4 right-4 z-[101] rounded-full bg-black/50 p-2 transition-colors"
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
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
