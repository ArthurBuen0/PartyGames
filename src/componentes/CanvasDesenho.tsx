import { useState, type PointerEvent } from "react";
import type { Traco } from "../lib/tipos";

/**
 * Área de desenho do Desenho Telefone — traços em coordenadas relativas
 * (0 a 100), para o mesmo desenho caber em qualquer tamanho de tela sem
 * distorcer. Sem `aoMudar`, vira só exibição (o desenho de outra pessoa).
 *
 * O traço em andamento fica em estado local: só sobe para o pai (e só então
 * entra no histórico que vai para o servidor) quando o dedo solta a tela —
 * evitar re-render a cada `pointermove` é o que mantém o traço fluido.
 */

const CORES = ["#1a1a1a", "#dc2626", "#2563eb", "#16a34a"];

export function CanvasDesenho({
  tracos,
  aoMudar,
  className = ""
}: {
  tracos: Traco[];
  aoMudar?: (tracos: Traco[]) => void;
  className?: string;
}) {
  const [emAndamento, setEmAndamento] = useState<Traco | null>(null);
  const [cor, setCor] = useState(CORES[0]);
  const somenteLeitura = !aoMudar;

  function posicao(e: PointerEvent<SVGSVGElement>): [number, number] {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  function aoPressionar(e: PointerEvent<SVGSVGElement>) {
    if (somenteLeitura) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setEmAndamento({ cor, pontos: [posicao(e)] });
  }

  function aoMover(e: PointerEvent<SVGSVGElement>) {
    if (somenteLeitura || !emAndamento) return;
    const ponto = posicao(e);
    setEmAndamento((t) => (t ? { ...t, pontos: [...t.pontos, ponto] } : t));
  }

  function aoSoltar() {
    if (somenteLeitura || !emAndamento) return;
    aoMudar?.([...tracos, emAndamento]);
    setEmAndamento(null);
  }

  const paraDesenhar = emAndamento ? [...tracos, emAndamento] : tracos;

  return (
    <div className={className}>
      <svg
        viewBox="0 0 100 100"
        className={[
          "aspect-square w-full touch-none rounded-[var(--radius-suave)] border-2 bg-white select-none",
          somenteLeitura ? "border-borda" : "border-borda-forte"
        ].join(" ")}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerLeave={aoSoltar}
        aria-label={somenteLeitura ? "Desenho" : "Área de desenho — arraste o dedo para desenhar"}
      >
        {paraDesenhar.map((t, i) =>
          t.pontos.length <= 1 ? (
            <circle
              key={i}
              cx={t.pontos[0]?.[0] ?? 50}
              cy={t.pontos[0]?.[1] ?? 50}
              r={1.3}
              fill={t.cor}
            />
          ) : (
            <polyline
              key={i}
              points={t.pontos.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke={t.cor}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        )}
      </svg>

      {!somenteLeitura && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {CORES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              aria-pressed={cor === c}
              onClick={() => setCor(c)}
              className={[
                "h-9 w-9 shrink-0 rounded-full border-2 transition-transform",
                cor === c ? "scale-110 border-roxo-600" : "border-borda"
              ].join(" ")}
              style={{ backgroundColor: c }}
            />
          ))}

          <button
            type="button"
            disabled={tracos.length === 0}
            onClick={() => aoMudar?.(tracos.slice(0, -1))}
            className="ml-auto min-h-[36px] rounded-full border border-borda-forte px-3 text-sm font-bold text-texto-suave transition-colors hover:bg-roxo-50 disabled:opacity-40"
          >
            Desfazer
          </button>
          <button
            type="button"
            disabled={tracos.length === 0}
            onClick={() => aoMudar?.([])}
            className="min-h-[36px] rounded-full border border-borda-forte px-3 text-sm font-bold text-texto-suave transition-colors hover:bg-roxo-50 disabled:opacity-40"
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}
