import type { ReactNode } from "react";
import { PALETA, type DefinicaoJogo } from "../lib/jogos";
import type { Participante, ResultadoRodada } from "../lib/tipos";
import { Botao, Cartao, Etiqueta } from "./Base";
import { Avatar } from "./Jogadores";

/* ================================================== Cabeçalho da mesa */

export function CabecalhoSala({
  jogo,
  rodada,
  participantes,
  vezDe,
  conectado,
  aoAbrirRegras,
  aoAbrirPlacar,
  aoSair
}: {
  jogo: DefinicaoJogo;
  rodada: number;
  participantes: Participante[];
  vezDe: string | null;
  conectado: boolean;
  aoAbrirRegras: () => void;
  aoAbrirPlacar: () => void;
  aoSair: () => void;
}) {
  const paleta = PALETA[jogo.cor];

  return (
    <header className="sticky top-0 z-40 border-b border-borda bg-fundo/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl ${paleta.claro}`}
            aria-hidden="true"
          >
            {jogo.emoji}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate fonte-titulo text-lg leading-tight text-roxo-900">
              {jogo.nome}
            </h1>
            <p className="flex items-center gap-2 text-sm text-texto-suave">
              <span className="font-bold">Rodada {rodada}</span>
              {!conectado && (
                <Etiqueta className="bg-coral-100 text-coral-600">Reconectando…</Etiqueta>
              )}
            </p>
          </div>

          <div className="flex shrink-0 gap-1">
            <BotaoIcone rotulo="Ver placar" onClick={aoAbrirPlacar}>🏆</BotaoIcone>
            <BotaoIcone rotulo="Ver regras" onClick={aoAbrirRegras}>📋</BotaoIcone>
            <BotaoIcone rotulo="Sair da sala" onClick={aoSair}>🚪</BotaoIcone>
          </div>
        </div>

        {/* Fila de participantes: quem está na vez fica com o anel */}
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Participantes">
          {participantes.map((p) => (
            <li key={p.id} className="flex shrink-0 flex-col items-center gap-1">
              <Avatar
                apelido={p.apelido}
                cor={p.cor}
                tamanho="sm"
                destacado={p.id === vezDe}
                desconectado={!p.conectado}
              />
              <span
                className={[
                  "max-w-[4.5rem] truncate text-[11px] font-bold",
                  p.eliminado ? "text-texto-fraco line-through" : "text-texto-suave"
                ].join(" ")}
              >
                {p.apelido}
              </span>
              <span className="numeros-fixos text-[11px] font-extrabold text-roxo-700">
                {p.pontos}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}

function BotaoIcone({
  children,
  rotulo,
  onClick
}: {
  children: ReactNode;
  rotulo: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      className="grid h-11 w-11 place-items-center rounded-full border border-borda bg-white text-lg transition-colors hover:bg-roxo-50"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

/* ========================================================= Vez de… */

export function VezDe({
  minhaVez,
  apelido,
  cor = "roxo",
  complemento
}: {
  minhaVez: boolean;
  apelido: string;
  cor?: Participante["cor"];
  complemento?: string;
}) {
  const paleta = PALETA[cor] ?? PALETA.roxo;

  return (
    <div
      className={[
        "rounded-[var(--radius-card)] p-5 text-center transition-colors",
        minhaVez ? `${paleta.solido} text-white` : "border border-borda bg-white"
      ].join(" ")}
      aria-live="polite"
    >
      <p
        className={[
          "fonte-titulo text-2xl font-extrabold sm:text-3xl",
          minhaVez ? "text-white" : "text-roxo-900"
        ].join(" ")}
      >
        {minhaVez ? "🎯 É a sua vez!" : `Vez de ${apelido}`}
      </p>
      {complemento && (
        <p className={minhaVez ? "mt-1 text-white/85" : "mt-1 text-texto-suave"}>{complemento}</p>
      )}
    </div>
  );
}

/* ==================================================== Fim de rodada */

export function FimDeRodada({
  resultado,
  souAnfitriao,
  aoProxima,
  aoEncerrar,
  extra,
  acoesAnfitriao
}: {
  resultado: ResultadoRodada;
  souAnfitriao: boolean;
  aoProxima: () => void;
  aoEncerrar: () => void;
  extra?: ReactNode;
  acoesAnfitriao?: ReactNode;
}) {
  return (
    <Cartao className="surgir text-center">
      <p className="text-5xl" aria-hidden="true">
        {resultado.vencedor ? "🏆" : resultado.tipo === "tempo_esgotado" ? "⏰" : "🎉"}
      </p>

      <h2 className="mt-3 fonte-titulo text-2xl text-roxo-900">
        {resultado.vencedor
          ? `${resultado.vencedor} venceu!`
          : resultado.tipo === "tempo_esgotado"
            ? `${resultado.perdedor} perdeu a rodada`
            : "Fim da rodada"}
      </h2>

      {extra}

      {souAnfitriao ? (
        <div className="mt-5 flex flex-col gap-2">
          {acoesAnfitriao}
          <Botao largo grande onClick={aoProxima}>
            Próxima rodada
          </Botao>
          <Botao variante="secundario" largo onClick={aoEncerrar}>
            Encerrar e voltar para o lobby
          </Botao>
        </div>
      ) : (
        <p className="mt-5 rounded-[var(--radius-suave)] bg-superficie-2 p-4 text-texto-suave">
          Esperando o anfitrião começar a próxima rodada…
        </p>
      )}
    </Cartao>
  );
}

/* ======================================================= Card de jogo */

export function CardJogo({
  jogo,
  selecionado,
  aoSelecionar,
  aoVerRegras,
  desabilitado = false,
  motivoDesabilitado
}: {
  jogo: DefinicaoJogo;
  selecionado: boolean;
  aoSelecionar: () => void;
  aoVerRegras: () => void;
  desabilitado?: boolean;
  motivoDesabilitado?: string;
}) {
  const paleta = PALETA[jogo.cor];

  return (
    <div
      className={[
        "relative flex flex-col gap-3 rounded-[var(--radius-card)] border-2 bg-white p-4 transition-all",
        selecionado
          ? `${paleta.borda} shadow-[var(--shadow-alta)]`
          : "border-borda shadow-[var(--shadow-suave)]",
        desabilitado ? "opacity-55" : ""
      ].join(" ")}
    >
      <button
        onClick={aoSelecionar}
        disabled={desabilitado}
        aria-pressed={selecionado}
        className="flex items-start gap-3 text-left disabled:cursor-not-allowed"
      >
        <span
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl ${paleta.claro}`}
          aria-hidden="true"
        >
          {jogo.emoji}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="fonte-titulo text-lg font-bold text-roxo-900">{jogo.nome}</span>
            {selecionado && (
              <span className={`text-sm font-extrabold ${paleta.texto}`}>✓ escolhido</span>
            )}
          </span>
          <span className="mt-1 block text-sm text-texto-suave">{jogo.resumo}</span>
        </span>
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <Etiqueta>👥 {jogo.jogadores}</Etiqueta>
        <Etiqueta>⏱️ {jogo.duracao}</Etiqueta>
        <button
          onClick={aoVerRegras}
          className="ml-auto min-h-[44px] rounded-full px-3 text-sm font-bold text-roxo-700 transition-colors hover:bg-roxo-50"
        >
          Ver regras
        </button>
      </div>

      {desabilitado && motivoDesabilitado && (
        <p className="rounded-[var(--radius-suave)] bg-amarelo-100 p-2 text-center text-xs font-bold text-amarelo-700">
          {motivoDesabilitado}
        </p>
      )}
    </div>
  );
}
