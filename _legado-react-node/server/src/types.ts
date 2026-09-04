export type Game = {
  id: string;
  nome: string;
  emoji: string;
  /** Frase curta que aparece no card do catálogo. */
  resumo: string;
  /** Regras resumidas, mostradas depois do sorteio. */
  regras: string[];
  /** Dica divertida opcional, mostrada no rodapé das regras. */
  dica?: string;
  jogadores: string;
  duracao: string;
};

export type Player = {
  id: string;
  apelido: string;
  isHost: boolean;
  online: boolean;
  /** timestamp da última vez que o jogador esteve conectado */
  lastSeen: number;
};

/** Jogador como o cliente enxerga (sem dados internos). */
export type PublicPlayer = {
  id: string;
  apelido: string;
  isHost: boolean;
  online: boolean;
};

export type DrawResult = {
  /** id único do sorteio, usado para o cliente não animar duas vezes o mesmo */
  drawId: string;
  gameId: string;
  /** nomes que passam na "roleta" antes do resultado, iguais para todo mundo */
  reel: string[];
  sorteadoPor: string;
  em: number;
};

export type RoomState = {
  codigo: string;
  nomeGrupo: string;
  jogadores: PublicPlayer[];
  jogosAtivos: string[];
  catalogo: Game[];
  ultimoSorteio: DrawResult | null;
};

export type Room = {
  codigo: string;
  nomeGrupo: string;
  jogadores: Player[];
  jogosAtivos: Set<string>;
  ultimoSorteio: DrawResult | null;
  criadaEm: number;
  atualizadaEm: number;
};

export type Ack<T> = { ok: true; data: T } | { ok: false; erro: string };
