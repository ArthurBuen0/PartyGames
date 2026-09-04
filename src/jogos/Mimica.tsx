import { useEffect, useState } from "react";
import { chamar } from "../lib/supabase";
import { Botao, Cartao, Etiqueta } from "../componentes/Base";
import { Cronometro } from "../componentes/Cronometro";
import { meuPrivado, type ModuloJogo, type PropsJogo } from "./tipos";

/**
 * Mímica — 60 segundos sincronizados para a sala inteira.
 *
 * A palavra vive em `estados_privados` com `visivel_para_dono = true`, então o
 * RLS entrega a linha só para quem está representando. Nas outras telas ela
 * simplesmente não existe — não é escondida no CSS, não chega no cliente.
 */

const PROIBIDO = ["Falar", "Escrever", "Formar letras", "Apontar objetos"];

function Componente(props: PropsJogo) {
  const { rodada, minhaVez, jogadorDaVez, acao, segundos, totalSegundos, souAnfitriao, eu, privados } =
    props;

  const [mostrarPalavra, setMostrarPalavra] = useState(false);
  const segredo = meuPrivado(privados, eu.id, "palavra");
  const palavra = (segredo?.conteudo?.texto as string) ?? null;

  const preparando = rodada.fase === "preparando";
  const emAndamento = rodada.fase === "em_andamento";
  const acertos = rodada.estado.acertos ?? 0;

  // A palavra volta a ficar escondida quando troca
  useEffect(() => {
    setMostrarPalavra(false);
  }, [rodada.vez_de, rodada.id]);

  // Fim dos 60 segundos
  useEffect(() => {
    if (!emAndamento || segundos > 0 || !rodada.turno_fim) return;

    const id = setTimeout(() => {
      void acao(() => chamar("mimica_encerrar", { p_rodada: rodada.id }));
    }, 150 + Math.random() * 350);

    return () => clearTimeout(id);
  }, [emAndamento, segundos, rodada.turno_fim, rodada.id, acao]);

  const podeMarcar = minhaVez || souAnfitriao;

  return (
    <div className="flex flex-col gap-4">
      {minhaVez ? (
        /* ------------------------------------------- Tela de quem representa */
        <Cartao className="border-2 border-turquesa-600 bg-turquesa-100/40">
          <p className="text-center text-xs font-extrabold uppercase tracking-widest text-turquesa-600">
            Só você está vendo isto
          </p>

          {mostrarPalavra && palavra ? (
            <button
              onClick={() => setMostrarPalavra(false)}
              className="mt-2 w-full rounded-[var(--radius-suave)] bg-white p-6 text-center"
            >
              <span className="block fonte-titulo text-3xl font-extrabold text-roxo-900 sm:text-4xl">
                {palavra}
              </span>
              <span className="mt-2 block text-sm text-texto-fraco">toque para esconder</span>
            </button>
          ) : (
            <button
              onClick={() => setMostrarPalavra(true)}
              className="mt-2 grid w-full place-items-center gap-2 rounded-[var(--radius-suave)] border-2 border-dashed border-borda-forte bg-white p-8 text-center"
            >
              <span className="text-4xl" aria-hidden="true">🤫</span>
              <span className="fonte-titulo text-lg font-bold text-roxo-900">
                Toque para ver a palavra
              </span>
              <span className="text-sm text-texto-suave">
                Cuidado com quem está olhando por cima do ombro!
              </span>
            </button>
          )}
        </Cartao>
      ) : (
        /* ------------------------------------------------- Tela dos demais */
        <Cartao className="text-center">
          <p className="text-4xl" aria-hidden="true">🎭</p>
          <p className="mt-2 fonte-titulo text-2xl text-roxo-900">
            Adivinhem a mímica de {jogadorDaVez?.apelido ?? "—"}
          </p>
          <p className="mt-1 text-texto-suave">
            Fale seus palpites em voz alta. A palavra está só no celular de quem está
            representando.
          </p>
        </Cartao>
      )}

      {/* Cronômetro e controles */}
      <Cartao className="flex flex-col items-center gap-4">
        {preparando ? (
          <>
            <p className="fonte-titulo text-xl text-roxo-900">Prontos?</p>
            {minhaVez ? (
              <Botao
                grande
                largo
                onClick={() => void acao(() => chamar("mimica_iniciar", { p_rodada: rodada.id }))}
              >
                Começar os 60 segundos
              </Botao>
            ) : (
              <p className="text-center text-texto-suave">
                Esperando {jogadorDaVez?.apelido ?? "o jogador"} começar…
              </p>
            )}
          </>
        ) : (
          <>
            <Cronometro segundos={segundos} total={totalSegundos || 60} tamanho="lg" />

            <div className="flex items-center gap-3 rounded-full bg-superficie-2 px-5 py-2">
              <span className="font-bold text-texto-suave">Acertos</span>
              <span className="numeros-fixos fonte-titulo text-2xl font-extrabold text-turquesa-600">
                {acertos}
              </span>
            </div>

            {podeMarcar && emAndamento && (
              <Botao
                grande
                largo
                onClick={() =>
                  void acao(
                    () => chamar("mimica_acertou", { p_rodada: rodada.id }),
                    "Acertou! Vem palavra nova 🎉"
                  )
                }
              >
                <span aria-hidden="true">✅</span> Acertaram!
              </Botao>
            )}

            {podeMarcar && emAndamento && (
              <Botao
                variante="fantasma"
                largo
                onClick={() => void acao(() => chamar("mimica_encerrar", { p_rodada: rodada.id }))}
              >
                Encerrar a vez agora
              </Botao>
            )}
          </>
        )}
      </Cartao>

      {/* Regras sempre à vista */}
      <Cartao className="bg-coral-100/50">
        <h2 className="fonte-titulo text-base text-coral-600">
          <span aria-hidden="true">🚫</span> Durante a mímica não vale
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {PROIBIDO.map((item) => (
            <li key={item}>
              <Etiqueta className="bg-white text-coral-600">{item}</Etiqueta>
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}

function Resultado({ rodada }: PropsJogo) {
  const palavras = rodada.resultado?.palavras ?? [];

  return (
    <div className="mt-2">
      <p className="fonte-titulo text-4xl font-extrabold text-turquesa-600 numeros-fixos">
        {rodada.resultado?.acertos ?? 0}
      </p>
      <p className="text-texto-suave">
        {(rodada.resultado?.acertos ?? 0) === 1 ? "acerto" : "acertos"} de{" "}
        <strong>{rodada.resultado?.jogador}</strong>
      </p>

      {palavras.length > 0 && (
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {palavras.map((p, i) => (
            <li key={`${p}-${i}`}>
              <Etiqueta className="bg-turquesa-100 text-turquesa-600">{p}</Etiqueta>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const mimica: ModuloJogo = {
  id: "mimica",
  Componente,
  Resultado,
  escondeVezDe: true
};
