import type { ComponentType, ReactNode } from "react";
import type { SalaAoVivo } from "../hooks/useSala";
import type { EstadoPrivado, EstadoSala, JogoId, Participante, Rodada } from "../lib/tipos";

/**
 * Contrato entre a mesa e cada jogo.
 *
 * A `Mesa` cuida do que é igual em todos: cabeçalho, placar, regras, cronômetro
 * e a tela de fim de rodada. Cada jogo implementa só o miolo — e, quando faz
 * sentido, o que aparece de especial no resultado.
 */

export interface PropsJogo {
  sala: SalaAoVivo;
  estado: EstadoSala;
  rodada: Rodada;
  eu: EstadoSala["eu"];
  souAnfitriao: boolean;
  minhaVez: boolean;
  /** Quem está na vez (pode ser você). */
  jogadorDaVez: Participante | null;
  privados: EstadoPrivado[];
  /** Executa uma RPC já tratando erro e aviso na tela. */
  acao: <T>(fn: () => Promise<T>, mensagemOk?: string) => Promise<T | null>;
  /** Segundos restantes do turno, já sincronizados com o servidor. */
  segundos: number;
  totalSegundos: number;
}

export interface ModuloJogo {
  id: JogoId;
  /**
   * Componentes de verdade, renderizados como <Componente {...props} />.
   * Chamar como função (Componente(props)) faria os hooks do jogo rodarem
   * dentro do render da Mesa — e a ordem deles mudaria entre uma fase e outra.
   */
  Componente: ComponentType<PropsJogo>;
  /** Conteúdo extra dentro da tela de fim de rodada. */
  Resultado?: ComponentType<PropsJogo>;
  /** Botões do anfitrião que aparecem antes de "Próxima rodada". */
  AcoesResultado?: ComponentType<PropsJogo>;
  /** Some com o bloco padrão "É a sua vez" (jogos que já mostram isso à sua maneira). */
  escondeVezDe?: boolean;
}

/** Acha o estado privado desta pessoa por tipo. */
export function meuPrivado(
  privados: EstadoPrivado[],
  euId: string,
  tipo: EstadoPrivado["tipo"]
): EstadoPrivado | null {
  return privados.find((p) => p.dono_id === euId && p.tipo === tipo) ?? null;
}

/** Acha o estado privado de OUTRA pessoa (Quem Sou Eu?). */
export function privadoDe(
  privados: EstadoPrivado[],
  donoId: string,
  tipo: EstadoPrivado["tipo"]
): EstadoPrivado | null {
  return privados.find((p) => p.dono_id === donoId && p.tipo === tipo) ?? null;
}

export type Renderizavel = ReactNode;
