import { useMemo, useState, type FormEvent } from "react";
import { chamar } from "../lib/supabase";
import { Botao, Cartao, Etiqueta } from "../componentes/Base";
import { RostoPersonagem } from "../componentes/RostoPersonagem";
import { ModalConfirmacao } from "../componentes/Modais";
import type { Personagem, PersonagemNoPainel } from "../lib/tipos";
import { meuPrivado, type ModuloJogo, type PropsJogo } from "./tipos";

/**
 * Cara a Cara — duelos em duplas, cada um na sua mesa.
 *
 * Três camadas de visibilidade convivem aqui:
 *
 *   painel de personagens  → igual para a sala inteira (vem em partida.config)
 *   pergunta e resposta    → públicas dentro da mesa, e a sala acompanha o placar
 *   personagem secreto     → só o dono (RLS)
 *   marcas de eliminado    → só o dono (RLS) — o adversário não vê seu raciocínio
 *
 * Com mais de duas pessoas, o servidor monta várias mesas em paralelo e quem
 * sobra (número ímpar) assiste ao andamento de todas.
 */

function Componente(props: PropsJogo) {
  const { estado, eu, acao, privados } = props;

  const [pergunta, setPergunta] = useState("");
  const [palpitando, setPalpitando] = useState<PersonagemNoPainel | null>(null);

  const painel = (estado.partida?.config?.painel ?? []) as PersonagemNoPainel[];
  const meuDuelo = estado.duelos.find((d) => d.jogador_a === eu.id || d.jogador_b === eu.id) ?? null;

  const meuPersonagem = meuPrivado(privados, eu.id, "personagem")?.conteudo as
    | (Personagem & { carta_id?: string })
    | undefined;

  const eliminados = useMemo(() => {
    const bruto = meuPrivado(privados, eu.id, "eliminados")?.conteudo?.ids;
    return new Set(Array.isArray(bruto) ? (bruto as string[]) : []);
  }, [privados, eu.id]);

  const apelidoDe = (id: string | null) =>
    estado.participantes.find((p) => p.id === id)?.apelido ?? "—";

  /* ------------------------------------------------- Quem só está olhando */

  if (!meuDuelo) {
    return (
      <div className="flex flex-col gap-4">
        <Cartao className="text-center">
          <p className="text-4xl" aria-hidden="true">👀</p>
          <p className="mt-2 fonte-titulo text-xl text-roxo-900">Você está de fora nesta rodada</p>
          <p className="mt-1 text-texto-suave">
            O número de pessoas é ímpar, então você assiste às mesas. Na próxima rodada as duplas
            mudam.
          </p>
        </Cartao>
        <PlacarDasMesas duelos={estado.duelos} apelidoDe={apelidoDe} />
      </div>
    );
  }

  const souA = meuDuelo.jogador_a === eu.id;
  const adversarioId = souA ? meuDuelo.jogador_b : meuDuelo.jogador_a;
  const minhaVezNaMesa = meuDuelo.vez_de === eu.id;
  const encerrado = meuDuelo.fase === "encerrado";
  const euVenci = meuDuelo.vencedor_id === eu.id;

  async function enviarPergunta(e: FormEvent) {
    e.preventDefault();
    if (pergunta.trim().length < 3) return;

    await acao(() =>
      chamar("cara_a_cara_perguntar", { p_duelo: meuDuelo!.id, p_pergunta: pergunta.trim() })
    );
    setPergunta("");
  }

  function alternarEliminado(carta: PersonagemNoPainel) {
    const marcado = !eliminados.has(carta.id);
    void acao(() =>
      chamar("cara_a_cara_eliminar", {
        p_duelo: meuDuelo!.id,
        p_carta_id: carta.id,
        p_marcado: marcado
      })
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Mesa encerrada */}
      {encerrado && (
        <Cartao
          className={
            euVenci ? "border-2 border-verde-600 bg-verde-100/50" : "border-2 border-coral-600"
          }
        >
          <p className="text-center text-4xl" aria-hidden="true">{euVenci ? "🏆" : "😅"}</p>
          <p className="mt-2 text-center fonte-titulo text-2xl text-roxo-900">
            {euVenci ? "Você venceu a mesa!" : `${apelidoDe(meuDuelo.vencedor_id)} venceu a mesa`}
          </p>
          <p className="mt-1 text-center text-texto-suave">{meuDuelo.motivo_fim}</p>
        </Cartao>
      )}

      {/* Meu personagem secreto */}
      {meuPersonagem && (
        <Cartao className="border-2 border-azul-600 bg-azul-100/40">
          <p className="text-center text-xs font-extrabold uppercase tracking-widest text-azul-600">
            Seu personagem — {apelidoDe(adversarioId)} precisa adivinhar
          </p>
          <div className="mt-2 flex items-center justify-center gap-4">
            <RostoPersonagem personagem={meuPersonagem} className="h-24 w-24" />
            <div>
              <p className="fonte-titulo text-2xl font-extrabold text-roxo-900">
                {meuPersonagem.nome}
              </p>
              <p className="text-sm text-texto-suave">Não mostre para o adversário!</p>
            </div>
          </div>
        </Cartao>
      )}

      {/* Turno da mesa */}
      {!encerrado && (
        <Cartao className={minhaVezNaMesa ? "border-2 border-azul-600" : ""}>
          {meuDuelo.fase === "perguntando" ? (
            minhaVezNaMesa ? (
              <form onSubmit={enviarPergunta}>
                <label htmlFor="pergunta" className="mb-1.5 block font-bold">
                  Sua pergunta de sim ou não
                </label>
                <input
                  id="pergunta"
                  value={pergunta}
                  onChange={(e) => setPergunta(e.target.value)}
                  maxLength={80}
                  autoComplete="off"
                  placeholder="Seu personagem usa óculos?"
                  className="min-h-[52px] w-full rounded-[var(--radius-suave)] border-2 border-borda-forte px-4 transition-colors focus:border-azul-600 focus:outline-none"
                />
                <Botao type="submit" largo className="mt-3" disabled={pergunta.trim().length < 3}>
                  Perguntar
                </Botao>
              </form>
            ) : (
              <p className="text-center fonte-titulo text-lg text-roxo-900">
                {apelidoDe(meuDuelo.vez_de)} está montando a pergunta…
              </p>
            )
          ) : (
            /* Fase: respondendo */
            <>
              <p className="text-center text-xs font-extrabold uppercase tracking-widest text-texto-fraco">
                Pergunta de {apelidoDe(meuDuelo.vez_de)}
              </p>
              <p className="mt-1 text-center fonte-titulo text-xl text-roxo-900">
                “{meuDuelo.pergunta_atual}”
              </p>

              {!minhaVezNaMesa ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={() =>
                      void acao(() =>
                        chamar("cara_a_cara_responder", {
                          p_duelo: meuDuelo.id,
                          p_resposta: "sim"
                        })
                      )
                    }
                    className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-[var(--radius-suave)] bg-verde-600 fonte-titulo text-lg font-extrabold text-white transition-transform active:scale-95"
                  >
                    <span aria-hidden="true" className="text-2xl">👍</span> Sim
                  </button>
                  <button
                    onClick={() =>
                      void acao(() =>
                        chamar("cara_a_cara_responder", {
                          p_duelo: meuDuelo.id,
                          p_resposta: "nao"
                        })
                      )
                    }
                    className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-[var(--radius-suave)] bg-coral-600 fonte-titulo text-lg font-extrabold text-white transition-transform active:scale-95"
                  >
                    <span aria-hidden="true" className="text-2xl">👎</span> Não
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-center text-texto-suave">
                  Esperando {apelidoDe(adversarioId)} responder…
                </p>
              )}
            </>
          )}
        </Cartao>
      )}

      {/* Painel de personagens */}
      <section aria-labelledby="titulo-painel">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="titulo-painel" className="fonte-titulo text-lg text-roxo-900">
            Painel de personagens
          </h2>
          <Etiqueta>
            {painel.length - eliminados.size} de {painel.length} em pé
          </Etiqueta>
        </div>

        <p className="mb-3 text-sm text-texto-suave">
          Toque para descartar. Suas marcas são particulares — o adversário não vê.
        </p>

        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {painel.map((carta) => {
            const fora = eliminados.has(carta.id);

            return (
              <li key={carta.id}>
                <div
                  className={[
                    "flex flex-col overflow-hidden rounded-[var(--radius-suave)] border-2 bg-white transition-all",
                    fora ? "border-borda" : "border-azul-600/30"
                  ].join(" ")}
                >
                  <button
                    onClick={() => alternarEliminado(carta)}
                    aria-pressed={fora}
                    aria-label={`${fora ? "Trazer de volta" : "Descartar"} ${carta.p.nome}`}
                    className="p-1"
                  >
                    <RostoPersonagem personagem={carta.p} eliminado={fora} className="w-full" />
                    <span
                      className={[
                        "block truncate px-1 pb-1 text-center text-xs font-bold",
                        fora ? "text-texto-fraco line-through" : "text-texto"
                      ].join(" ")}
                    >
                      {carta.p.nome}
                    </span>
                  </button>

                  {!encerrado && !fora && (
                    <button
                      onClick={() => setPalpitando(carta)}
                      className="min-h-[44px] border-t border-borda px-1 text-xs font-extrabold text-azul-600 transition-colors hover:bg-azul-100"
                    >
                      É esse!
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Histórico da mesa */}
      {meuDuelo.historico.length > 0 && (
        <section aria-labelledby="titulo-historico-cc">
          <h2 id="titulo-historico-cc" className="mb-2 fonte-titulo text-lg text-roxo-900">
            Perguntas da mesa
          </h2>
          <ul className="flex flex-col gap-2">
            {[...meuDuelo.historico].reverse().map((h, i) => (
              <li
                key={i}
                className="rounded-[var(--radius-suave)] border border-borda bg-white p-3 text-sm"
              >
                {h.palpite ? (
                  <span className={h.acertou ? "text-verde-600" : "text-coral-600"}>
                    <strong>{h.de}</strong> chutou {h.palpite} —{" "}
                    {h.acertou ? "acertou!" : "errou"}
                  </span>
                ) : (
                  <>
                    <span className="text-texto-suave">“{h.pergunta}”</span>{" "}
                    <strong
                      className={h.resposta === "sim" ? "text-verde-600" : "text-coral-600"}
                    >
                      {h.resposta === "sim" ? "SIM" : "NÃO"}
                    </strong>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {estado.duelos.length > 1 && (
        <PlacarDasMesas duelos={estado.duelos} apelidoDe={apelidoDe} />
      )}

      <ModalConfirmacao
        aberto={Boolean(palpitando)}
        aoFechar={() => setPalpitando(null)}
        titulo="Confirmar palpite"
        textoConfirmar="É esse mesmo!"
        mensagem={
          <div className="text-center">
            {palpitando && (
              <RostoPersonagem personagem={palpitando.p} className="mx-auto h-28 w-28" />
            )}
            <p className="mt-2 fonte-titulo text-xl text-roxo-900">{palpitando?.p.nome}</p>
            <p className="mt-2">
              Se errar, <strong>{apelidoDe(adversarioId)}</strong> vence a mesa na hora. Certeza?
            </p>
          </div>
        }
        aoConfirmar={() => {
          const alvo = palpitando;
          setPalpitando(null);
          if (alvo) {
            void acao(() =>
              chamar("cara_a_cara_palpite", { p_duelo: meuDuelo.id, p_carta_id: alvo.id })
            );
          }
        }}
      />
    </div>
  );
}

/** Andamento de todas as mesas — o que a sala inteira acompanha. */
function PlacarDasMesas({
  duelos,
  apelidoDe
}: {
  duelos: PropsJogo["estado"]["duelos"];
  apelidoDe: (id: string | null) => string;
}) {
  return (
    <section aria-labelledby="titulo-mesas">
      <h2 id="titulo-mesas" className="mb-2 fonte-titulo text-lg text-roxo-900">
        Andamento das mesas
      </h2>
      <ul className="flex flex-col gap-2">
        {duelos.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-center gap-2 rounded-[var(--radius-suave)] border border-borda bg-white p-3"
          >
            <Etiqueta className="bg-azul-100 text-azul-600">Mesa {d.mesa}</Etiqueta>
            <span className="font-bold">
              {apelidoDe(d.jogador_a)} <span className="text-texto-fraco">vs</span>{" "}
              {apelidoDe(d.jogador_b)}
            </span>
            <span className="ml-auto text-sm text-texto-suave">
              {d.fase === "encerrado" ? (
                <strong className="text-verde-600">🏆 {apelidoDe(d.vencedor_id)}</strong>
              ) : (
                <>
                  {d.historico.length} {d.historico.length === 1 ? "pergunta" : "perguntas"} · vez
                  de {apelidoDe(d.vez_de)}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const caraACara: ModuloJogo = {
  id: "cara-a-cara",
  Componente,
  escondeVezDe: true
};
