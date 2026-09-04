/**
 * Cronômetro em anel. Recebe os segundos já calculados por `useCronometro`
 * (que usa o relógio do servidor), então aqui é só desenho.
 *
 * O número grande e o texto abaixo dizem a mesma coisa que a cor: quem não
 * distingue vermelho de verde continua sabendo que o tempo está acabando.
 */

const RAIO = 54;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

export function Cronometro({
  segundos,
  total,
  tamanho = "md",
  rotulo
}: {
  segundos: number;
  total: number;
  tamanho?: "sm" | "md" | "lg";
  rotulo?: string;
}) {
  const fracao = total > 0 ? Math.min(1, Math.max(0, segundos / total)) : 0;
  const acabando = segundos <= 3 && segundos > 0;
  const zerado = segundos === 0;

  const dimensoes = {
    sm: "h-24 w-24",
    md: "h-40 w-40",
    lg: "h-52 w-52"
  };

  const fonte = {
    sm: "text-2xl",
    md: "text-5xl",
    lg: "text-6xl"
  };

  const cor = zerado
    ? "var(--color-coral-600)"
    : acabando
      ? "var(--color-rosa-500)"
      : "var(--color-roxo-600)";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${dimensoes[tamanho]}`}>
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle
            cx="60" cy="60" r={RAIO}
            fill="none"
            stroke="var(--color-superficie-2)"
            strokeWidth="12"
          />
          <circle
            cx="60" cy="60" r={RAIO}
            fill="none"
            stroke={cor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRCUNFERENCIA}
            strokeDashoffset={CIRCUNFERENCIA * (1 - fracao)}
            style={{ transition: "stroke-dashoffset 250ms linear, stroke 200ms" }}
          />
        </svg>

        <div
          className={[
            "absolute inset-0 grid place-items-center fonte-titulo font-extrabold numeros-fixos",
            fonte[tamanho],
            acabando ? "pulsar" : ""
          ].join(" ")}
          style={{ color: cor }}
          role="timer"
          aria-live="off"
        >
          {segundos}
        </div>
      </div>

      <p className="text-sm font-bold text-texto-suave">
        {rotulo ?? (zerado ? "Tempo esgotado" : `${segundos} ${segundos === 1 ? "segundo" : "segundos"}`)}
      </p>
    </div>
  );
}

/** Versão em barra, para caber no cabeçalho sem roubar a cena. */
export function BarraTempo({ segundos, total }: { segundos: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (segundos / total) * 100)) : 0;

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-24 overflow-hidden rounded-full bg-superficie-2"
        role="progressbar"
        aria-valuenow={segundos}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Tempo restante do turno"
      >
        <div
          className={segundos <= 3 ? "h-full bg-rosa-500" : "h-full bg-roxo-600"}
          style={{ width: `${pct}%`, transition: "width 250ms linear" }}
        />
      </div>
      <span className="numeros-fixos text-sm font-extrabold text-texto-suave">{segundos}s</span>
    </div>
  );
}
