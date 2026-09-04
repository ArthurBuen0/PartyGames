import { chamar } from "../lib/supabase";
import { Botao, Cartao, Etiqueta } from "../componentes/Base";
import type { ModuloJogo, PropsJogo } from "./tipos";

/**
 * Verdade ou Desafio — com pacote +18 opcional.
 *
 * A carta é sorteada no servidor: o cliente pede "verdade" ou "desafio" e
 * recebe o texto já escolhido. O baralho adulto só entra se a sala tiver o modo
 * ligado E o anfitrião tiver confirmado a maioridade — e a política de RLS nem
 * deixa essas cartas serem lidas por consulta direta.
 *
 * "Não me sinto confortável" fica sempre visível e nunca cobra nada: troca a
 * carta, registra no histórico e segue o jogo.
 */

interface ItemHistorico {
  apelido?: string;
  escolha?: string;
  texto?: string;
  acao?: string;
}

function Componente(props: PropsJogo) {
  const { rodada, minhaVez, jogadorDaVez, acao, estado, souAnfitriao } = props;

  const escolha = rodada.estado.escolha ?? null;
  const carta = rodada.estado.carta ?? null;
  const ehAdulta = rodada.estado.adulto ?? false;
  const modoAdulto = estado.sala.modo_adulto;
  const historico = (rodada.estado.historico ?? []) as ItemHistorico[];

  function sortear(tipo: "verdade" | "desafio", adulto: boolean) {
    void acao(() =>
      chamar("verdade_desafio_sortear", {
        p_rodada: rodada.id,
        p_tipo: tipo,
        p_adulto: adulto
      })
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Nenhuma carta na mesa: hora de escolher */}
      {!carta ? (
        <>
          <Cartao className={minhaVez ? "border-2 border-verde-600 bg-verde-100/40" : ""}>
            <p className="text-center fonte-titulo text-2xl text-roxo-900">
              {minhaVez ? "Verdade ou desafio?" : `${jogadorDaVez?.apelido} está escolhendo…`}
            </p>

            {minhaVez && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => sortear("verdade", false)}
                    className="flex min-h-[110px] flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] bg-roxo-600 fonte-titulo text-xl font-extrabold text-white transition-transform active:scale-95"
                  >
                    <span aria-hidden="true" className="text-3xl">💬</span>
                    Verdade
                  </button>

                  <button
                    onClick={() => sortear("desafio", false)}
                    className="flex min-h-[110px] flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] bg-rosa-500 fonte-titulo text-xl font-extrabold text-white transition-transform active:scale-95"
                  >
                    <span aria-hidden="true" className="text-3xl">🔥</span>
                    Desafio
                  </button>
                </div>

                {modoAdulto && (
                  <div className="mt-3">
                    <p className="mb-2 text-center text-sm font-bold text-texto-suave">
                      Ou puxe do baralho +18
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Botao variante="secundario" onClick={() => sortear("verdade", true)}>
                        🔞 Verdade
                      </Botao>
                      <Botao variante="secundario" onClick={() => sortear("desafio", true)}>
                        🔞 Desafio
                      </Botao>
                    </div>
                  </div>
                )}
              </>
            )}
          </Cartao>

          {modoAdulto && (
            <p className="rounded-[var(--radius-suave)] bg-rosa-100 p-3 text-center text-sm font-bold text-rosa-600">
              Modo +18 ligado nesta sala. Ninguém é obrigado a nada — qualquer carta pode ser
              trocada sem explicação.
            </p>
          )}
        </>
      ) : (
        /* Carta na mesa: todo mundo lê */
        <Cartao
          className={[
            "surgir text-center",
            escolha === "verdade" ? "bg-roxo-100" : "bg-rosa-100",
            ehAdulta ? "border-2 border-rosa-500" : ""
          ].join(" ")}
        >
          <div className="flex items-center justify-center gap-2">
            <Etiqueta
              className={
                escolha === "verdade" ? "bg-roxo-600 text-white" : "bg-rosa-500 text-white"
              }
            >
              {escolha === "verdade" ? "💬 Verdade" : "🔥 Desafio"}
            </Etiqueta>
            {ehAdulta && <Etiqueta className="bg-rosa-600 text-white">+18</Etiqueta>}
          </div>

          <p className="mt-4 fonte-titulo text-2xl font-extrabold leading-snug text-roxo-900 sm:text-3xl">
            {carta.texto}
          </p>

          <p className="mt-3 text-texto-suave">
            {minhaVez ? "É com você," : "É a vez de"} <strong>{jogadorDaVez?.apelido}</strong>
          </p>

          {minhaVez && (
            <div className="mt-5 flex flex-col gap-2">
              <Botao
                grande
                largo
                onClick={() =>
                  void acao(
                    () =>
                      chamar("verdade_desafio_resolver", {
                        p_rodada: rodada.id,
                        p_acao: "concluir"
                      }),
                    "Mandou bem! 🎉"
                  )
                }
              >
                ✅ Cumpri!
              </Botao>

              <Botao
                variante="secundario"
                largo
                onClick={() => sortear(escolha as "verdade" | "desafio", ehAdulta)}
              >
                🔄 Quero outra carta
              </Botao>

              {/* Sempre visível, sem punição nenhuma */}
              <Botao
                variante="fantasma"
                largo
                onClick={() =>
                  void acao(
                    () =>
                      chamar("verdade_desafio_resolver", {
                        p_rodada: rodada.id,
                        p_acao: "desconfortavel"
                      }),
                    "Tudo bem! Passou a vez, sem cobrança."
                  )
                }
              >
                Não me sinto confortável
              </Botao>
            </div>
          )}
        </Cartao>
      )}

      {souAnfitriao && jogadorDaVez && !jogadorDaVez.conectado && (
        <Botao
          variante="secundario"
          largo
          onClick={() => void acao(() => chamar("pular_vez", { p_rodada: rodada.id }))}
        >
          Pular a vez de {jogadorDaVez.apelido} (desconectado)
        </Botao>
      )}

      {souAnfitriao && modoAdulto && (
        <Botao
          variante="perigo"
          largo
          onClick={() =>
            void acao(
              () => chamar("definir_modo_adulto", { p_sala: estado.sala.id, p_ativo: false }),
              "Modo +18 desligado"
            )
          }
        >
          Desligar o modo +18 agora
        </Botao>
      )}

      {/* Histórico da rodada */}
      {historico.length > 0 && (
        <section aria-labelledby="titulo-historico-vd">
          <h2 id="titulo-historico-vd" className="mb-2 fonte-titulo text-lg text-roxo-900">
            O que já rolou
          </h2>
          <ul className="flex flex-col gap-2">
            {[...historico].reverse().slice(0, 6).map((item, i) => (
              <li
                key={i}
                className="rounded-[var(--radius-suave)] border border-borda bg-white p-3 text-sm"
              >
                <span className="font-bold">{item.apelido}</span>{" "}
                <span className="text-texto-suave">
                  {item.acao === "concluir"
                    ? "cumpriu"
                    : item.acao === "desconfortavel"
                      ? "preferiu passar"
                      : "pulou"}{" "}
                  · {item.escolha}
                </span>
                {item.texto && (
                  <span className="mt-1 block text-texto-fraco">“{item.texto}”</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const verdadeOuDesafio: ModuloJogo = {
  id: "verdade-ou-desafio",
  Componente,
  escondeVezDe: true
};
