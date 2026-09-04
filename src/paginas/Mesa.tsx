import { useCallback, useState } from "react";
import { chamar } from "../lib/supabase";
import { ehSilencioso, traduzirErro } from "../lib/erros";
import { jogoPorId } from "../lib/jogos";
import { MODULOS } from "../jogos";
import type { SalaAoVivo } from "../hooks/useSala";
import { useCronometro } from "../hooks/useCronometro";
import { Botao, Carregando, Cartao, useAviso } from "../componentes/Base";
import { Placar } from "../componentes/Jogadores";
import { CabecalhoSala, FimDeRodada, VezDe } from "../componentes/PecasDeMesa";
import { Modal, ModalConfirmacao, ModalRegras } from "../componentes/Modais";
import type { PropsJogo } from "../jogos/tipos";

/**
 * A mesa de jogo.
 *
 * Cuida do que é igual em todas as brincadeiras — cabeçalho, cronômetro,
 * placar, regras, fim de rodada e os controles do anfitrião — e entrega o miolo
 * para o módulo do jogo da vez.
 */
export function Mesa({ sala, aoSair }: { sala: SalaAoVivo; aoSair: () => void }) {
  const { avisar } = useAviso();
  const estado = sala.estado!;

  const [verRegras, setVerRegras] = useState(false);
  const [verPlacar, setVerPlacar] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const jogo = jogoPorId(estado.partida?.jogo ?? null);
  const rodada = estado.rodada;

  /** Executa RPC tratando erro; erros de corrida não viram aviso. */
  const acao = useCallback(
    async <T,>(fn: () => Promise<T>, mensagemOk?: string): Promise<T | null> => {
      try {
        const r = await fn();
        if (mensagemOk) avisar(mensagemOk, "ok");
        return r;
      } catch (erro) {
        if (!ehSilencioso(erro)) avisar(traduzirErro(erro), "erro");
        return null;
      }
    },
    [avisar]
  );

  const { segundos, total } = useCronometro(rodada?.turno_fim, sala.desvioRelogio);

  if (!jogo || !rodada) return <Carregando texto="Montando a mesa…" />;

  const modulo = MODULOS[jogo.id];
  const JogoAtual = modulo.Componente;
  const ResultadoDoJogo = modulo.Resultado;
  const AcoesDoJogo = modulo.AcoesResultado;
  const jogadorDaVez = estado.participantes.find((p) => p.id === rodada.vez_de) ?? null;
  const minhaVez = rodada.vez_de === estado.eu.id;
  const souAnfitriao = estado.eu.e_anfitriao;
  const acabou = rodada.fase === "resultado" || rodada.fase === "encerrada";

  const props: PropsJogo = {
    sala,
    estado,
    rodada,
    eu: estado.eu,
    souAnfitriao,
    minhaVez,
    jogadorDaVez,
    privados: sala.privados,
    acao,
    segundos,
    totalSegundos: total
  };

  return (
    <div className="min-h-dvh">
      <CabecalhoSala
        jogo={jogo}
        rodada={rodada.numero}
        participantes={estado.participantes}
        vezDe={rodada.vez_de}
        conectado={sala.conectado}
        aoAbrirRegras={() => setVerRegras(true)}
        aoAbrirPlacar={() => setVerPlacar(true)}
        aoSair={() => setConfirmandoSaida(true)}
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4 area-segura-baixo">
        {/* Indicação grande de vez, para os jogos que não desenham a sua */}
        {!acabou && !modulo.escondeVezDe && jogadorDaVez && (
          <VezDe
            minhaVez={minhaVez}
            apelido={jogadorDaVez.apelido}
            cor={jogadorDaVez.cor}
          />
        )}

        {acabou && rodada.resultado ? (
          <FimDeRodada
            resultado={rodada.resultado}
            souAnfitriao={souAnfitriao}
            extra={ResultadoDoJogo ? <ResultadoDoJogo {...props} /> : undefined}
            acoesAnfitriao={AcoesDoJogo ? <AcoesDoJogo {...props} /> : undefined}
            aoProxima={() =>
              void acao(
                () => chamar("proxima_rodada", { p_sala: estado.sala.id }),
                "Nova rodada! 🎲"
              )
            }
            aoEncerrar={() =>
              void acao(() => chamar("encerrar_partida", { p_sala: estado.sala.id }))
            }
          />
        ) : (
          <div className="surgir">
            <JogoAtual {...props} />
          </div>
        )}

        {/* Controles do anfitrião: jogos sem fim natural precisam deles sempre */}
        {souAnfitriao && !acabou && (
          <details className="rounded-[var(--radius-card)] border border-borda bg-white">
            <summary className="cursor-pointer list-none p-4 font-bold text-texto-suave">
              <span aria-hidden="true">👑</span> Controles do anfitrião
            </summary>
            <div className="flex flex-col gap-2 border-t border-borda p-4">
              <Botao
                variante="secundario"
                largo
                onClick={() =>
                  void acao(
                    () => chamar("proxima_rodada", { p_sala: estado.sala.id }),
                    "Nova rodada! 🎲"
                  )
                }
              >
                Pular para a próxima rodada
              </Botao>

              {jogadorDaVez && !jogadorDaVez.conectado && (
                <Botao
                  variante="secundario"
                  largo
                  onClick={() => void acao(() => chamar("pular_vez", { p_rodada: rodada.id }))}
                >
                  Pular a vez de {jogadorDaVez.apelido} (desconectado)
                </Botao>
              )}

              <Botao
                variante="perigo"
                largo
                onClick={() =>
                  void acao(
                    () => chamar("encerrar_partida", { p_sala: estado.sala.id }),
                    "Partida encerrada"
                  )
                }
              >
                Encerrar partida e voltar ao lobby
              </Botao>
            </div>
          </details>
        )}
      </main>

      <ModalRegras jogo={jogo} aberto={verRegras} aoFechar={() => setVerRegras(false)} />

      <Modal aberto={verPlacar} aoFechar={() => setVerPlacar(false)} titulo="Placar da sala">
        <Placar participantes={estado.participantes} euId={estado.eu.id} />
      </Modal>

      <ModalConfirmacao
        aberto={confirmandoSaida}
        aoFechar={() => setConfirmandoSaida(false)}
        titulo="Abandonar a sala?"
        textoConfirmar="Sair"
        perigo
        mensagem={
          souAnfitriao ? (
            <p>
              Você é o anfitrião: ao sair, a faixa passa para a próxima pessoa e a partida continua
              sem você.
            </p>
          ) : (
            <p>A partida segue sem você. Dá para voltar depois com o mesmo código.</p>
          )
        }
        aoConfirmar={aoSair}
      />

      {estado.eu.eliminado && (
        <Cartao className="mx-4 mb-6 max-w-3xl bg-superficie-2 text-center sm:mx-auto">
          <p className="font-bold text-texto-suave">
            Você está fora desta rodada — mas continua na sala, acompanhando tudo.
          </p>
        </Cartao>
      )}
    </div>
  );
}
