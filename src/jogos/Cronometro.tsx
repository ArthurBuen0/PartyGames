import { useEffect, useRef, useState } from "react";
import { chamar } from "../lib/supabase";
import { Botao, Cartao } from "../componentes/Base";
import { tocarBipe, vibrar } from "../lib/som";
import { meuPrivado, type ModuloJogo, type PropsJogo } from "./tipos";

/**
 * Cronômetro — cada pessoa tenta parar a contagem o mais perto possível do
 * próprio alvo.
 *
 * A contagem em si é 100% local: `performance.now()` no aparelho da pessoa,
 * sem round-trip com o servidor no meio (a rede atrapalharia justamente a
 * precisão que o jogo cobra). O servidor só recebe o tempo final e calcula o
 * erro — nada impede alguém de mandar um número fajuto, mas isso é jogo de
 * confiança entre amigos, igual às cartas viradas dos outros jogos.
 */

type Fase = "mostrando" | "contando";

function formatarMs(ms: number) {
  return (ms / 1000).toFixed(3);
}

function Componente(props: PropsJogo) {
  const { rodada, privados, eu, estado, acao } = props;
  const [fase, setFase] = useState<Fase>("mostrando");
  const inicioRef = useRef<number | null>(null);
  const [ultimoEnvio, setUltimoEnvio] = useState<number | null>(null);

  const alvoPrivado = meuPrivado(privados, eu.id, "alvo_tempo");
  const alvoMs = (alvoPrivado?.conteudo as { alvo_ms?: number } | undefined)?.alvo_ms ?? null;

  const resultados = rodada.estado.resultados ?? [];
  const totalJogadores = rodada.estado.total_jogadores ?? estado.participantes.length;
  const meuResultado = resultados.find((r) => r.participante_id === eu.id);
  const jaMandei = Boolean(meuResultado) || ultimoEnvio !== null;

  useEffect(() => {
    setFase("mostrando");
    inicioRef.current = null;
    setUltimoEnvio(null);
  }, [rodada.id]);

  function iniciar() {
    setFase("contando");
    tocarBipe();
    vibrar(200);
    inicioRef.current = performance.now();
  }

  async function parar() {
    if (inicioRef.current === null) return;
    const decorrido = Math.round(performance.now() - inicioRef.current);
    inicioRef.current = null;
    setUltimoEnvio(decorrido);
    await acao(() => chamar("cronometro_enviar", { p_rodada: rodada.id, p_tempo_ms: decorrido }));
  }

  const ranking = [...resultados].sort((a, b) => a.erro_ms - b.erro_ms);

  return (
    <div className="flex flex-col gap-4">
      {!jaMandei && fase === "mostrando" && (
        <Cartao className="bg-linear-to-br from-roxo-100 to-superficie-2 text-center">
          <p className="text-xs font-extrabold uppercase tracking-widest text-roxo-700">Seu alvo</p>
          <p className="mt-1 numeros-fixos fonte-titulo text-5xl font-extrabold text-roxo-900">
            {alvoMs !== null ? formatarMs(alvoMs) : "—"}
            <span className="ml-1 text-2xl">s</span>
          </p>
          <p className="mt-3 text-texto-suave">
            Decore o tempo. Ao tocar em Iniciar, o número some e um sinal avisa que a contagem
            começou — pare o mais perto que conseguir.
          </p>
          <Botao grande largo className="mt-4" disabled={alvoMs === null} onClick={iniciar}>
            Iniciar
          </Botao>
        </Cartao>
      )}

      {!jaMandei && fase === "contando" && (
        <Cartao className="border-2 border-roxo-600 bg-roxo-50 text-center">
          <p className="text-6xl" aria-hidden="true">
            ⏱️
          </p>
          <p className="mt-3 fonte-titulo text-2xl text-roxo-900">Contando…</p>
          <p className="mt-1 text-texto-suave">Toque em Parar quando achar que chegou no seu alvo.</p>
          <Botao grande largo variante="perigo" className="mt-4" onClick={() => void parar()}>
            Parar
          </Botao>
        </Cartao>
      )}

      {jaMandei && (
        <Cartao className="text-center">
          <p className="fonte-titulo text-xl text-roxo-900">
            Você parou em{" "}
            <strong className="numeros-fixos">
              {formatarMs(meuResultado?.tempo_ms ?? ultimoEnvio ?? 0)}s
            </strong>
          </p>
          {meuResultado && (
            <p className="mt-1 text-texto-suave">
              O alvo era {formatarMs(meuResultado.alvo_ms)}s — errou por{" "}
              <strong className="numeros-fixos">{formatarMs(meuResultado.erro_ms)}s</strong>
            </p>
          )}
          <p className="mt-3 inline-block rounded-full bg-superficie-2 px-4 py-2 text-sm font-bold text-texto-suave">
            {resultados.length}/{totalJogadores} já jogaram
          </p>
        </Cartao>
      )}

      {resultados.length > 0 && (
        <section aria-labelledby="titulo-ranking-cron">
          <h2 id="titulo-ranking-cron" className="mb-2 fonte-titulo text-lg text-roxo-900">
            Quem já jogou
          </h2>
          <ol className="flex flex-col gap-2">
            {ranking.map((r, i) => (
              <li
                key={r.participante_id}
                className={[
                  "flex items-center gap-3 rounded-[var(--radius-suave)] border px-3 py-2",
                  i === 0 ? "border-roxo-500 bg-roxo-100/40" : "border-borda bg-white"
                ].join(" ")}
              >
                <span className="fonte-titulo font-bold text-roxo-900">{r.apelido}</span>
                <span className="ml-auto numeros-fixos text-sm text-texto-suave">
                  errou por {formatarMs(r.erro_ms)}s
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function Resultado({ rodada }: PropsJogo) {
  const resultados = [...(rodada.resultado?.resultados ?? [])].sort((a, b) => a.erro_ms - b.erro_ms);
  const vencedores = new Set(rodada.resultado?.vencedores ?? []);

  if (resultados.length === 0) {
    return <p className="mt-2 text-texto-suave">Ninguém chegou a mandar um tempo dessa vez.</p>;
  }

  return (
    <div className="mt-3">
      <ul className="flex flex-col gap-2 text-left">
        {resultados.map((r) => (
          <li
            key={r.participante_id}
            className={[
              "flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-suave)] border px-3 py-2",
              vencedores.has(r.participante_id)
                ? "border-verde-600 bg-verde-100/40"
                : "border-borda bg-white"
            ].join(" ")}
          >
            <span className="fonte-titulo font-bold text-roxo-900">
              {vencedores.has(r.participante_id) && "🏆 "}
              {r.apelido}
            </span>
            <span className="numeros-fixos text-sm text-texto-suave">
              alvo {formatarMs(r.alvo_ms)}s · parou em {formatarMs(r.tempo_ms)}s · errou{" "}
              {formatarMs(r.erro_ms)}s
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const cronometro: ModuloJogo = {
  id: "cronometro",
  Componente,
  Resultado,
  escondeVezDe: true
};
