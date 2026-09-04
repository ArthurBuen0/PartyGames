import { useEffect, useState, type FormEvent } from "react";
import { chamar } from "../lib/supabase";
import { Botao, Cartao } from "../componentes/Base";
import { Cronometro } from "../componentes/Cronometro";
import type { ModuloJogo, PropsJogo } from "./tipos";

/**
 * Palavra Parecida — corrente de associações com 5 segundos por vez.
 *
 * Quem está na vez digita a palavra antes de passar adiante: é isso que mantém
 * o histórico visível para a mesa inteira e evita a discussão de "quem falou o
 * quê" três rodadas depois.
 */

interface ItemHistorico {
  palavra?: string;
  autor?: string | null;
}

function Componente(props: PropsJogo) {
  const { rodada, minhaVez, jogadorDaVez, acao, segundos, totalSegundos, souAnfitriao } = props;
  const [palavra, setPalavra] = useState("");

  const emAndamento = rodada.fase === "em_andamento";
  const historico = (rodada.estado.historico ?? []) as ItemHistorico[];
  const ultimas = [...historico].slice(-6).reverse();

  // Campo limpo a cada troca de vez
  useEffect(() => {
    setPalavra("");
  }, [rodada.vez_de]);

  useEffect(() => {
    if (!emAndamento || segundos > 0 || !rodada.turno_fim) return;

    const id = setTimeout(() => {
      void acao(() => chamar("registrar_timeout", { p_rodada: rodada.id }));
    }, 150 + Math.random() * 350);

    return () => clearTimeout(id);
  }, [emAndamento, segundos, rodada.turno_fim, rodada.id, acao]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    await acao(() =>
      chamar("avancar_turno", {
        p_rodada: rodada.id,
        p_palavra: palavra.trim() || null
      })
    );
    setPalavra("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* A palavra da vez */}
      <Cartao className="bg-linear-to-br from-rosa-100 to-superficie-2 text-center">
        <p className="text-xs font-extrabold uppercase tracking-widest text-rosa-600">
          Palavra da vez
        </p>
        <p className="mt-1 fonte-titulo text-3xl font-extrabold text-roxo-900 sm:text-4xl">
          {rodada.estado.palavra_atual}
        </p>
        <p className="mt-2 text-sm text-texto-suave">
          A próxima pessoa fala algo relacionado a esta palavra.
        </p>
      </Cartao>

      {emAndamento && (
        <Cartao className={minhaVez ? "border-2 border-rosa-500 bg-rosa-100/40" : ""}>
          <div className="flex flex-col items-center gap-3">
            <Cronometro segundos={segundos} total={totalSegundos || 5} tamanho="md" />

            {minhaVez ? (
              <form onSubmit={enviar} className="w-full">
                <label htmlFor="palavra" className="mb-1.5 block text-center font-bold">
                  Fale em voz alta e digite aqui
                </label>
                <input
                  id="palavra"
                  value={palavra}
                  onChange={(e) => setPalavra(e.target.value)}
                  maxLength={30}
                  autoFocus
                  autoComplete="off"
                  placeholder="sua palavra"
                  className="min-h-[56px] w-full rounded-[var(--radius-suave)] border-2 border-borda-forte px-4 text-center fonte-titulo text-xl transition-colors focus:border-rosa-500 focus:outline-none"
                />
                <Botao type="submit" grande largo className="mt-3">
                  Próximo jogador →
                </Botao>
              </form>
            ) : (
              <div className="text-center">
                <p className="fonte-titulo text-xl text-roxo-900">
                  É a vez de {jogadorDaVez?.apelido ?? "—"}
                </p>
                <p className="mt-1 text-texto-suave">Ouça e julgue: a associação faz sentido?</p>

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
      )}

      {/* Histórico coletivo */}
      <section aria-labelledby="titulo-corrente">
        <h2 id="titulo-corrente" className="mb-2 fonte-titulo text-lg text-roxo-900">
          A corrente até agora
        </h2>
        <ol className="flex flex-col gap-2">
          {ultimas.map((item, i) => (
            <li
              key={`${item.palavra}-${i}`}
              className={[
                "flex items-center gap-3 rounded-[var(--radius-suave)] border px-3 py-2",
                i === 0 ? "border-rosa-500 bg-rosa-100/40" : "border-borda bg-white"
              ].join(" ")}
            >
              <span className="fonte-titulo text-lg font-bold text-roxo-900">{item.palavra}</span>
              <span className="ml-auto text-sm text-texto-suave">
                {item.autor ?? "sorteada"}
              </span>
            </li>
          ))}
        </ol>
        {historico.length > 6 && (
          <p className="mt-2 text-center text-sm text-texto-fraco">
            e mais {historico.length - 6} antes dessas
          </p>
        )}
      </section>
    </div>
  );
}

function Resultado({ rodada }: PropsJogo) {
  const historico = (rodada.estado.historico ?? []) as ItemHistorico[];

  return (
    <div className="mt-2">
      <p className="text-texto-suave">
        A corrente chegou a <strong>{historico.length}</strong>{" "}
        {historico.length === 1 ? "palavra" : "palavras"}.
      </p>
      <p className="mt-3 text-sm text-texto-fraco">
        {historico.map((h) => h.palavra).join(" → ")}
      </p>
    </div>
  );
}

export const palavraParecida: ModuloJogo = {
  id: "palavra-parecida",
  Componente,
  Resultado,
  AcoesResultado: ({ rodada, acao, souAnfitriao }: PropsJogo) =>
    souAnfitriao && rodada.resultado?.perdedor_id ? (
      <Botao
        variante="secundario"
        largo
        onClick={() =>
          void acao(
            () => chamar("reiniciar_turno", { p_rodada: rodada.id }),
            "Turno reiniciado"
          )
        }
      >
        A associação valeu! Continuar a corrente
      </Botao>
    ) : null,
  escondeVezDe: true
};
