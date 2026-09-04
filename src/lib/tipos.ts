/**
 * Tipos do domínio — espelham o que `estado_da_sala()` devolve (03_funcoes.sql).
 *
 * O estado de cada rodada vem em jsonb, então os campos de `EstadoRodada` são
 * opcionais: cada jogo preenche os seus. Quem consome sabe quais esperar.
 */

export type JogoId =
  | "c-s-composto"
  | "palavra-parecida"
  | "quem-sou-eu"
  | "mimica"
  | "cara-a-cara"
  | "duas-verdades"
  | "verdade-ou-desafio";

export type StatusSala = "lobby" | "jogando" | "encerrada";

export type FaseRodada =
  | "preparando"
  | "escrevendo"
  | "em_andamento"
  | "votacao"
  | "resultado"
  | "encerrada";

export type CorJogador =
  | "roxo" | "rosa" | "amarelo" | "turquesa"
  | "coral" | "azul" | "verde" | "laranja";

export interface Participante {
  id: string;
  apelido: string;
  cor: CorJogador;
  e_anfitriao: boolean;
  conectado: boolean;
  pontos: number;
  eliminado: boolean;
  ordem: number;
}

export interface Sala {
  id: string;
  codigo: string;
  nome: string;
  status: StatusSala;
  jogo_atual: JogoId | null;
  modo_adulto: boolean;
  adulto_confirmado_em: string | null;
  anfitriao_id: string | null;
}

export interface Partida {
  id: string;
  jogo: JogoId;
  status: "ativa" | "encerrada";
  config: {
    limitePerguntas?: number;
    painel?: PersonagemNoPainel[];
  };
}

/** União frouxa: cada jogo enche a parte que lhe interessa. */
export interface EstadoRodada {
  // C, S, Composto
  categoria?: string;
  sequencia?: string[];
  indice?: number;
  voltas?: number;

  // Palavra Parecida
  palavra_atual?: string;
  historico?: Array<Record<string, unknown>>;

  // Quem Sou Eu?
  perguntas?: Record<string, number>;
  acertaram?: Array<{ id: string; apelido: string; identidade: string }>;
  limite_perguntas?: number;
  ultima_resposta?: { resposta: "sim" | "nao" | "talvez"; por: string } | null;

  // Mímica
  acertos?: number;
  palavras_acertadas?: string[];

  // Duas Verdades
  tema?: string;
  frases?: string[];
  votos?: number;
  total_votantes?: number;

  // Verdade ou Desafio
  escolha?: "verdade" | "desafio" | null;
  adulto?: boolean;
  carta?: { id: string; texto: string } | null;

  // Cara a Cara
  mesas?: number;
}

export interface ResultadoRodada {
  tipo?: "tempo_esgotado" | "mimica_fim" | "duas_verdades";
  perdedor?: string;
  perdedor_id?: string;
  vencedor?: string;
  vencedor_id?: string;
  jogador?: string;
  jogador_id?: string;
  acertos?: number;
  palavras?: string[];
  mentira?: number;
  autor?: string;
  autor_id?: string;
  enganados?: number;
  votos?: Array<{ apelido: string; voto: number; acertou: boolean }>;
}

export interface Rodada {
  id: string;
  numero: number;
  fase: FaseRodada;
  vez_de: string | null;
  estado: EstadoRodada;
  turno_inicio: string | null;
  turno_fim: string | null;
  resultado: ResultadoRodada | null;
}

export interface Duelo {
  id: string;
  mesa: number;
  jogador_a: string;
  jogador_b: string | null;
  vez_de: string | null;
  fase: "perguntando" | "respondendo" | "encerrado";
  pergunta_atual: string | null;
  historico: Array<{
    pergunta?: string;
    resposta?: string;
    de?: string;
    palpite?: string;
    acertou?: boolean;
  }>;
  vencedor_id: string | null;
  motivo_fim: string | null;
}

export interface Eu {
  id: string;
  apelido: string;
  cor: CorJogador;
  e_anfitriao: boolean;
  pontos: number;
  eliminado: boolean;
}

/** O pacote completo que o cliente recebe a cada atualização. */
export interface EstadoSala {
  servidor_agora: string;
  eu: Eu;
  sala: Sala;
  participantes: Participante[];
  partida: Partida | null;
  rodada: Rodada | null;
  duelos: Duelo[];
}

/** Linha de `estados_privados` — o RLS já garantiu que você pode vê-la. */
export interface EstadoPrivado {
  id: string;
  rodada_id: string | null;
  partida_id: string | null;
  dono_id: string;
  tipo: "identidade" | "palavra" | "personagem" | "eliminados" | "frases";
  conteudo: Record<string, unknown>;
  visivel_para_dono: boolean;
}

/** Personagem do Cara a Cara, como sai do banco. */
export interface Personagem {
  nome: string;
  cabelo: "preto" | "castanho" | "loiro" | "ruivo" | "grisalho" | "careca";
  estilo_cabelo: "curto" | "longo" | "cacheado" | "careca";
  oculos: boolean;
  chapeu: boolean;
  barba: boolean;
  camiseta: string;
  acessorio: "nenhum" | "brinco" | "colar" | "cachecol";
  pele: "clara" | "morena" | "negra";
}

export interface PersonagemNoPainel {
  id: string;
  p: Personagem;
}

/** Sessão guardada no navegador para reconectar sozinho. */
export interface SessaoLocal {
  salaId: string;
  codigo: string;
  apelido: string;
}
