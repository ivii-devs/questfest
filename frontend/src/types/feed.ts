export type PostType = 'social' | 'bet' | 'mission' | 'duel';

export interface Reply {
  id: number;
  author: string;
  author_avatar_url?: string | null;
  contenido: string;
  fecha_creacion?: string;
  media_url?: string | null;
}

export interface BetOption {
  id: string;
  text: string;
  multiplier: number;
}

export interface Post {
  id: number;
  type: PostType;
  author: string;
  author_id?: number;
  author_avatar_url?: string | null;
  contenido: string;
  media_url?: string | null;
  es_sistema?: boolean;
  time_ago?: string;
  exactTime?: string;
  fecha_creacion?: string;
  replies?: Reply[];
  
  // Metadatos de apuestas
  titulo?: string;
  fase?: string;
  estado?: string;
  opcion_ganadora_id?: string | null;
  options?: BetOption[];
  userVotedOptionId?: string | null;
  userBetAmount?: number;
  userWon?: boolean | null;
  profit?: number;
  winningOption?: string | null;
  multiplier?: number | null;
  upvotes?: number;
  downvotes?: number;
  user_vote?: 'up' | 'down' | null;

  // Metadatos de duelos
  challenger?: string;
  challenged?: string;
  wager?: number;
  game?: string;
  winner?: string | null;
}

export interface FeedCardProps {
  post: Post;
  onRefresh: () => void;
}
