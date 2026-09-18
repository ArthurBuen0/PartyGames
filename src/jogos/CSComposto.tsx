import { useEffect, useState, type FormEvent } from "react";
import { chamar } from "../lib/supabase";
import { Botao, Cartao, Etiqueta } from "../componentes/Base";
import { Cronometro } from "../componentes/Cronometro";
import type { ModuloJogo, PropsJogo } from "./tipos";

/**
 * C, S, Composto — cadeia de palavras proibidas.
 *
 * Cada palavra da cadeia não pode começar com C nem S, não pode ser composta,
 * e precisa ter a ver com a anterior — quem escreve tem 10 segundos. Depois
 * da última rodada, todo mundo avalia cada palavra em segredo (valeu / não
 * valeu / neutro); a maioria decide os pontos na revelação.
 */

type Avaliacao = "valeu" | "nao_valeu" | "neutro";

interface ItemCadeia {
  palavra?: string;
  autor?: string | null;
  autor_id?: string | null;
}

function Componente(props: PropsJogo) {
  const { rodada, estado, minhaVez, jogadorDaVez, acao, segundos, totalSegundos, eu, souAnfitriao } =
    props;

  const [palavra, setPalavra] = useState("");
  const [meusVotos, setMeusVotos] = useState<Record<number, Avaliacao>>({});

  const fase = rodada.fase;
  const historico = (rodada.estado.historico ?? []) as ItemCadeia[];
  const metaRodadas = rodada.estado.meta_rodadas ?? 10;
  const rodadaAtual = rodada.estado.rodada_atual ?? 0;
  const prontos = rodada.estado.prontos ?? [];
  const totalProntos = rodada.estado.total_prontos ?? estado.participantes.length;
  const jaEstouPronto = prontos.includes(eu.id);

  useEffect(() => {
    setPalavra("");
  }, [rodada.vez_de]);

  // Estourou o tempo da vez: só pula, ninguém perde nada por isso
  useEffect(() => {
    if (fase !== "em_andamento" || segundos > 0 || !rodada.turno_fim) return;
    const id = setTimeout(() => {
      void acao(() => chamar("csc_registrar_timeout", { p_rodada: rodada.id }));
    }, 150 + Math.random() * 350);
    return () => clearTimeout(id);
  }, [fase, segundos, rodada.turno_fim, rodada.id, acao]);

  // Estourou o tempo da votação: o anfitrião revela com o que tiver
  useEffect(() => {
    if (fase !== "votacao" || segundos > 0 || !rodada.turno_fim || !souAnfitriao) return;
    const id = setTimeout(() => {
      void acao(() => chamar("csc_revelar", { p_rodada: rodada.id }));
    }, 300);
    return () => clearTimeout(id);
  }, [fase, segundos, rodada.turno_fim, rodada.id, acao, souAnfitriao]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const palavraEnviada = palavra.trim();
    if (!palavraEnviada) return;
    const r = await acao(() =>
      chamar("csc_enviar_palavra", { p_rodada: rodada.id, p_palavra: palavraEnviada })
    );
    if (r) setPalavra("");
  }

  async function votar(indice: number, valor: Avaliacao) {
    setMeusVotos((v) => ({ ...v, [indice]: valor }));
    const r = await acao(() =>
      chamar("csc_avaliar_palavra", { p_rodada: rodada.id, p_indice: indice, p_valor: valor })
    );
    if (r === null) {
      setMeusVotos((v) => {
        const copia = { ...v };
        delete copia[indice];
        return copia;
      });
    }
  }

  /* -------------------------------------------------------- preparando */

  if (fase === "preparando") {
    const primeiraPalavra = historico[0]?.palavra;

    return (
      <div className="flex flex-col gap-4">
        <Cartao className="bg-linear-to-br from-roxo-100 to-superficie-2 text-center">
          <p className="text-5xl" aria-hidden="true">
            ✋
          </p>
          <h2 className="mt-2 fonte-titulo text-2xl text-roxo-900">Prontos?</h2>
          <p className="mt-1 text-texto-suave">
            Nada de C, nada de S, nada de palavra composta — e cada palavra precisa ter a ver com a
            anterior. {metaRodadas} rodadas a partir de{" "}
            {primeiraPalavra ? <strong>“{primeiraPalavra}”</strong> : "uma palavra sorteada"}.
          </p>
        </Cartao>

        <Cartao className="text-center">
          <p className="numeros-fixos fonte-titulo text-2xl font-extrabold text-roxo-700">
            {prontos.length}/{totalProntos}
          </p>
          <p className="text-sm text-texto-suave">jogadores prontos</p>

          <Botao
            grande
            largo
            className="mt-4"
            disabled={jaEstouPronto}
            onClick={() => void acao(() => chamar("csc_marcar_pronto", { p_rodada: rodada.id }))}
          >
            {jaEstouPronto ? "Aguardando os outros…" : "Estou pronto!"}
          </Botao>
        </Cartao>

        <ul className="flex flex-wrap justify-center gap-2" aria-label="Quem já confirmou">
          {estado.participantes.map((p) => (
            <li key={p.id}>
              <Etiqueta
                className={
                  prontos.includes(p.id)
                    ? "bg-verde-100 text-verde-600"
                    : "bg-superficie-2 text-texto-suave"
                }
              >
                {prontos.includes(p.id) ? "✓" : "…"} {p.apelido}
              </Etiqueta>
            </li>
          ))}
        </ul>

        {souAnfitriao && (
          <Botao
            variante="fantasma"
            largo
            onClick={() => void acao(() => chamar("csc_forcar_inicio", { p_rodada: rodada.id }))}
          >
            Começar mesmo assim
          </Botao>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------- votação */

  if (fase === "votacao") {
    const feitas = rodada.estado.avaliacoes_feitas ?? 0;
    const esperadas = rodada.estado.avaliacoes_esperadas ?? 0;

    return (
      <div className="flex flex-col gap-4">
        <Cartao className="text-center">
          <h2 className="fonte-titulo text-2xl text-roxo-900">Valeu ou não valeu?</h2>
          <p className="mt-1 text-texto-suave">
            Avalie em segredo cada palavra da cadeia — menos as suas.
          </p>

          <div className="mt-3 flex items-center justify-center gap-4">
            <div className="rounded-full bg-superficie-2 px-4 py-2">
              <span className="numeros-fixos fonte-titulo text-lg font-extrabold text-roxo-700">
                {feitas}/{esperadas}
              </span>
              <span className="ml-2 text-sm font-bold text-texto-suave">avaliações</span>
            </div>
            {rodada.turno_fim && (
              <Cronometro segundos={segundos} total={totalSegundos || 120} tamanho="sm" rotulo="" />
            )}
          </div>
        </Cartao>

        <ol className="flex flex-col gap-3">
          {historico.map((item, i) => {
            if (!item.autor_id) return null;

            const souAutor = item.autor_id === eu.id;
            const escolha = meusVotos[i];

            return (
              <li key={i}>
                <Cartao className={souAutor ? "bg-superficie-2" : ""}>
                  <p className="fonte-titulo text-lg font-bold text-roxo-900">{item.palavra}</p>
                  <p className="text-sm text-texto-suave">por {item.autor}</p>

                  {souAutor ? (
                    <p className="mt-2 text-sm text-texto-fraco">
                      Sua palavra — você não avalia a sua.
                    </p>
                  ) : (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {(
                        [
                          { valor: "valeu" as const, rotulo: "Valeu ✓", cor: "verde" },
                          { valor: "neutro" as const, rotulo: "Neutro", cor: "cinza" },
                          { valor: "nao_valeu" as const, rotulo: "Não valeu ✗", cor: "coral" }
                        ]
                      ).map((opcao) => {
                        const selecionada = escolha === opcao.valor;
                        const cores =
                          opcao.cor === "verde"
                            ? "border-verde-600 bg-verde-100 text-verde-600"
                            : opcao.cor === "coral"
                              ? "border-coral-600 bg-coral-100 text-coral-600"
                              : "border-borda-forte bg-superficie-2 text-texto-suave";

                        return (
                          <button
                            key={opcao.valor}
                            type="button"
                            disabled={Boolean(escolha)}
                            onClick={() => void votar(i, opcao.valor)}
                            className={[
                              "min-h-[44px] rounded-[var(--radius-suave)] border-2 px-2 text-sm font-bold transition-colors",
                              selecionada ? cores : "border-borda bg-white",
                              escolha ? "cursor-default" : "active:scale-[0.97]"
                            ].join(" ")}
                          >
                            {opcao.rotulo}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Cartao>
              </li>
            );
          })}
        </ol>

        {souAnfitriao && feitas < esperadas && (
          <Botao
            variante="secundario"
            largo
            onClick={() =>
              void acao(() => chamar("csc_revelar", { p_rodada: rodada.id }), "Revelado!")
            }
          >
            Revelar agora (sem esperar todo mundo)
          </Botao>
        )}
      </div>
    );
  }

  /* ----------------------------------------------------- em_andamento */

  return (
    <div className="flex flex-col gap-4">
      <Cartao className="bg-linear-to-br from-roxo-100 to-superficie-2 text-center">
        <p className="text-xs font-extrabold uppercase tracking-widest text-roxo-700">
          Palavra da vez
        </p>
        <p className="mt-1 fonte-titulo text-3xl font-extrabold text-roxo-900 sm:text-4xl">
          {rodada.estado.palavra_atual}
        </p>
        <p className="mt-2 text-sm text-texto-suave">
          Nem C, nem S, nem composta — e ligada a essa palavra.
        </p>
      </Cartao>

      <p className="text-center text-sm font-bold text-texto-suave">
        Rodada {Math.min(rodadaAtual + 1, metaRodadas)} de {metaRodadas}
      </p>

      <Cartao className={minhaVez ? "border-2 border-roxo-600 bg-roxo-50" : ""}>
        <div className="flex flex-col items-center gap-3">
          <Cronometro segundos={segundos} total={totalSegundos || 10} tamanho="md" />

          {minhaVez ? (
            <form onSubmit={enviar} className="w-full">
              <label htmlFor="palavra-csc" className="mb-1.5 block text-center font-bold">
                Sua palavra (nem C, nem S, nem composta)
              </label>
              <input
                id="palavra-csc"
                value={palavra}
                onChange={(e) => setPalavra(e.target.value)}
                maxLength={30}
                autoFocus
                autoComplete="off"
                placeholder="sua palavra"
                className="min-h-[56px] w-full rounded-[var(--radius-suave)] border-2 border-borda-forte px-4 text-center fonte-titulo text-xl transition-colors focus:border-roxo-600 focus:outline-none"
              />
              <Botao type="submit" grande largo className="mt-3" disabled={!palavra.trim()}>
                Enviar →
              </Botao>
            </form>
          ) : (
            <div className="text-center">
              <p className="fonte-titulo text-xl text-roxo-900">
                É a vez de {jogadorDaVez?.apelido ?? "—"}
              </p>
              <p className="mt-1 text-texto-suave">
                A palavra vai para a votação anônima no fim das rodadas.
              </p>

              {souAnfitriao && jogadorDaVez && !jogadorDaVez.conectado && (
                <Botao
                  variante="secundario"
                  className="mt-3"
                  onClick={() => void acao(() => chamar("pular_vez", { p_rodada: rodada.id }))}
                >
                  Pular a vez de {jogadorDaVez.apelido} (desconectado)
                </Botao>
              )}
            </div>
          )}
        </div>
      </Cartao>

      <section aria-labelledby="titulo-cadeia">
        <h2 id="titulo-cadeia" className="mb-2 fonte-titulo text-lg text-roxo-900">
          A cadeia até agora
        </h2>
        <ol className="flex flex-col gap-2">
          {[...historico]
            .slice(-6)
            .reverse()
            .map((item, i) => (
              <li
                key={`${item.palavra}-${i}`}
                className={[
                  "flex items-center gap-3 rounded-[var(--radius-suave)] border px-3 py-2",
                  i === 0 ? "border-roxo-500 bg-roxo-100/40" : "border-borda bg-white"
                ].join(" ")}
              >
                <span className="fonte-titulo text-lg font-bold text-roxo-900">{item.palavra}</span>
                <span className="ml-auto text-sm text-texto-suave">{item.autor ?? "sorteada"}</span>
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}

function Resultado({ rodada }: PropsJogo) {
  const avaliacoes = rodada.resultado?.avaliacoes ?? [];

  if (avaliacoes.length === 0) {
    return <p className="mt-2 text-texto-suave">Ninguém escreveu uma palavra sequer dessa vez.</p>;
  }

  return (
    <div className="mt-3">
      <ul className="flex flex-col gap-2 text-left">
        {avaliacoes.map((a) => (
          <li
            key={a.indice}
            className="rounded-[var(--radius-suave)] border border-borda bg-white p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="fonte-titulo text-lg font-bold text-roxo-900">{a.palavra}</span>
              <Etiqueta
                className={
                  a.delta > 0
                    ? "bg-verde-100 text-verde-600"
                    : a.delta < 0
                      ? "bg-coral-100 text-coral-600"
                      : "bg-superficie-2 text-texto-suave"
                }
              >
                {a.delta > 0 ? `+${a.delta}` : a.delta}
              </Etiqueta>
            </div>
            <p className="text-sm text-texto-suave">
              por {a.autor} · {a.valeu} valeu · {a.nao_valeu} não valeu · {a.neutro} neutro
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const csComposto: ModuloJogo = {
  id: "c-s-composto",
  Componente,
  Resultado,
  escondeVezDe: true
};
