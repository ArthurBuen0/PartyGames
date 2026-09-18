import { useEffect, useState, type FormEvent } from "react";
import { chamar } from "../lib/supabase";
import { Botao, Cartao, Etiqueta } from "../componentes/Base";
import { Cronometro as Cronometro90 } from "../componentes/Cronometro";
import { CanvasDesenho } from "../componentes/CanvasDesenho";
import type { ConteudoDesenho, ConteudoFrase, Traco } from "../lib/tipos";
import { meuPrivado, type ModuloJogo, type PropsJogo } from "./tipos";

/**
 * Desenho Telefone — telefone sem fio com desenho no lugar da fala.
 *
 * N jogadores ativos = N "cadernos". Cada caderno começa com a frase de quem
 * abriu e alterna desenho → frase → desenho…, sempre passando para uma
 * pessoa diferente (nunca a mesma duas vezes seguidas, nunca o dono antes da
 * revelação). O servidor manda só a ÚLTIMA peça do próprio caderno de cada
 * um — ver o antes disso estragaria a graça da revelação final.
 */

interface TarefaDesenho {
  caderno: number;
  passo: number;
  tipo: "frase" | "desenho";
  anterior: Partial<ConteudoFrase & ConteudoDesenho>;
}

function Componente(props: PropsJogo) {
  const { rodada, estado, privados, eu, souAnfitriao, acao, segundos, totalSegundos } = props;

  const [texto, setTexto] = useState("");
  const [tracos, setTracos] = useState<Traco[]>([]);
  const [enviando, setEnviando] = useState(false);

  const passoAtual = rodada.estado.passo_atual ?? 0;
  const totalPassos = rodada.estado.total_passos ?? estado.participantes.length;
  const totalJogadores = rodada.estado.total_jogadores ?? estado.participantes.length;
  const enviaram = rodada.estado.enviaram ?? [];
  const jaEnviei = enviaram.includes(eu.id);

  const tarefaPrivada = meuPrivado(privados, eu.id, "tarefa_desenho");
  const tarefa = tarefaPrivada?.conteudo as TarefaDesenho | undefined;

  useEffect(() => {
    setTexto("");
    setTracos([]);
  }, [passoAtual]);

  // Ninguém mandou a tempo: qualquer cliente pode destravar (o servidor confere o relógio)
  useEffect(() => {
    if (segundos > 0 || !rodada.turno_fim || jaEnviei) return;
    const id = setTimeout(() => {
      void acao(() => chamar("desenho_forcar_avanco", { p_rodada: rodada.id }));
    }, 400 + Math.random() * 400);
    return () => clearTimeout(id);
  }, [segundos, rodada.turno_fim, rodada.id, acao, jaEnviei]);

  async function enviarFrase(e: FormEvent) {
    e.preventDefault();
    const valor = texto.trim();
    if (!valor) return;
    setEnviando(true);
    const r = await acao(() =>
      chamar("desenho_enviar_etapa", { p_rodada: rodada.id, p_conteudo: { texto: valor } })
    );
    setEnviando(false);
    if (r) setTexto("");
  }

  async function enviarDesenho() {
    if (tracos.length === 0) return;
    setEnviando(true);
    await acao(() =>
      chamar("desenho_enviar_etapa", { p_rodada: rodada.id, p_conteudo: { tracos } })
    );
    setEnviando(false);
  }

  const rotuloPasso = tarefa?.tipo === "desenho" ? "🎨 Desenhe" : passoAtual === 0 ? "✏️ Comece" : "✏️ Legende";

  return (
    <div className="flex flex-col gap-4">
      <Cartao className="bg-linear-to-br from-roxo-100 to-superficie-2 text-center">
        <p className="text-xs font-extrabold uppercase tracking-widest text-roxo-700">
          Passo {passoAtual + 1} de {totalPassos}
        </p>
        <p className="mt-1 fonte-titulo text-2xl font-extrabold text-roxo-900">{rotuloPasso}</p>
        {rodada.turno_fim && (
          <div className="mt-2 flex justify-center">
            <Cronometro90
              segundos={segundos}
              total={totalSegundos || (tarefa?.tipo === "desenho" ? 90 : 45)}
              tamanho="sm"
              rotulo=""
            />
          </div>
        )}
      </Cartao>

      {jaEnviei ? (
        <Cartao className="text-center">
          <p className="text-5xl" aria-hidden="true">
            ✅
          </p>
          <p className="mt-2 fonte-titulo text-xl text-roxo-900">Mandado!</p>
          <p className="mt-1 text-texto-suave">Esperando o resto da mesa terminar esse passo.</p>
          <p className="mt-3 inline-block rounded-full bg-superficie-2 px-4 py-2 text-sm font-bold text-texto-suave">
            {enviaram.length}/{totalJogadores} já mandaram
          </p>
        </Cartao>
      ) : !tarefa ? (
        <Cartao className="text-center">
          <p className="text-texto-suave">Preparando a sua próxima tarefa…</p>
        </Cartao>
      ) : tarefa.tipo === "frase" ? (
        <form onSubmit={enviarFrase} className="flex flex-col gap-3">
          {tarefa.passo > 0 && tarefa.anterior.tracos && (
            <Cartao>
              <p className="mb-2 text-center font-bold text-roxo-900">O que está acontecendo aqui?</p>
              <CanvasDesenho tracos={tarefa.anterior.tracos} />
            </Cartao>
          )}

          <Cartao className="border-2 border-roxo-600 bg-roxo-50">
            <label htmlFor="frase-desenho" className="mb-1.5 block text-center font-bold">
              {tarefa.passo === 0
                ? "Escreva uma frase para outra pessoa desenhar"
                : "Escreva uma frase que descreva o desenho"}
            </label>
            <textarea
              id="frase-desenho"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={80}
              rows={2}
              autoFocus
              placeholder={tarefa.passo === 0 ? "ex.: um gato surfando" : "ex.: um gato caindo da prancha"}
              className="w-full resize-none rounded-[var(--radius-suave)] border-2 border-borda-forte p-3 text-center transition-colors focus:border-roxo-600 focus:outline-none"
            />
            {tarefa.passo === 0 && (
              <p className="mt-2 text-center text-sm text-texto-fraco">
                Ninguém vai saber que foi você até a revelação final.
              </p>
            )}
          </Cartao>

          <Botao type="submit" grande largo disabled={!texto.trim()} carregando={enviando}>
            Mandar
          </Botao>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <Cartao className="border-2 border-roxo-600 bg-roxo-50 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-roxo-700">Desenhe</p>
            <p className="mt-1 fonte-titulo text-2xl text-roxo-900">
              “{tarefa.anterior.texto ?? "—"}”
            </p>
          </Cartao>

          <CanvasDesenho tracos={tracos} aoMudar={setTracos} />

          <Botao
            grande
            largo
            disabled={tracos.length === 0}
            carregando={enviando}
            onClick={() => void enviarDesenho()}
          >
            Mandar desenho
          </Botao>
        </div>
      )}

      <section aria-labelledby="titulo-quem-mandou">
        <h2 id="titulo-quem-mandou" className="mb-2 fonte-titulo text-lg text-roxo-900">
          Quem já mandou
        </h2>
        <ul className="flex flex-wrap gap-2">
          {estado.participantes.map((p) => (
            <li key={p.id}>
              <Etiqueta
                className={
                  enviaram.includes(p.id)
                    ? "bg-verde-100 text-verde-600"
                    : "bg-superficie-2 text-texto-suave"
                }
              >
                {enviaram.includes(p.id) ? "✓" : "…"} {p.apelido}
              </Etiqueta>
            </li>
          ))}
        </ul>
      </section>

      {souAnfitriao && !jaEnviei && (
        <Botao
          variante="fantasma"
          largo
          onClick={() => void acao(() => chamar("desenho_forcar_avanco", { p_rodada: rodada.id }))}
        >
          Forçar o próximo passo (quem não mandou fica de fora dessa)
        </Botao>
      )}
    </div>
  );
}

function Resultado({ rodada }: PropsJogo) {
  const cadernos = rodada.resultado?.cadernos ?? [];
  if (cadernos.length === 0) {
    return <p className="mt-2 text-texto-suave">Ninguém completou um caderno dessa vez.</p>;
  }

  return (
    <div className="mt-4 flex flex-col gap-6 text-left">
      {cadernos.map((c) => (
        <div
          key={c.caderno}
          className="rounded-[var(--radius-card)] border border-borda bg-white p-4"
        >
          <h3 className="fonte-titulo text-lg text-roxo-900">Caderno de {c.autor_original}</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {c.passos.map((p) => (
              <div key={p.passo} className="flex flex-col gap-1">
                <span className="text-xs font-bold text-texto-fraco">
                  {p.autor ? `${p.autor}` : "ninguém respondeu"}
                </span>
                {p.conteudo === null ? (
                  <div className="grid aspect-square place-items-center rounded-[var(--radius-suave)] border border-dashed border-borda text-2xl text-texto-fraco">
                    —
                  </div>
                ) : p.tipo === "desenho" ? (
                  <CanvasDesenho tracos={(p.conteudo as ConteudoDesenho).tracos} />
                ) : (
                  <p className="flex aspect-square items-center justify-center rounded-[var(--radius-suave)] bg-superficie-2 p-3 text-center fonte-titulo text-roxo-900">
                    “{(p.conteudo as ConteudoFrase).texto}”
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const desenhoTelefone: ModuloJogo = {
  id: "desenho-telefone",
  Componente,
  Resultado,
  escondeVezDe: true
};
