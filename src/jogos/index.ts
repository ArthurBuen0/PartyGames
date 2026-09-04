import type { JogoId } from "../lib/tipos";
import type { ModuloJogo } from "./tipos";
import { csComposto } from "./CSComposto";
import { palavraParecida } from "./PalavraParecida";
import { mimica } from "./Mimica";
import { quemSouEu } from "./QuemSouEu";
import { caraACara } from "./CaraACara";
import { duasVerdades } from "./DuasVerdades";
import { verdadeOuDesafio } from "./VerdadeOuDesafio";

/**
 * Registro dos jogos: a `Mesa` procura o módulo pelo id que veio da partida.
 * Para adicionar uma brincadeira nova, bastam três passos — a entrada em
 * `lib/jogos.ts`, o valor no enum `jogo_id` do banco e o módulo aqui.
 */
export const MODULOS: Record<JogoId, ModuloJogo> = {
  "c-s-composto": csComposto,
  "palavra-parecida": palavraParecida,
  "quem-sou-eu": quemSouEu,
  mimica,
  "cara-a-cara": caraACara,
  "duas-verdades": duasVerdades,
  "verdade-ou-desafio": verdadeOuDesafio
};

export type { ModuloJogo, PropsJogo } from "./tipos";
