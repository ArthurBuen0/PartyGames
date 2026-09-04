import {
  createContext, useCallback, useContext, useMemo, useState,
  type ButtonHTMLAttributes, type ReactNode
} from "react";

/* ============================================================ Botão */

type Variante = "primario" | "secundario" | "rosa" | "amarelo" | "fantasma" | "perigo";

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-roxo-600 text-white shadow-[0_10px_24px_rgba(109,40,217,0.28)] hover:bg-roxo-700 active:scale-[0.98]",
  secundario:
    "bg-white text-roxo-700 border-2 border-borda-forte hover:border-roxo-500 hover:bg-roxo-50 active:scale-[0.98]",
  rosa:
    "bg-rosa-500 text-white shadow-[0_10px_24px_rgba(219,39,119,0.28)] hover:bg-rosa-600 active:scale-[0.98]",
  amarelo:
    "bg-amarelo-500 text-[#4a3308] shadow-[0_10px_24px_rgba(202,138,4,0.25)] hover:bg-amarelo-400 active:scale-[0.98]",
  fantasma:
    "bg-transparent text-texto-suave hover:bg-roxo-50 hover:text-roxo-700 active:scale-[0.98]",
  perigo:
    "bg-white text-coral-600 border-2 border-coral-100 hover:border-coral-600 hover:bg-coral-100 active:scale-[0.98]"
};

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  grande?: boolean;
  largo?: boolean;
  carregando?: boolean;
  children: ReactNode;
}

export function Botao({
  variante = "primario",
  grande = false,
  largo = false,
  carregando = false,
  className = "",
  disabled,
  children,
  ...resto
}: BotaoProps) {
  return (
    <button
      {...resto}
      disabled={disabled || carregando}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full fonte-titulo font-bold",
        "transition-all duration-200 disabled:opacity-45 disabled:pointer-events-none",
        grande ? "min-h-[60px] px-8 text-lg" : "min-h-[52px] px-6 text-base",
        largo ? "w-full" : "",
        VARIANTES[variante],
        className
      ].join(" ")}
    >
      {carregando && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

/* =========================================================== Cartão */

export function Cartao({
  children,
  className = "",
  ...resto
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...resto}
      className={[
        "rounded-[var(--radius-card)] border border-borda bg-white p-5 sm:p-6",
        "shadow-[var(--shadow-suave)]",
        className
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/* ========================================================= Etiqueta */

export function Etiqueta({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1",
        "text-xs font-extrabold",
        className || "bg-superficie-2 text-texto-suave"
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/* ======================================================= Carregando */

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16" role="status">
      <span className="text-5xl girar-dado" aria-hidden="true">🎲</span>
      <p className="fonte-titulo text-lg text-texto-suave">{texto}</p>
    </div>
  );
}

/* ============================================================ Avisos */

type TipoAviso = "ok" | "erro" | "info";

interface Aviso {
  id: number;
  texto: string;
  tipo: TipoAviso;
}

interface ContextoAvisos {
  avisar: (texto: string, tipo?: TipoAviso) => void;
}

const AvisosContext = createContext<ContextoAvisos>({ avisar: () => {} });

export function useAviso() {
  return useContext(AvisosContext);
}

const CORES_AVISO: Record<TipoAviso, string> = {
  ok: "bg-verde-600 text-white",
  erro: "bg-coral-600 text-white",
  info: "bg-roxo-900 text-white"
};

/**
 * Avisos curtos no rodapé. `aria-live="polite"` para o leitor de tela anunciar
 * sem atropelar o que a pessoa está fazendo.
 */
export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const avisar = useCallback((texto: string, tipo: TipoAviso = "info") => {
    const id = Date.now() + Math.random();
    setAvisos((atuais) => [...atuais.slice(-2), { id, texto, tipo }]);
    setTimeout(() => {
      setAvisos((atuais) => atuais.filter((a) => a.id !== id));
    }, 3600);
  }, []);

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <AvisosContext.Provider value={valor}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {avisos.map((aviso) => (
          <div
            key={aviso.id}
            className={[
              "surgir max-w-md rounded-full px-5 py-3 text-center text-sm font-bold",
              "shadow-[var(--shadow-alta)]",
              CORES_AVISO[aviso.tipo]
            ].join(" ")}
          >
            {aviso.texto}
          </div>
        ))}
      </div>
    </AvisosContext.Provider>
  );
}
