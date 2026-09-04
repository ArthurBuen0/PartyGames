export type Jogo = {
  id: string;
  nome: string;
  emoji: string;
  resumo: string;
  regras: string[];
  dica?: string;
  jogadores: string;
  duracao: string;
};

export type Participante = {
  id: string;
  apelido: string;
  isHost: boolean;
  online: boolean;
};

export type Sorteio = {
  drawId: string;
  gameId: string;
  reel: string[];
  sorteadoPor: string;
  em: number;
};

export type EstadoSala = {
  codigo: string;
  nomeGrupo: string;
  jogadores: Participante[];
  jogosAtivos: string[];
  catalogo: Jogo[];
  ultimoSorteio: Sorteio | null;
};

export type Resposta<T> = { ok: true; data: T } | { ok: false; erro: string };

export type SessaoAck = { estado: EstadoSala; jogadorId: string };
