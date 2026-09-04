import { vi } from "vitest";
import type {
  Duelo, EstadoPrivado, EstadoSala, JogoId, Participante, Rodada
} from "../lib/tipos";
import type { PropsJogo } from "../jogos/tipos";

/**
 * Fábrica de cenários para os testes de tela.
 *
 * Monta um `EstadoSala` igual ao que `estado_da_sala()` devolve, para os
 * componentes serem exercitados com dados de verdade — inclusive a parte mais
 * delicada, que é o `privados`: nos testes ele contém EXATAMENTE as linhas que
 * o RLS entregaria àquela pessoa, nem uma a mais.
 */

export const IDS = {
  ana: "p-ana",
  bruno: "p-bruno",
  carla: "p-carla",
  davi: "p-davi"
};

export function participante(
  id: string,
  apelido: string,
  extra: Partial<Participante> = {}
): Participante {
  return {
    id,
    apelido,
    cor: "roxo",
    e_anfitriao: false,
    conectado: true,
    pontos: 0,
    eliminado: false,
    ordem: 0,
    ...extra
  };
}

export const PARTICIPANTES: Participante[] = [
  participante(IDS.ana, "Ana", { e_anfitriao: true, ordem: 0, cor: "roxo" }),
  participante(IDS.bruno, "Bruno", { ordem: 1, cor: "rosa" }),
  participante(IDS.carla, "Carla", { ordem: 2, cor: "amarelo" }),
  participante(IDS.davi, "Davi", { ordem: 3, cor: "azul" })
];

export function montarEstado(
  jogo: JogoId,
  rodada: Partial<Rodada>,
  opcoes: {
    euId?: string;
    modoAdulto?: boolean;
    duelos?: Duelo[];
    painel?: EstadoSala["partida"] extends null ? never : unknown;
    config?: Record<string, unknown>;
  } = {}
): EstadoSala {
  const euId = opcoes.euId ?? IDS.ana;
  const eu = PARTICIPANTES.find((p) => p.id === euId)!;

  return {
    servidor_agora: new Date().toISOString(),
    eu: {
      id: eu.id,
      apelido: eu.apelido,
      cor: eu.cor,
      e_anfitriao: eu.e_anfitriao,
      pontos: eu.pontos,
      eliminado: eu.eliminado
    },
    sala: {
      id: "sala-1",
      codigo: "ABCD",
      nome: "Sala de teste",
      status: "jogando",
      jogo_atual: jogo,
      modo_adulto: opcoes.modoAdulto ?? false,
      adulto_confirmado_em: opcoes.modoAdulto ? new Date().toISOString() : null,
      anfitriao_id: IDS.ana
    },
    participantes: PARTICIPANTES,
    partida: {
      id: "partida-1",
      jogo,
      status: "ativa",
      config: (opcoes.config ?? {}) as never
    },
    rodada: {
      id: "rodada-1",
      numero: 1,
      fase: "em_andamento",
      vez_de: IDS.ana,
      estado: {},
      turno_inicio: null,
      turno_fim: null,
      resultado: null,
      ...rodada
    },
    duelos: opcoes.duelos ?? []
  };
}

export function privado(
  donoId: string,
  tipo: EstadoPrivado["tipo"],
  conteudo: Record<string, unknown>,
  visivelParaDono = true
): EstadoPrivado {
  return {
    id: `priv-${donoId}-${tipo}`,
    rodada_id: "rodada-1",
    partida_id: "partida-1",
    dono_id: donoId,
    tipo,
    conteudo,
    visivel_para_dono: visivelParaDono
  };
}

/** Props completas para exercitar um módulo de jogo. */
export function montarProps(
  estado: EstadoSala,
  privados: EstadoPrivado[] = [],
  segundos = 5
): PropsJogo {
  const jogadorDaVez =
    estado.participantes.find((p) => p.id === estado.rodada?.vez_de) ?? null;

  return {
    sala: {
      estado,
      privados,
      carregando: false,
      erro: null,
      codigoErro: "",
      desvioRelogio: 0,
      conectado: true,
      recarregar: async () => {}
    },
    estado,
    rodada: estado.rodada!,
    eu: estado.eu,
    souAnfitriao: estado.eu.e_anfitriao,
    minhaVez: estado.rodada?.vez_de === estado.eu.id,
    jogadorDaVez,
    privados,
    acao: vi.fn(async (fn: () => Promise<unknown>) => {
      try {
        return (await fn()) as never;
      } catch {
        return null;
      }
    }) as PropsJogo["acao"],
    segundos,
    totalSegundos: segundos
  };
}

/** Painel de personagens do Cara a Cara, no formato que vem do banco. */
export function painelDeTeste(quantidade = 24) {
  const nomes = [
    "Alma", "Bento", "Célia", "Dário", "Elis", "Fábio", "Gina", "Hugo",
    "Íris", "Jonas", "Kátia", "Lucas", "Malu", "Nico", "Olga", "Paulo",
    "Quenia", "Rui", "Sara", "Tiago", "Ubi", "Vera", "Wilson", "Zuma"
  ];

  return nomes.slice(0, quantidade).map((nome, i) => ({
    id: `carta-${i}`,
    p: {
      nome,
      cabelo: (["preto", "castanho", "loiro", "ruivo", "grisalho", "careca"] as const)[i % 6],
      estilo_cabelo: (["curto", "longo", "cacheado", "careca"] as const)[i % 4],
      oculos: i % 2 === 0,
      chapeu: i % 3 === 0,
      barba: i % 4 === 0,
      camiseta: (["roxo", "rosa", "amarelo", "azul", "verde", "cinza"] as const)[i % 6],
      acessorio: (["nenhum", "brinco", "colar", "cachecol"] as const)[i % 4],
      pele: (["clara", "morena", "negra"] as const)[i % 3]
    }
  }));
}
