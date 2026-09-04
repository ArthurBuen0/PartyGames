import { useState, type FormEvent } from "react";
import { chamar } from "../lib/supabase";
import { Botao, Cartao, Etiqueta } from "../componentes/Base";
import { Avatar } from "../componentes/Jogadores";
import { privadoDe, type ModuloJogo, type PropsJogo } from "./tipos";

/**
 * Quem Sou Eu? — o jogo em que cada tela mostra uma coisa diferente.
 *
 * As identidades ficam em `estados_privados` com `visivel_para_dono = false`.
 * A política de RLS lê isso ao contrário do normal: entrega a linha para todo
 * mundo MENOS para o dono. Ou seja, você recebe do servidor as identidades dos
 * outros e nunca a sua — nem mesmo escondida no meio do JSON.
 */

function Componente(props: PropsJogo) {
  const { rodada, minhaVez, jogadorDaVez, acao, eu, estado, privados, souAnfitriao } = props;

  const [palpite, setPalpite] = useState("");
  const [escrevendo, setEscrevendo] = useState(false);

  const limite = rodada.estado.limite_perguntas ?? null;
  const feitas = rodada.estado.perguntas?.[jogadorDaVez?.id ?? ""] ?? 0;
  const acertaram = rodada.estado.acertaram ?? [];
  const ultima = rodada.estado.ultima_resposta;

  // Identidade de quem está na vez — visível para todos, menos para a pessoa
  const identidadeDaVez = jogadorDaVez
    ? (privadoDe(privados, jogadorDaVez.id, "identidade")?.conteudo as
        | { nome?: string; dica?: string }
        | undefined)
    : undefined;

  const minhaIdentidadeRevelada = privadoDe(privados, eu.id, "identidade")?.conteudo as
    | { nome?: string }
    | undefined;

  const jaAcertei = acertaram.some((a) => a.id === eu.id);

  async function enviarPalpite(e: FormEvent) {
    e.preventDefault();
    if (!palpite.trim()) return;

    const r = await acao<{ acertou: boolean; identidade: string | null }>(() =>
      chamar("quem_sou_eu_palpite", { p_rodada: rodada.id, p_palpite: palpite.trim() })
    );

    if (r?.acertou) {
      // O aviso de acerto sai da própria tela; aqui só limpamos
      setEscrevendo(false);
    }
    setPalpite("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* O que EU sou */}
      <Cartao
        className={
          jaAcertei ? "border-2 border-verde-600 bg-verde-100/50" : "bg-amarelo-100/50"
        }
      >
        <p className="text-center text-xs font-extrabold uppercase tracking-widest text-amarelo-700">
          Sua identidade
        </p>
        <p className="mt-1 text-center fonte-titulo text-4xl font-extrabold text-roxo-900">
          {jaAcertei && minhaIdentidadeRevelada?.nome ? (
            <>🎉 {minhaIdentidadeRevelada.nome}</>
          ) : (
            <>Você é: ?</>
          )}
        </p>
        <p className="mt-1 text-center text-sm text-texto-suave">
          {jaAcertei
            ? "Você descobriu! Agora ajude a responder as perguntas dos outros."
            : "Só você não pode ver. Pergunte para descobrir."}
        </p>
      </Cartao>

      {/* Quem está na vez, e a identidade dela (que ela não vê) */}
      {jogadorDaVez && (
        <Cartao className={minhaVez ? "border-2 border-roxo-600 bg-roxo-50" : ""}>
          <div className="flex items-center gap-3">
            <Avatar apelido={jogadorDaVez.apelido} cor={jogadorDaVez.cor} destacado />
            <div className="min-w-0 flex-1">
              <p className="fonte-titulo text-xl text-roxo-900">
                {minhaVez ? "É a sua vez de perguntar" : `Vez de ${jogadorDaVez.apelido}`}
              </p>
              <p className="text-sm text-texto-suave">
                {limite
                  ? `${feitas} de ${limite} perguntas usadas`
                  : `${feitas} perguntas feitas · modo livre`}
              </p>
            </div>
          </div>

          {!minhaVez && identidadeDaVez?.nome && (
            <div className="mt-3 rounded-[var(--radius-suave)] bg-white p-4 text-center">
              <p className="text-xs font-extrabold uppercase tracking-widest text-texto-fraco">
                {jogadorDaVez.apelido} é (não conte!)
              </p>
              <p className="mt-1 fonte-titulo text-2xl font-extrabold text-roxo-900">
                {identidadeDaVez.nome}
              </p>
              {identidadeDaVez.dica && (
                <p className="mt-1 text-sm text-texto-suave">Dica: {identidadeDaVez.dica}</p>
              )}
            </div>
          )}

          {limite && feitas >= limite && (
            <p className="mt-3 rounded-[var(--radius-suave)] bg-amarelo-100 p-3 text-center text-sm font-bold text-amarelo-700">
              Acabaram as {limite} perguntas. Hora do palpite!
            </p>
          )}
        </Cartao>
      )}

      {/* Última resposta da mesa */}
      {ultima && (
        <p className="surgir rounded-full bg-superficie-2 px-4 py-2 text-center font-bold text-texto-suave">
          {ultima.por} respondeu{" "}
          <span className="text-roxo-700">
            {ultima.resposta === "sim" ? "SIM" : ultima.resposta === "nao" ? "NÃO" : "TALVEZ"}
          </span>
        </p>
      )}

      {/* Botões: o grupo responde, quem está na vez chuta */}
      {minhaVez ? (
        <Cartao>
          {escrevendo ? (
            <form onSubmit={enviarPalpite}>
              <label htmlFor="palpite" className="mb-1.5 block font-bold">
                Quem você acha que é?
              </label>
              <input
                id="palpite"
                value={palpite}
                onChange={(e) => setPalpite(e.target.value)}
                autoFocus
                maxLength={40}
                autoComplete="off"
                placeholder="digite o nome"
                className="min-h-[56px] w-full rounded-[var(--radius-suave)] border-2 border-borda-forte px-4 text-center fonte-titulo text-xl transition-colors focus:border-roxo-500 focus:outline-none"
              />
              <div className="mt-3 flex flex-col gap-2">
                <Botao type="submit" grande largo>
                  Chutar!
                </Botao>
                <Botao type="button" variante="fantasma" largo onClick={() => setEscrevendo(false)}>
                  Cancelar
                </Botao>
              </div>
            </form>
          ) : (
            <>
              <p className="text-center text-texto-suave">
                Faça sua pergunta de sim ou não em voz alta. A mesa responde na tela dela.
              </p>
              <Botao
                variante="amarelo"
                grande
                largo
                className="mt-3"
                onClick={() => setEscrevendo(true)}
              >
                <span aria-hidden="true">💡</span> Meu palpite
              </Botao>
            </>
          )}
        </Cartao>
      ) : (
        <Cartao>
          <p className="mb-3 text-center font-bold text-texto-suave">
            Responda a pergunta de {jogadorDaVez?.apelido ?? "quem está na vez"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { valor: "sim", texto: "Sim", emoji: "👍", classe: "bg-verde-600 text-white" },
                { valor: "nao", texto: "Não", emoji: "👎", classe: "bg-coral-600 text-white" },
                { valor: "talvez", texto: "Talvez", emoji: "🤷", classe: "bg-amarelo-500 text-[#4a3308]" }
              ] as const
            ).map((opcao) => (
              <button
                key={opcao.valor}
                onClick={() =>
                  void acao(() =>
                    chamar("quem_sou_eu_responder", {
                      p_rodada: rodada.id,
                      p_resposta: opcao.valor
                    })
                  )
                }
                className={[
                  "flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-[var(--radius-suave)]",
                  "fonte-titulo text-lg font-extrabold transition-transform active:scale-95",
                  opcao.classe
                ].join(" ")}
              >
                <span aria-hidden="true" className="text-2xl">{opcao.emoji}</span>
                {opcao.texto}
              </button>
            ))}
          </div>
        </Cartao>
      )}

      {/* Quem já descobriu */}
      {acertaram.length > 0 && (
        <section aria-labelledby="titulo-acertaram">
          <h2 id="titulo-acertaram" className="mb-2 fonte-titulo text-lg text-roxo-900">
            Já descobriram
          </h2>
          <ul className="flex flex-wrap gap-2">
            {acertaram.map((a) => (
              <li key={a.id}>
                <Etiqueta className="bg-verde-100 text-verde-600">
                  {a.apelido} era {a.identidade}
                </Etiqueta>
              </li>
            ))}
          </ul>
        </section>
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

      {/* Lembrete de quantas pessoas ainda estão caçando */}
      <p className="text-center text-sm text-texto-fraco">
        {acertaram.length} de {estado.participantes.length} já sabem quem são
      </p>
    </div>
  );
}

export const quemSouEu: ModuloJogo = {
  id: "quem-sou-eu",
  Componente,
  escondeVezDe: true
};
