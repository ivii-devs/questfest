/**
 * ============================================================================
 * CONTRATOS DE DATOS Y TIPOS GLOBALES: QuestFest PWA
 * ============================================================================
 * Centraliza las definiciones de tipos para eliminar la necesidad de 'any',
 * asegurar contratos bidireccionales con la API FastAPI y tipar stores y servicios.
 * ============================================================================
 */

// ==============================================================================
// USUARIOS Y AUTENTICACIÓN
// ==============================================================================
export interface Usuario {
  id: number;
  username: string;
  rol: string;
  saldo_actual: number;
  bio?: string | null;
  avatar_url?: string | null;
}

export type User = Usuario;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  bio?: string;
  avatar_url?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface UserStatsResponse {
  total_tokens: number;
  bets_won: number;
  duels_won: number;
  missions_completed: number;
  rank_position?: number;
}

// ==============================================================================
// MULTI-TENANCY Y GRUPOS
// ==============================================================================
export interface GrupoResponse {
  id: number;
  nombre: string;
  descripcion?: string;
  avatar_url?: string;
  codigo_invitacion: string;
  rol: 'admin' | 'member';
  saldo_grupo: number;
  ranking_posicion?: number;
  miembros_totales?: number;
  requiere_password?: boolean;
  saldo_inicial?: number;
  creador_id?: number | null;
}

export type GroupMembership = GrupoResponse;

export interface CreateGroupRequest {
  nombre: string;
  descripcion?: string;
  saldo_inicial?: number;
  password?: string;
}

export interface MiembroGrupoResponse {
  id: number;
  usuario_id: number;
  username: string;
  avatar_url?: string | null;
  rol: 'admin' | 'member';
  saldo_grupo: number;
  fecha_ingreso?: string;
  fecha_union?: string;
  es_creador?: boolean;
}

// ==============================================================================
// APUESTAS
// ==============================================================================
export interface BetOption {
  id: string;
  text: string;
  multiplier: number;
}

export interface ApuestaResponse {
  id: string;
  title: string;
  creator: string;
  phase: string;
  estado: 'propuesta' | 'abierta' | 'cerrada' | 'rechazada' | string;
  group_id?: number | null;
  opcion_ganadora_id?: string | null;
  createdAt?: string | null;
  approvedAt?: string | null;
  options?: BetOption[];
  suggested_options?: { text: string; multiplier: number }[];
  userVotedOptionId?: string | null;
  userBetAmount?: number;
  user_vote?: 'up' | 'down' | null;
  userWon?: boolean | null;
  profit?: number | null;
  upvotes?: number;
  downvotes?: number;
  winningOption?: string | null;
  multiplier?: number | null;
}

export type Apuesta = ApuestaResponse;

export interface CreateBetPayload {
  title: string;
  options: { text: string; multiplier: number }[];
  group_id?: number;
}

export interface TicketResponse {
  id: number;
  apuesta_id: number;
  opcion_id: string;
  monto: number;
}

// ==============================================================================
// DUELOS
// ==============================================================================
export interface DueloResponse {
  id: number;
  challenger: string;
  challenged: string;
  game: string;
  wager: number;
  status:
    | 'pending'
    | 'accepted'
    | 'validation_winner'
    | 'validation_rejected'
    | 'completed'
    | 'penalized_challenger'
    | string;
  group_id?: number | null;
  isCurrentUserChallenged?: boolean;
  is_current_user_challenged?: boolean;
  winner?: string | null;
  challenger_avatar?: string | null;
  challenged_avatar?: string | null;
  fecha_creacion?: string | null;
  reported_resolution?: string | null;
}

export type DueloModel = DueloResponse;

export interface CreateDuelPayload {
  challenged_username: string;
  game: string;
  wager: number;
  group_id?: number;
}

// ==============================================================================
// MISIONES
// ==============================================================================
export interface MissionCompletedByItem {
  username: string;
  proof_text?: string | null;
  proof_image_url?: string | null;
}

export interface MisionResponse {
  id: string | number;
  title: string;
  description: string;
  reward: number;
  group_id?: number | null;
  max_completions?: number | null;
  completed_by?: MissionCompletedByItem[] | null;
  user_has_completed?: boolean | null;
  user_is_pending?: boolean | null;
  phase?: string | null;
  is_roulette?: boolean;
  author?: string | null;
  upvotes?: number | null;
  downvotes?: number | null;
  user_vote?: 'up' | 'down' | null;
  user_completed?: boolean | null;
  createdAt?: string | null;
  status?: string;
  votes_up?: number;
  votes_down?: number;
  proposer_username?: string;
  completed_at?: string;
  proof_text?: string;
  proof_image_url?: string;
}

export type Mision = MisionResponse;

export interface SuggestMissionPayload {
  title: string;
  description: string;
  reward: number;
  group_id?: number;
}

export interface PruebaResponse {
  id: number;
  mision_id: number;
  usuario_id: number;
  prueba_texto?: string | null;
  prueba_imagen_url?: string | null;
  estado: string;
}

// ==============================================================================
// FEED Y SOCIAL
// ==============================================================================
export interface FeedReplyResponse {
  id: number;
  author: string;
  author_avatar_url?: string | null;
  content: string;
  fecha_creacion?: string;
  media_url?: string | null;
}

export interface FeedPostResponse {
  id: number;
  type: 'social' | 'bet' | 'mission' | 'duel';
  author: string;
  author_id?: number;
  author_avatar_url?: string | null;
  content: string;
  media_url?: string | null;
  is_system?: boolean;
  time_ago?: string;
  exactTime?: string;
  fecha_creacion?: string;
  replies?: FeedReplyResponse[];
  group_id?: number | null;
}

export interface CreatePostPayload {
  content: string;
  tipo?: string;
  media_url?: string | null;
  group_id?: number;
}

// ==============================================================================
// ADMINISTRACIÓN
// ==============================================================================
export interface GlobalStatsResponse {
  total_users: number;
  total_tokens: number;
}

export interface TransactionResponse {
  id: number;
  amount: number;
  concept: string;
  date: string;
  type: 'income' | 'expense';
}

export interface BoletinConfigPayload {
  enabled?: boolean;
  send_hour?: number;
  include_ranking?: boolean;
}

// ==============================================================================
// KITS DE EVENTOS Y PRESETS
// ==============================================================================
export interface MisionKitItem {
  titulo: string;
  descripcion: string;
  dificultad: 'facil' | 'media' | 'dificil' | string;
  recompensa_sugerida: number;
  cupo_maximo?: number | null;
}

export interface RuletaKitItem {
  titulo: string;
  descripcion: string;
  dificultad: 'facil' | 'media' | 'dificil' | string;
  recompensa_sugerida: number;
}

export interface OpcionApuestaKit {
  id: string;
  text: string;
  multiplier: number;
}

export interface ApuestaKitItem {
  titulo: string;
  opciones: OpcionApuestaKit[];
}

export interface ContenidoKit {
  misiones: MisionKitItem[];
  ruletas: RuletaKitItem[];
  apuestas: ApuestaKitItem[];
}

export interface KitEventoResponse {
  id: number;
  titulo: string;
  descripcion: string;
  categoria: string;
  icono_url?: string | null;
  autor_id?: number | null;
  autor_username?: string | null;
  es_oficial: boolean;
  es_publico: boolean;
  descargas_count: number;
  likes_count: number;
  is_liked_by_user?: boolean;
  total_misiones: number;
  total_ruletas: number;
  total_apuestas: number;
  contenido: ContenidoKit;
  fecha_creacion: string;
}

export type KitEvento = KitEventoResponse;

export interface CreateKitPayload {
  titulo: string;
  descripcion: string;
  categoria: string;
  icono_url?: string | null;
  es_publico: boolean;
  es_oficial?: boolean;
  contenido: ContenidoKit;
}

export interface InyeccionMisionItem {
  titulo: string;
  descripcion: string;
  recompensa: number;
  cupo_maximo?: number | null;
}

export interface InyeccionRuletaItem {
  titulo: string;
  descripcion: string;
  recompensa: number;
}

export interface InyeccionApuestaItem {
  titulo: string;
  opciones: OpcionApuestaKit[];
}

export interface InyeccionKitPayload {
  kit_id?: number;
  publicar_inmediatamente: boolean;
  misiones_seleccionadas: InyeccionMisionItem[];
  ruletas_seleccionadas: InyeccionRuletaItem[];
  apuestas_seleccionadas: InyeccionApuestaItem[];
}

export interface InyeccionKitResult {
  misiones_creadas: number;
  ruletas_creadas: number;
  apuestas_creadas: number;
  estado_asignado: string;
  mensaje: string;
}

export interface KitLikeResult {
  liked: boolean;
  likes_count: number;
}

