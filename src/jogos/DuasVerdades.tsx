import { useEffect, useState, type FormEvent } from "react";
import { chamar } from "../lib/supabase";
import { Botao, Cartao, Etiqueta } from "../componentes/Base";
import { Cronometro } from "../componentes/Cronometro";
import { type ModuloJogo, type PropsJogo } from "./tipos";

/**
 * Duas Verdades e Uma Mentira — três fases bem separadas.
 *
 *   escrevendo → só quem está na vez escreve, numa tela que ninguém mais vê
 *   votacao    → as frases aparecem embaralhadas; o voto é secreto
 *   resultado  → revela tudo de uma vez
 *
 * Durante a votação a mesa vê apenas o CONTADOR de votos. Quem votou em quê
 * fica guardado com `revelado = false`, e a política de RLS só libera essas
 * linhas depois da revelação — nem inspecionando a rede dá para adiantar.
 */

function Componente(props: PropsJogo) {
  const { rodada, minhaVez, jogadorDaVez, acao, segundos, totalSegundos, eu, souAnfitriao } = props;

  const [frases, setFrases] = useState(["", "", ""]);
  const [mentira, setMentira] = useState<number | null>(null);
  const [meuVoto, setMeuVoto] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  const fase = rodada.fase;
  const votos = rodada.estado.votos ?? 0;
  const totalVotantes = rodada.estado.total_votantes ?? 0;

  useEffect(() => {
    setFrases(["", "", ""]);
    setMentira(null);
    setMeuVoto(null);
  }, [rodada.id, rodada.vez_de]);

  // Estourou o tempo da votação: revela com o que tiver
  useEffect(() => {
    if (fase !== "votacao" || segundos > 0 || !rodada.turno_fim) return;
    if (!souAnfitriao) return;

    const id = setTimeout(() => {
      void acao(() => chamar("duas_verdades_revelar", { p_rodada: rodada.id }));
    }, 300);

    return () => clearTimeout(id);
  }, [fase, segundos, rodada.turno_fim, rodada.id, acao, souAnfitriao]);

  async function enviarFrases(e: FormEvent) {
    e.preventDefault();
    if (mentira === null) return;

    setEnviando(true);
    await acao(
      () =>
        chamar("duas_verdades_enviar", {
          p_rodada: rodada.id,
          p_frases: frases.map((f) => f.trim()),
          p_indice_mentira: mentira
        }),
      "Frases na mesa! Agora é com eles 😏"
    );
    setEnviando(false);
  }

  /* ------------------------------------------------------ Fase: escrever */

  if (fase === "escrevendo") {
    if (!minhaVez) {
      return (
        <Cartao className="text-center">
          <p className="text-5xl" aria-hidden="true">✍️</p>
          <p className="mt-3 fonte-titulo text-2xl text-roxo-900">
            {jogadorDaVez?.apelido ?? "Alguém"} está escrevendo
          </p>
          <p className="mt-1 text-texto-suave">
            Duas verdades e uma mentira sobre {jogadorDaVez?.apelido ?? "essa pessoa"}. Já vai dar
            para desconfiar.
          </p>

          {rodada.estado.tema && (
            <p className="mt-4">
              <Etiqueta className="bg-coral-100 text-coral-600">
                Tema: {rodada.estado.tema}
              </Etiqueta>
            </p>
          )}

          {rodada.turno_fim && (
            <div className="mt-4 flex justify-center">
              <Cronometro segundos={segundos} total={totalSegundos || 120} tamanho="sm" />
            </div>
          )}
        </Cartao>
      );
    }

    const prontoParaEnviar = frases.every((f) => f.trim().length >= 2) && mentira !== null;

    return (
      <form onSubmit={enviarFrases} className="flex flex-col gap-4">
        <Cartao className="border-2 border-coral-600 bg-coral-100/40">
          <p className="text-center text-xs font-extrabold uppercase tracking-widest text-coral-600">
            Tela privada — ninguém mais está vendo
          </p>
          <h2 className="mt-1 text-center fonte-titulo text-2xl text-roxo-900">
            Escreva três frases sobre você
          </h2>
          {rodada.estado.tema && (
            <p className="mt-2 text-center text-texto-suave">
              Sugestão de tema: <strong>{rodada.estado.tema}</strong>
            </p>
          )}
        </Cartao>

        {frases.map((frase, i) => (
          <Cartao key={i} className={mentira === i ? "border-2 border-coral-600" : ""}>
            <label htmlFor={`frase-${i}`} className="mb-1.5 block font-bold">
              Frase {i + 1}
            </label>
            <textarea
              id={`frase-${i}`}
              value={frase}
              onChange={(e) => {
                const copia = [...frases];
                copia[i] = e.target.value;
                setFrases(copia);
              }}
              maxLength={140}
              rows={2}
              placeholder="Ex.: já morei em outro país"
              className="w-full resize-none rounded-[var(--radius-suave)] border-2 border-borda-forte p-3 transition-colors focus:border-coral-600 focus:outline-none"
            />

            <label className="mt-2 flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="mentira"
                checked={mentira === i}
                onChange={() => setMentira(i)}
                className="h-6 w-6 accent-[var(--color-coral-600)]"
              />
              <span className="font-bold">
                Esta é a <span className="text-coral-600">mentira</span>
              </span>
            </label>
          </Cartao>
        ))}

        <Botao type="submit" grande largo disabled={!prontoParaEnviar} carregando={enviando}>
          Mandar para a mesa
        </Botao>

        {!prontoParaEnviar && (
          <p className="text-center text-sm text-texto-fraco">
            Preencha as três frases e marque qual é a mentira.
          </p>
        )}
      </form>
    );
  }

  /* ------------------------------------------------------- Fase: votação */

  const frasesNaMesa = rodada.estado.frases ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Cartao className="text-center">
        <h2 className="fonte-titulo text-2xl text-roxo-900">
          Qual delas <span className="text-coral-600">{jogadorDaVez?.apelido}</span> inventou?
        </h2>
        <p className="mt-1 text-texto-suave">
          {minhaVez
            ? "Você escreveu. Agora é só assistir à mesa se confundir."
            : "Converse com a mesa e vote em segredo."}
        </p>

        <div className="mt-4 flex items-center justify-center gap-4">
          <div className="rounded-full bg-superficie-2 px-4 py-2">
            <span className="numeros-fixos fonte-titulo text-xl font-extrabold text-roxo-700">
              {votos}/{totalVotantes}
            </span>
            <span className="ml-2 text-sm font-bold text-texto-suave">votaram</span>
          </div>

          {rodada.turno_fim && (
            <Cronometro segundos={segundos} total={totalSegundos || 60} tamanho="sm" rotulo="" />
          )}
        </div>
      </Cartao>

      <ul className="flex flex-col gap-3">
        {frasesNaMesa.map((frase, i) => {
          const escolhida = meuVoto === i;

          return (
            <li key={i}>
              <button
                disabled={minhaVez || meuVoto !== null}
                onClick={async () => {
                  setMeuVoto(i);
                  const r = await acao(
                    () => chamar("duas_verdades_votar", { p_rodada: rodada.id, p_indice: i }),
                    "Voto registrado 🤫"
                  );
                  if (r === null) setMeuVoto(null);
                }}
                className={[
                  "w-full rounded-[var(--radius-card)] border-2 p-4 text-left transition-all",
                  escolhida
                    ? "border-coral-600 bg-coral-100"
                    : "border-borda bg-white hover:border-coral-600",
                  minhaVez || meuVoto !== null ? "cursor-default" : "active:scale-[0.99]"
                ].join(" ")}
              >
                <span className="flex items-start gap-3">
                  <span
                    className={[
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full fonte-titulo font-extrabold",
                      escolhida ? "bg-coral-600 text-white" : "bg-superficie-2 text-texto-suave"
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-lg">{frase}</span>
                  {escolhida && <span aria-label="Seu voto">✓</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {minhaVez && (
        <p className="rounded-[var(--radius-suave)] bg-superficie-2 p-4 text-center text-texto-suave">
          Você não vota nas próprias frases. Segure a risada.
        </p>
      )}

      {meuVoto !== null && !minhaVez && (
        <p className="rounded-[var(--radius-suave)] bg-verde-100 p-4 text-center font-bold text-verde-600">
          Voto registrado. Ninguém vê em quem você votou até a revelação.
        </p>
      )}

      {souAnfitriao && votos < totalVotantes && (
        <Botao
          variante="secundario"
          largo
          onClick={() =>
            void acao(
              () => chamar("duas_verdades_revelar", { p_rodada: rodada.id }),
              "Revelado!"
            )
          }
        >
          Revelar agora (sem esperar todo mundo)
        </Botao>
      )}

      <p className="text-center text-sm text-texto-fraco">
        Você é {eu.apelido} · {eu.pontos} {eu.pontos === 1 ? "ponto" : "pontos"}
      </p>
    </div>
  );
}

function Resultado({ rodada }: PropsJogo) {
  const r = rodada.resultado;
  if (!r) return null;

  const frases = rodada.estado.frases ?? [];

  return (
    <div className="mt-3">
      <p className="text-texto-suave">
        A mentira de <strong>{r.autor}</strong> era:
      </p>
      <p className="mt-2 rounded-[var(--radius-suave)] bg-coral-100 p-4 fonte-titulo text-xl text-coral-600">
        “{frases[r.mentira ?? 0]}”
      </p>

      <div className="mt-4 flex justify-center gap-6">
        <div>
          <p className="numeros-fixos fonte-titulo text-3xl font-extrabold text-verde-600">
            {r.acertos ?? 0}
          </p>
          <p className="text-sm text-texto-suave">acertaram</p>
        </div>
        <div>
          <p className="numeros-fixos fonte-titulo text-3xl font-extrabold text-coral-600">
            {r.enganados ?? 0}
          </p>
          <p className="text-sm text-texto-suave">caíram</p>
        </div>
      </div>

      {(r.votos?.length ?? 0) > 0 && (
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {r.votos!.map((v, i) => (
            <li key={i}>
              <Etiqueta
                className={
                  v.acertou ? "bg-verde-100 text-verde-600" : "bg-superficie-2 text-texto-suave"
                }
              >
                {v.acertou ? "✓" : "✗"} {v.apelido} votou na {v.voto + 1}
              </Etiqueta>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const duasVerdades: ModuloJogo = {
  id: "duas-verdades",
  Componente,
  Resultado,
  escondeVezDe: true
};
