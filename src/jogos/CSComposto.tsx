import { useEffect } from "react";
import { chamar } from "../lib/supabase";
import { Botao, Cartao } from "../componentes/Base";
import { Cronometro } from "../componentes/Cronometro";
import type { ModuloJogo, PropsJogo } from "./tipos";

/**
 * C, S, Composto — jogo de reflexo em turnos de 5 segundos.
 *
 * Todo mundo vê a mesma categoria e a mesma contagem regressiva. A diferença
 * está em uma coisa só: o botão grande de avançar aparece apenas na tela de
 * quem está na vez. Quem estourar o tempo cai na tela de resultado, e aí é o
 * anfitrião quem decide se elimina ou perdoa.
 */

const EXPLICACAO: Record<string, string> = {
  C: "uma palavra que começa com C",
  S: "uma palavra que começa com S",
  Composto: "uma palavra composta"
};

function Componente(props: PropsJogo) {
  const { rodada, minhaVez, jogadorDaVez, acao, segundos, totalSegundos, souAnfitriao } = props;

  const sequencia = rodada.estado.sequencia ?? ["C", "S", "Composto"];
  const indice = rodada.estado.indice ?? 0;
  const regraAtual = sequencia[indice] ?? "C";
  const emAndamento = rodada.fase === "em_andamento";

  // Quando o relógio zera, avisa o servidor — que confere no próprio relógio.
  // Todos os clientes chamam; a função é idempotente e ignora chamada repetida.
  useEffect(() => {
    if (!emAndamento || segundos > 0 || !rodada.turno_fim) return;

    const atraso = 150 + Math.random() * 350;
    const id = setTimeout(() => {
      void acao(() => chamar("registrar_timeout", { p_rodada: rodada.id }));
    }, atraso);

    return () => clearTimeout(id);
  }, [emAndamento, segundos, rodada.turno_fim, rodada.id, acao]);

  return (
    <div className="flex flex-col gap-4">
      {/* Categoria — igual para todo mundo */}
      <Cartao className="bg-linear-to-br from-roxo-100 to-superficie-2 text-center">
        <p className="text-xs font-extrabold uppercase tracking-widest text-roxo-700">
          Categoria da rodada
        </p>
        <p className="mt-1 fonte-titulo text-3xl font-extrabold text-roxo-900 sm:text-4xl">
          {rodada.estado.categoria}
        </p>
      </Cartao>

      {/* Sequência: onde a roda está agora */}
      <ol className="grid grid-cols-3 gap-2" aria-label="Sequência de regras">
        {sequencia.map((letra, i) => {
          const ativa = i === indice;
          return (
            <li
              key={letra}
              aria-current={ativa ? "step" : undefined}
              className={[
                "rounded-[var(--radius-suave)] border-2 p-3 text-center transition-colors",
                ativa
                  ? "border-roxo-600 bg-roxo-600 text-white"
                  : "border-borda bg-white text-texto-fraco"
              ].join(" ")}
            >
              <span className="block fonte-titulo text-lg font-extrabold break-all sm:text-2xl">
                {letra}
              </span>
              <span className="block text-[11px] font-bold">
                {ativa ? "agora" : "depois"}
              </span>
            </li>
          );
        })}
      </ol>

      {emAndamento && (
        <Cartao
          className={
            minhaVez
              ? "border-2 border-roxo-600 bg-roxo-50 text-center"
              : "text-center"
          }
        >
          <Cronometro segundos={segundos} total={totalSegundos || 5} tamanho="md" />

          {minhaVez ? (
            <>
              <p className="mt-2 fonte-titulo text-2xl text-roxo-900">
                Fale {EXPLICACAO[regraAtual] ?? regraAtual} em voz alta!
              </p>
              <Botao
                grande
                largo
                className="mt-4"
                onClick={() =>
                  void acao(() => chamar("avancar_turno", { p_rodada: rodada.id }))
                }
              >
                Próximo jogador →
              </Botao>
            </>
          ) : (
            <>
              <p className="mt-2 fonte-titulo text-xl text-roxo-900">
                É a vez de {jogadorDaVez?.apelido ?? "—"}
              </p>
              <p className="mt-1 text-texto-suave">
                Ela precisa falar {EXPLICACAO[regraAtual] ?? regraAtual}.
              </p>
              {souAnfitriao && jogadorDaVez && !jogadorDaVez.conectado && (
                <Botao
                  variante="secundario"
                  className="mt-4"
                  onClick={() => void acao(() => chamar("pular_vez", { p_rodada: rodada.id }))}
                >
                  Pular a vez de {jogadorDaVez.apelido} (desconectado)
                </Botao>
              )}
            </>
          )}
        </Cartao>
      )}
    </div>
  );
}

function Resultado({ rodada }: PropsJogo) {
  if (rodada.resultado?.vencedor) {
    return (
      <p className="mt-2 text-texto-suave">
        Sobrou só uma pessoa em pé. Ponto para <strong>{rodada.resultado.vencedor}</strong>!
      </p>
    );
  }

  return (
    <p className="mt-2 text-texto-suave">
      O tempo zerou antes da resposta. A mesa concorda? O anfitrião decide.
    </p>
  );
}

function AcoesResultado({ rodada, acao, souAnfitriao }: PropsJogo) {
  // Já acabou a partida: só resta a próxima rodada
  if (!souAnfitriao || rodada.resultado?.vencedor || !rodada.resultado?.perdedor_id) return null;

  return (
    <div className="flex flex-col gap-2">
      <Botao
        variante="perigo"
        largo
        onClick={() =>
          void acao(
            () => chamar("confirmar_eliminacao", { p_rodada: rodada.id }),
            `${rodada.resultado?.perdedor} saiu da rodada`
          )
        }
      >
        Confirmar: {rodada.resultado.perdedor} está fora
      </Botao>

      <Botao
        variante="secundario"
        largo
        onClick={() =>
          void acao(
            () => chamar("reiniciar_turno", { p_rodada: rodada.id }),
            "Turno reiniciado — ninguém saiu"
          )
        }
      >
        A resposta valeu! Continuar sem eliminar
      </Botao>
    </div>
  );
}

export const csComposto: ModuloJogo = {
  id: "c-s-composto",
  Componente,
  Resultado,
  AcoesResultado,
  escondeVezDe: true
};
