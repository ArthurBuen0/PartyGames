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
  | "verdade-ou-desafio"
  | "cronometro"
  | "desenho-telefone"
  | "code-names";

export type TimeCodeNames = "A" | "B";

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

/** Um traço do Desenho Telefone: uma cor, uma sequência de pontos [x, y] em 0–100. */
export interface Traco {
  cor: string;
  pontos: Array<[number, number]>;
}

export interface ConteudoDesenho {
  tracos: Traco[];
}

export interface ConteudoFrase {
  texto: string;
}

/** União frouxa: cada jogo enche a parte que lhe interessa. */
export interface EstadoRodada {
  // Palavra Parecida / C, S, Composto (cadeia de palavras)
  palavra_atual?: string;
  historico?: Array<Record<string, unknown>>;

  // C, S, Composto
  meta_rodadas?: number;
  rodada_atual?: number;
  prontos?: string[];
  total_prontos?: number;
  avaliacoes_feitas?: number;
  avaliacoes_esperadas?: number;

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

  // Cronômetro
  resultados?: Array<{
    participante_id: string;
    apelido: string;
    alvo_ms: number;
    tempo_ms: number;
    erro_ms: number;
  }>;
  total_jogadores?: number;

  // Desenho Telefone
  autores?: string[];
  passo_atual?: number;
  total_passos?: number;
  tipo_passo?: "frase" | "desenho";
  enviaram?: string[];

  // Code Names
  time_de?: Record<string, TimeCodeNames>;
  spymaster_a?: string | null;
  spymaster_b?: string | null;
  primeiro_time?: TimeCodeNames | null;
  time_da_vez?: TimeCodeNames | null;
  palavras?: Array<{
    indice: number;
    texto: string;
    revelada: boolean;
    cor: TimeCodeNames | "neutro" | "bomba" | null;
  }>;
  restantes?: Record<string, number>;
  dica_atual?: { palavra: string; numero: number; por: string } | null;
  palpites_restantes?: number | null;
}

export interface ResultadoRodada {
  tipo?:
    | "tempo_esgotado"
    | "mimica_fim"
    | "duas_verdades"
    | "c_s_composto_votacao"
    | "cronometro"
    | "desenho_telefone"
    | "code_names";
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

  // C, S, Composto — resultado da votação anônima, palavra por palavra
  avaliacoes?: Array<{
    indice: number;
    palavra: string;
    autor: string;
    autor_id: string;
    valeu: number;
    nao_valeu: number;
    neutro: number;
    delta: number;
  }>;

  // Cronômetro — resultado final, já com quem ganhou
  resultados?: Array<{
    participante_id: string;
    apelido: string;
    alvo_ms: number;
    tempo_ms: number;
    erro_ms: number;
  }>;
  vencedores?: string[];

  // Desenho Telefone — cada caderno, do primeiro ao último passo
  cadernos?: Array<{
    caderno: number;
    autor_original: string;
    passos: Array<{
      passo: number;
      tipo: "frase" | "desenho";
      autor: string | null;
      conteudo: ConteudoFrase | ConteudoDesenho | null;
    }>;
  }>;

  // Code Names
  vencedor_time?: TimeCodeNames;
  motivo?: "completou_palavras" | "bomba";
  tabuleiro?: Array<{
    indice: number;
    texto: string;
    cor: TimeCodeNames | "neutro" | "bomba";
  }>;
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
  tipo:
    | "identidade"
    | "palavra"
    | "personagem"
    | "eliminados"
    | "frases"
    | "alvo_tempo"
    | "tarefa_desenho"
    | "mapa_secreto";
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
