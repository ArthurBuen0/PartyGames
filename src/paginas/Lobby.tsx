import { useState } from "react";
import { chamar } from "../lib/supabase";
import { traduzirErro } from "../lib/erros";
import { JOGOS, jogoPorId, type DefinicaoJogo } from "../lib/jogos";
import type { SalaAoVivo } from "../hooks/useSala";
import { Botao, Cartao, Etiqueta, useAviso } from "../componentes/Base";
import { ListaJogadores } from "../componentes/Jogadores";
import { CardJogo } from "../componentes/PecasDeMesa";
import { ModalConfirmacao, ModalRegras } from "../componentes/Modais";

/**
 * Lobby: onde a turma se junta antes de começar.
 *
 * O anfitrião escolhe o jogo, liga (ou não) o modo +18 e dá a largada.
 * Todo mundo vê as mesmas informações ao vivo — inclusive quem acabou de
 * chegar e quem caiu.
 */
export function Lobby({ sala, aoSair }: { sala: SalaAoVivo; aoSair: () => void }) {
  const { avisar } = useAviso();
  const estado = sala.estado!;
  const souAnfitriao = estado.eu.e_anfitriao;

  const [regrasDe, setRegrasDe] = useState<DefinicaoJogo | null>(null);
  const [confirmandoAdulto, setConfirmandoAdulto] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [limitePerguntas, setLimitePerguntas] = useState(true);
  const [rodadasCSC, setRodadasCSC] = useState(10);

  const jogoEscolhido = jogoPorId(estado.sala.jogo_atual);
  const totalJogadores = estado.participantes.length;
  const link = `${window.location.origin}/sala/${estado.sala.codigo}`;

  async function acao<T>(fn: () => Promise<T>, mensagemOk?: string) {
    try {
      const r = await fn();
      if (mensagemOk) avisar(mensagemOk, "ok");
      return r;
    } catch (erro) {
      avisar(traduzirErro(erro), "erro");
      return null;
    }
  }

  async function compartilhar() {
    const texto = `Bora jogar no Party Games! Sala ${estado.sala.codigo}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Party Games", text: texto, url: link });
        return;
      } catch (erro) {
        if ((erro as Error)?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(link);
      avisar("Link copiado! Manda no grupo 🔗", "ok");
    } catch {
      window.prompt("Copie o link da sala:", link);
    }
  }

  async function iniciar() {
    if (!jogoEscolhido) {
      avisar("Escolha um jogo primeiro", "erro");
      return;
    }

    setIniciando(true);
    await acao(
      () =>
        chamar("iniciar_partida", {
          p_sala: estado.sala.id,
          p_jogo: jogoEscolhido.id,
          p_config:
            jogoEscolhido.id === "quem-sou-eu"
              ? { limitePerguntas: limitePerguntas ? 10 : null }
              : jogoEscolhido.id === "c-s-composto"
                ? { rodadas: rodadasCSC }
                : {}
        }),
      "Partida começando! 🎮"
    );
    setIniciando(false);
  }

  const poucosJogadores = jogoEscolhido ? totalJogadores < jogoEscolhido.minimo : false;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 px-4 py-6 area-segura-baixo">
      {/* Cabeçalho da sala */}
      <Cartao className="bg-linear-to-br from-roxo-600 to-rosa-500 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-white/80">Sala</p>
            <h1 className="fonte-titulo text-2xl font-extrabold">{estado.sala.nome}</h1>
            <p
              className="mt-2 inline-block rounded-full bg-white/20 px-4 py-2 fonte-titulo text-3xl font-extrabold tracking-[0.25em]"
              aria-label={`Código da sala: ${estado.sala.codigo.split("").join(" ")}`}
            >
              {estado.sala.codigo}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Botao variante="secundario" onClick={compartilhar}>
              <span aria-hidden="true">🔗</span> Compartilhar
            </Botao>
            <span className="text-center text-sm font-bold text-white/80">
              {totalJogadores} {totalJogadores === 1 ? "pessoa" : "pessoas"} · máx. 12
            </span>
          </div>
        </div>
      </Cartao>

      {!sala.conectado && (
        <p className="rounded-[var(--radius-suave)] bg-amarelo-100 p-3 text-center text-sm font-bold text-amarelo-700">
          Reconectando ao tempo real…
        </p>
      )}

      {/* Participantes */}
      <section aria-labelledby="titulo-jogadores">
        <h2 id="titulo-jogadores" className="mb-3 fonte-titulo text-xl text-roxo-900">
          Quem já chegou
        </h2>
        <ListaJogadores
          participantes={estado.participantes}
          euId={estado.eu.id}
          souAnfitriao={souAnfitriao}
          aoRemover={(id) => setRemovendo(id)}
        />
        {totalJogadores === 1 && (
          <p className="mt-3 rounded-[var(--radius-suave)] bg-amarelo-100 p-3 text-sm font-bold text-amarelo-700">
            Você está sozinho por enquanto. Mande o link para a galera entrar!
          </p>
        )}
      </section>

      {/* Escolha do jogo */}
      <section aria-labelledby="titulo-jogos">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="titulo-jogos" className="fonte-titulo text-xl text-roxo-900">
            {souAnfitriao ? "Escolha a brincadeira" : "Jogo da vez"}
          </h2>
          {!souAnfitriao && (
            <Etiqueta className="bg-roxo-100 text-roxo-700">Quem escolhe é o anfitrião</Etiqueta>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {JOGOS.map((jogo) => (
            <CardJogo
              key={jogo.id}
              jogo={jogo}
              selecionado={estado.sala.jogo_atual === jogo.id}
              desabilitado={!souAnfitriao}
              aoSelecionar={() =>
                void acao(() =>
                  chamar("definir_jogo", { p_sala: estado.sala.id, p_jogo: jogo.id })
                )
              }
              aoVerRegras={() => setRegrasDe(jogo)}
            />
          ))}
        </div>
      </section>

      {/* Opções do jogo escolhido */}
      {souAnfitriao && jogoEscolhido?.id === "quem-sou-eu" && (
        <Cartao>
          <h3 className="fonte-titulo text-lg">Opções de Quem Sou Eu?</h3>
          <label className="mt-3 flex items-center gap-3">
            <input
              type="checkbox"
              checked={limitePerguntas}
              onChange={(e) => setLimitePerguntas(e.target.checked)}
              className="h-6 w-6 accent-[var(--color-roxo-600)]"
            />
            <span>
              <span className="font-bold">Limite de 10 perguntas por pessoa</span>
              <span className="block text-sm text-texto-suave">
                Desmarque para o modo livre, sem limite.
              </span>
            </span>
          </label>
        </Cartao>
      )}

      {souAnfitriao && jogoEscolhido?.id === "c-s-composto" && (
        <Cartao>
          <h3 className="fonte-titulo text-lg">Opções de C, S, Composto</h3>
          <label htmlFor="rodadas-csc" className="mt-3 block font-bold">
            Número de rodadas
          </label>
          <p className="mb-2 text-sm text-texto-suave">
            Cada rodada é uma palavra na cadeia. No fim, todo mundo vota.
          </p>
          <div className="flex items-center gap-3">
            <Botao
              type="button"
              variante="secundario"
              onClick={() => setRodadasCSC((n) => Math.max(3, n - 1))}
              aria-label="Diminuir número de rodadas"
            >
              −
            </Botao>
            <span
              id="rodadas-csc"
              className="numeros-fixos min-w-[3ch] text-center fonte-titulo text-2xl font-extrabold text-roxo-900"
            >
              {rodadasCSC}
            </span>
            <Botao
              type="button"
              variante="secundario"
              onClick={() => setRodadasCSC((n) => Math.min(30, n + 1))}
              aria-label="Aumentar número de rodadas"
            >
              +
            </Botao>
          </div>
        </Cartao>
      )}

      {/* Modo +18 */}
      <Cartao
        className={estado.sala.modo_adulto ? "border-rosa-500 bg-rosa-100/40" : ""}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 fonte-titulo text-lg">
              <span aria-hidden="true">🔞</span> Modo +18
              {estado.sala.modo_adulto && (
                <Etiqueta className="bg-rosa-500 text-white">Ligado</Etiqueta>
              )}
            </h3>
            <p className="mt-1 text-sm text-texto-suave">
              Adiciona cartas picantes ao Verdade ou Desafio. Conteúdo adulto, só para maiores de
              18 anos e com todo mundo de acordo. Qualquer pessoa pode pular qualquer carta.
            </p>
          </div>

          {souAnfitriao ? (
            <Botao
              variante={estado.sala.modo_adulto ? "perigo" : "secundario"}
              onClick={() => {
                if (estado.sala.modo_adulto) {
                  void acao(
                    () => chamar("definir_modo_adulto", { p_sala: estado.sala.id, p_ativo: false }),
                    "Modo +18 desligado"
                  );
                } else {
                  setConfirmandoAdulto(true);
                }
              }}
            >
              {estado.sala.modo_adulto ? "Desligar" : "Ligar"}
            </Botao>
          ) : (
            <Etiqueta className="bg-superficie-2 text-texto-suave">
              {estado.sala.modo_adulto ? "Ligado pelo anfitrião" : "Desligado"}
            </Etiqueta>
          )}
        </div>
      </Cartao>

      {/* Começar — barra fixa no rodapé, com fundo para não deixar o conteúdo passar por baixo */}
      <div className="sticky bottom-0 -mx-4 mt-2 flex flex-col gap-2 border-t border-borda bg-fundo/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-md">
        {souAnfitriao ? (
          <>
            <Botao
              grande
              largo
              carregando={iniciando}
              disabled={!jogoEscolhido || poucosJogadores || totalJogadores < 2}
              onClick={iniciar}
            >
              {jogoEscolhido ? `Começar ${jogoEscolhido.nome}` : "Escolha um jogo"}
            </Botao>

            {poucosJogadores && jogoEscolhido && (
              <p className="rounded-full bg-amarelo-100 px-4 py-2 text-center text-sm font-bold text-amarelo-700">
                {jogoEscolhido.nome} precisa de pelo menos {jogoEscolhido.minimo} pessoas.
              </p>
            )}
          </>
        ) : (
          <p className="rounded-[var(--radius-card)] border border-borda bg-white p-4 text-center font-bold text-texto-suave">
            {jogoEscolhido
              ? `Esperando o anfitrião começar ${jogoEscolhido.nome}…`
              : "Esperando o anfitrião escolher o jogo…"}
          </p>
        )}

        <Botao variante="fantasma" largo onClick={() => setConfirmandoSaida(true)}>
          Sair da sala
        </Botao>
      </div>

      {/* Modais */}
      {regrasDe && (
        <ModalRegras jogo={regrasDe} aberto aoFechar={() => setRegrasDe(null)} />
      )}

      <ModalConfirmacao
        aberto={confirmandoAdulto}
        aoFechar={() => setConfirmandoAdulto(false)}
        titulo="Ligar o modo +18?"
        textoConfirmar="Confirmo, pode ligar"
        mensagem={
          <div className="flex flex-col gap-3">
            <p>Ao ligar, você confirma que:</p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li><strong>Todas as pessoas da sala têm 18 anos ou mais.</strong></li>
              <li>Todo mundo concorda em jogar com cartas de conteúdo adulto.</li>
              <li>
                Ninguém é obrigado a nada: o botão <strong>“Não me sinto confortável”</strong>{" "}
                troca qualquer carta, sem precisar explicar.
              </li>
              <li>Você pode desligar o modo a qualquer momento.</li>
            </ul>
            <p className="rounded-[var(--radius-suave)] bg-amarelo-100 p-3 text-sm text-amarelo-700">
              As cartas são picantes e divertidas, nunca explícitas ou constrangedoras.
            </p>
          </div>
        }
        aoConfirmar={() => {
          setConfirmandoAdulto(false);
          void acao(
            () =>
              chamar("definir_modo_adulto", {
                p_sala: estado.sala.id,
                p_ativo: true,
                p_confirmado: true
              }),
            "Modo +18 ligado 🔞"
          );
        }}
      />

      <ModalConfirmacao
        aberto={Boolean(removendo)}
        aoFechar={() => setRemovendo(null)}
        titulo="Remover da sala?"
        textoConfirmar="Remover"
        perigo
        mensagem={
          <p>
            <strong>
              {estado.participantes.find((p) => p.id === removendo)?.apelido}
            </strong>{" "}
            vai sair da sala. A pessoa pode entrar de novo com o código.
          </p>
        }
        aoConfirmar={() => {
          const alvo = removendo;
          setRemovendo(null);
          if (alvo) {
            void acao(
              () => chamar("remover_participante", { p_participante: alvo }),
              "Participante removido"
            );
          }
        }}
      />

      <ModalConfirmacao
        aberto={confirmandoSaida}
        aoFechar={() => setConfirmandoSaida(false)}
        titulo="Sair da sala?"
        textoConfirmar="Sair"
        perigo
        mensagem={
          souAnfitriao ? (
            <p>
              Você é o anfitrião. Ao sair, a faixa passa automaticamente para a próxima pessoa da
              lista.
            </p>
          ) : (
            <p>Você pode voltar depois com o mesmo código.</p>
          )
        }
        aoConfirmar={aoSair}
      />
    </main>
  );
}
