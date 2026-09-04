import { PALETA } from "../lib/jogos";
import type { CorJogador, Participante } from "../lib/tipos";
import { Botao, Etiqueta } from "./Base";

/* =========================================================== Avatar */

export function iniciais(apelido: string): string {
  const partes = apelido.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function Avatar({
  apelido,
  cor,
  tamanho = "md",
  destacado = false,
  desconectado = false
}: {
  apelido: string;
  cor: CorJogador;
  tamanho?: "sm" | "md" | "lg";
  destacado?: boolean;
  desconectado?: boolean;
}) {
  const paleta = PALETA[cor] ?? PALETA.roxo;
  const tamanhos = {
    sm: "h-9 w-9 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-lg"
  };

  return (
    <span
      className={[
        "inline-grid shrink-0 place-items-center rounded-full font-extrabold text-white",
        "fonte-titulo transition-all",
        tamanhos[tamanho],
        paleta.solido,
        destacado ? `ring-4 ring-offset-2 ${paleta.aro}` : "",
        desconectado ? "opacity-40 grayscale" : ""
      ].join(" ")}
      aria-hidden="true"
    >
      {iniciais(apelido)}
    </span>
  );
}

/* =================================================== Lista de jogadores */

interface ListaProps {
  participantes: Participante[];
  vezDe?: string | null;
  euId?: string;
  souAnfitriao?: boolean;
  aoRemover?: (id: string) => void;
  aoPularVez?: (id: string) => void;
  compacta?: boolean;
}

export function ListaJogadores({
  participantes,
  vezDe,
  euId,
  souAnfitriao = false,
  aoRemover,
  aoPularVez,
  compacta = false
}: ListaProps) {
  if (compacta) {
    return (
      <ul className="flex flex-wrap gap-2" aria-label="Jogadores na sala">
        {participantes.map((p) => (
          <li
            key={p.id}
            className={[
              "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3",
              p.id === vezDe
                ? "border-roxo-500 bg-roxo-50"
                : "border-borda bg-white",
              p.eliminado ? "opacity-50" : ""
            ].join(" ")}
          >
            <Avatar apelido={p.apelido} cor={p.cor} tamanho="sm" desconectado={!p.conectado} />
            <span className="text-sm font-bold">
              {p.apelido}
              {p.id === euId && <span className="text-texto-fraco"> (você)</span>}
            </span>
            <span className="numeros-fixos text-sm font-extrabold text-roxo-700">{p.pontos}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Jogadores na sala">
      {participantes.map((p) => (
        <li
          key={p.id}
          className={[
            "flex items-center gap-3 rounded-[var(--radius-suave)] border p-3 transition-colors",
            p.id === vezDe ? "border-roxo-500 bg-roxo-50" : "border-borda bg-white",
            p.eliminado ? "opacity-55" : ""
          ].join(" ")}
        >
          <Avatar
            apelido={p.apelido}
            cor={p.cor}
            destacado={p.id === vezDe}
            desconectado={!p.conectado}
          />

          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold">
              <span className="truncate">{p.apelido}</span>
              {p.id === euId && <span className="text-sm text-texto-fraco">(você)</span>}
              {p.e_anfitriao && (
                <Etiqueta className="bg-amarelo-100 text-amarelo-700">
                  <span aria-hidden="true">👑</span> Anfitrião
                </Etiqueta>
              )}
              {p.eliminado && (
                <Etiqueta className="bg-coral-100 text-coral-600">Fora da rodada</Etiqueta>
              )}
            </p>

            <p className="flex flex-wrap items-center gap-x-2 text-sm whitespace-nowrap text-texto-suave">
              <span
                className={[
                  "inline-block h-2 w-2 rounded-full",
                  p.conectado ? "bg-verde-600" : "bg-texto-fraco"
                ].join(" ")}
                aria-hidden="true"
              />
              {/* Não depende só da cor: o texto diz o mesmo */}
              {p.conectado ? "Conectado" : "Desconectado"}
              <span aria-hidden="true">·</span>
              <span className="numeros-fixos font-bold text-roxo-700">
                {p.pontos} {p.pontos === 1 ? "ponto" : "pontos"}
              </span>
            </p>
          </div>

          {souAnfitriao && p.id !== euId && (
            <div className="flex shrink-0 gap-1">
              {aoPularVez && !p.conectado && p.id === vezDe && (
                <Botao
                  variante="secundario"
                  onClick={() => aoPularVez(p.id)}
                  className="min-h-[44px] px-3 text-sm"
                >
                  Pular vez
                </Botao>
              )}
              {aoRemover && (
                <Botao
                  variante="perigo"
                  onClick={() => aoRemover(p.id)}
                  aria-label={`Remover ${p.apelido} da sala`}
                  className="min-h-[44px] px-3 text-sm"
                >
                  Remover
                </Botao>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/* =========================================================== Placar */

export function Placar({
  participantes,
  euId
}: {
  participantes: Participante[];
  euId?: string;
}) {
  const ordenados = [...participantes].sort((a, b) => b.pontos - a.pontos);
  const lider = ordenados[0]?.pontos ?? 0;

  return (
    <div>
      <h3 className="mb-3 fonte-titulo text-lg">Placar</h3>
      <ol className="flex flex-col gap-2">
        {ordenados.map((p, i) => (
          <li
            key={p.id}
            className={[
              "flex items-center gap-3 rounded-[var(--radius-suave)] px-3 py-2",
              p.pontos === lider && lider > 0 ? "bg-amarelo-100" : "bg-superficie-2"
            ].join(" ")}
          >
            <span className="numeros-fixos w-5 text-center text-sm font-extrabold text-texto-fraco">
              {i + 1}
            </span>
            <Avatar apelido={p.apelido} cor={p.cor} tamanho="sm" desconectado={!p.conectado} />
            <span className="min-w-0 flex-1 truncate font-bold">
              {p.apelido}
              {p.id === euId && <span className="text-texto-fraco"> (você)</span>}
            </span>
            {p.pontos === lider && lider > 0 && <span aria-label="Liderando">🏆</span>}
            <span className="numeros-fixos fonte-titulo text-xl font-extrabold text-roxo-700">
              {p.pontos}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
