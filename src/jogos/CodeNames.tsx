import { useEffect, useState, type FormEvent } from "react";
import { chamar } from "../lib/supabase";
import { Botao, Cartao, Etiqueta } from "../componentes/Base";
import type { TimeCodeNames } from "../lib/tipos";
import { meuPrivado, type ModuloJogo, type PropsJogo } from "./tipos";

/**
 * Code Names — dois times, um tabuleiro de 25 palavras, uma cor verdadeira
 * escondida atrás de cada uma.
 *
 * Só o Spymaster de cada time lê o mapa secreto (`estados_privados`, tipo
 * `mapa_secreto`) — o resto da mesa vê só as palavras, até alguém apontar uma
 * e a cor virar pública. `time_de` é um mapa participante→time: trocar de
 * time é só escolher de novo, sem precisar "sair" de lugar nenhum.
 */

const NOME_TIME: Record<TimeCodeNames, string> = { A: "Time A", B: "Time B" };

const CELULA_REVELADA: Record<string, string> = {
  A: "border-coral-600 bg-coral-500 text-white",
  B: "border-azul-700 bg-azul-600 text-white",
  neutro: "border-borda-forte bg-superficie-2 text-texto-suave",
  bomba: "border-black bg-[#1a1a1a] text-white"
};

const CELULA_DICA: Record<string, string> = {
  A: "border-coral-300 bg-coral-100",
  B: "border-azul-300 bg-azul-100",
  neutro: "border-borda bg-superficie-2",
  bomba: "border-texto-fraco bg-white"
};

interface Palavra {
  indice: number;
  texto: string;
  revelada: boolean;
  cor: TimeCodeNames | "neutro" | "bomba" | null;
}

function Celula({
  palavra,
  corSecreta,
  clicavel,
  onClick
}: {
  palavra: Palavra;
  corSecreta?: string;
  clicavel: boolean;
  onClick: () => void;
}) {
  const classe = palavra.revelada
    ? CELULA_REVELADA[palavra.cor ?? "neutro"]
    : corSecreta
      ? CELULA_DICA[corSecreta]
      : "border-borda bg-white";

  return (
    <button
      type="button"
      disabled={!clicavel || palavra.revelada}
      onClick={onClick}
      className={[
        "relative flex aspect-square items-center justify-center rounded-[var(--radius-suave)] border-2 p-1 text-center text-[10px] font-extrabold uppercase leading-tight transition-all sm:text-xs",
        classe,
        clicavel && !palavra.revelada ? "cursor-pointer active:scale-95" : "cursor-default"
      ].join(" ")}
    >
      {palavra.texto}
      {!palavra.revelada && corSecreta === "bomba" && (
        <span className="absolute right-0.5 top-0.5 text-[10px]" aria-hidden="true">
          💣
        </span>
      )}
    </button>
  );
}

function Componente(props: PropsJogo) {
  const { rodada, estado, privados, eu, souAnfitriao, acao } = props;

  const [palavraDica, setPalavraDica] = useState("");
  const [numeroDica, setNumeroDica] = useState(1);

  const fase = rodada.fase;
  const timeDe = rodada.estado.time_de ?? {};
  const meuTime = timeDe[eu.id] as TimeCodeNames | undefined;
  const spymasterA = rodada.estado.spymaster_a ?? null;
  const spymasterB = rodada.estado.spymaster_b ?? null;
  const souSpymaster = spymasterA === eu.id || spymasterB === eu.id;

  const timeDaVez = rodada.estado.time_da_vez;
  const dicaAtual = rodada.estado.dica_atual ?? null;
  const restantes = rodada.estado.restantes ?? {};
  const palpitesRestantes = rodada.estado.palpites_restantes ?? null;
  const palavras = (rodada.estado.palavras ?? []) as Palavra[];

  const souSpymasterDaVez =
    (timeDaVez === "A" && spymasterA === eu.id) || (timeDaVez === "B" && spymasterB === eu.id);
  const minhaVezDeApontar = Boolean(meuTime) && meuTime === timeDaVez && !souSpymaster && Boolean(dicaAtual);

  const meuMapa = meuPrivado(privados, eu.id, "mapa_secreto");
  const coresSecretas = (meuMapa?.conteudo as { cores?: string[] } | undefined)?.cores;

  useEffect(() => {
    setPalavraDica("");
    setNumeroDica(1);
  }, [timeDaVez, dicaAtual === null]);

  function membrosDoTime(time: TimeCodeNames) {
    return estado.participantes.filter((p) => timeDe[p.id] === time);
  }

  async function enviarDica(e: FormEvent) {
    e.preventDefault();
    const valor = palavraDica.trim();
    if (!valor) return;
    const r = await acao(() =>
      chamar("codenames_dar_dica", { p_rodada: rodada.id, p_palavra: valor, p_numero: numeroDica })
    );
    if (r !== null) setPalavraDica("");
  }

  /* -------------------------------------------------------- preparando */

  if (fase === "preparando") {
    return (
      <div className="flex flex-col gap-4">
        <Cartao className="bg-linear-to-br from-roxo-100 to-superficie-2 text-center">
          <p className="text-5xl" aria-hidden="true">
            🎯
          </p>
          <h2 className="mt-2 fonte-titulo text-2xl text-roxo-900">Formem os times</h2>
          <p className="mt-1 text-texto-suave">
            Escolha um time e, dentro dele, quem vai ser o Spymaster — a pessoa que vê as cores
            verdadeiras e dá as dicas.
          </p>
        </Cartao>

        <div className="grid gap-3 sm:grid-cols-2">
          {(["A", "B"] as const).map((time) => {
            const membros = membrosDoTime(time);
            const spymasterId = time === "A" ? spymasterA : spymasterB;
            const souDoTime = meuTime === time;

            return (
              <Cartao key={time} className={souDoTime ? "border-2 border-roxo-600" : ""}>
                <h3 className="fonte-titulo text-lg text-roxo-900">{NOME_TIME[time]}</h3>
                <ul className="mt-2 flex min-h-[2rem] flex-col gap-1.5">
                  {membros.length === 0 && (
                    <li className="text-sm text-texto-fraco">Ninguém ainda</li>
                  )}
                  {membros.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <span className="font-bold">{m.apelido}</span>
                      {spymasterId === m.id && (
                        <Etiqueta className="bg-roxo-100 text-roxo-700">🔐 Spymaster</Etiqueta>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-col gap-2">
                  <Botao
                    variante="secundario"
                    disabled={souDoTime}
                    onClick={() =>
                      void acao(() => chamar("codenames_entrar_time", { p_rodada: rodada.id, p_time: time }))
                    }
                  >
                    {souDoTime ? "Você está aqui" : `Entrar no ${NOME_TIME[time]}`}
                  </Botao>

                  {souDoTime && (
                    <Botao
                      variante="fantasma"
                      disabled={spymasterId === eu.id}
                      onClick={() =>
                        void acao(() =>
                          chamar("codenames_virar_spymaster", { p_rodada: rodada.id, p_time: time })
                        )
                      }
                    >
                      {spymasterId === eu.id ? "Você é o Spymaster" : "Serei o Spymaster"}
                    </Botao>
                  )}
                </div>
              </Cartao>
            );
          })}
        </div>

        {souAnfitriao && (
          <Botao
            grande
            largo
            onClick={() =>
              void acao(
                () => chamar("codenames_iniciar_tabuleiro", { p_rodada: rodada.id }),
                "Tabuleiro pronto! 🎯"
              )
            }
          >
            Começar o tabuleiro
          </Botao>
        )}

        <p className="text-center text-sm text-texto-fraco">
          Cada time precisa de pelo menos 2 pessoas e um Spymaster escolhido.
        </p>
      </div>
    );
  }

  /* ----------------------------------------------------- em_andamento */

  return (
    <div className="flex flex-col gap-4">
      <Cartao className="flex items-center justify-between gap-2 text-center">
        <div>
          <p className="numeros-fixos fonte-titulo text-3xl font-extrabold text-coral-600">
            {restantes.A ?? "—"}
          </p>
          <p className="text-xs font-bold text-texto-suave">Time A</p>
        </div>

        <Etiqueta className={timeDaVez === "A" ? "bg-coral-100 text-coral-600" : "bg-azul-100 text-azul-600"}>
          Vez do {timeDaVez ? NOME_TIME[timeDaVez] : "—"}
        </Etiqueta>

        <div>
          <p className="numeros-fixos fonte-titulo text-3xl font-extrabold text-azul-600">
            {restantes.B ?? "—"}
          </p>
          <p className="text-xs font-bold text-texto-suave">Time B</p>
        </div>
      </Cartao>

      {souSpymaster && (
        <p className="rounded-full bg-roxo-100 px-4 py-2 text-center text-sm font-bold text-roxo-700">
          🔐 Você é Spymaster — só você vê as cores verdadeiras abaixo.
        </p>
      )}

      {dicaAtual ? (
        <Cartao className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-texto-suave">
            Dica de {dicaAtual.por}
          </p>
          <p className="mt-1 fonte-titulo text-3xl text-roxo-900">
            {dicaAtual.palavra} <span className="numeros-fixos">· {dicaAtual.numero}</span>
          </p>
          {palpitesRestantes !== null && (
            <p className="mt-1 text-sm text-texto-suave">
              {palpitesRestantes} {palpitesRestantes === 1 ? "palpite restante" : "palpites restantes"}
            </p>
          )}
        </Cartao>
      ) : souSpymasterDaVez ? (
        <form onSubmit={enviarDica} className="flex flex-col gap-3">
          <Cartao className="border-2 border-roxo-600 bg-roxo-50">
            <label htmlFor="dica-palavra" className="mb-1.5 block text-center font-bold">
              Sua dica
            </label>
            <input
              id="dica-palavra"
              value={palavraDica}
              onChange={(e) => setPalavraDica(e.target.value)}
              maxLength={20}
              autoFocus
              autoComplete="off"
              placeholder="uma palavra"
              className="w-full rounded-[var(--radius-suave)] border-2 border-borda-forte px-4 py-3 text-center fonte-titulo text-xl uppercase transition-colors focus:border-roxo-600 focus:outline-none"
            />
            <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: 10 }, (_, n) => n).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumeroDica(n)}
                  aria-pressed={numeroDica === n}
                  className={[
                    "numeros-fixos min-h-[40px] rounded-[var(--radius-suave)] border-2 font-extrabold transition-colors",
                    numeroDica === n
                      ? "border-roxo-600 bg-roxo-600 text-white"
                      : "border-borda bg-white text-texto-suave"
                  ].join(" ")}
                >
                  {n}
                </button>
              ))}
            </div>
          </Cartao>
          <Botao type="submit" grande largo disabled={!palavraDica.trim()}>
            Enviar dica
          </Botao>
        </form>
      ) : (
        <Cartao className="text-center">
          <p className="text-texto-suave">
            {meuTime === timeDaVez
              ? "Aguardando o Spymaster do seu time dar a dica…"
              : `Aguardando o ${timeDaVez ? NOME_TIME[timeDaVez] : "outro time"} jogar…`}
          </p>
        </Cartao>
      )}

      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {palavras.map((p) => (
          <Celula
            key={p.indice}
            palavra={p}
            corSecreta={souSpymaster ? coresSecretas?.[p.indice] : undefined}
            clicavel={minhaVezDeApontar}
            onClick={() =>
              void acao(() => chamar("codenames_virar_palavra", { p_rodada: rodada.id, p_indice: p.indice }))
            }
          />
        ))}
      </div>

      {meuTime === timeDaVez && !souSpymaster && dicaAtual && (
        <Botao
          variante="secundario"
          largo
          onClick={() => void acao(() => chamar("codenames_passar_turno", { p_rodada: rodada.id }))}
        >
          Passar a vez
        </Botao>
      )}
    </div>
  );
}

function Resultado({ rodada }: PropsJogo) {
  const tabuleiro = rodada.resultado?.tabuleiro ?? [];
  const vencedor = rodada.resultado?.vencedor_time;
  const motivo = rodada.resultado?.motivo;

  if (tabuleiro.length === 0 || !vencedor) return null;

  return (
    <div className="mt-3">
      <p className="fonte-titulo text-xl text-roxo-900">
        {motivo === "bomba"
          ? `${NOME_TIME[vencedor]} venceu — o outro time apontou a bomba 💣`
          : `${NOME_TIME[vencedor]} completou as próprias palavras!`}
      </p>

      <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
        {tabuleiro.map((p) => (
          <div
            key={p.indice}
            className={[
              "flex aspect-square items-center justify-center rounded-[var(--radius-suave)] border-2 p-1 text-center text-[10px] font-extrabold uppercase leading-tight sm:text-xs",
              CELULA_REVELADA[p.cor]
            ].join(" ")}
          >
            {p.texto}
          </div>
        ))}
      </div>
    </div>
  );
}

export const codeNames: ModuloJogo = {
  id: "code-names",
  Componente,
  Resultado,
  escondeVezDe: true
};
