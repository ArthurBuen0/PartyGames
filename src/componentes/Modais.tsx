import { useEffect, useId, useRef, type ReactNode } from "react";
import { Botao } from "./Base";
import type { DefinicaoJogo } from "../lib/jogos";

/* ======================================================== Modal base */

interface ModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
}

/**
 * Modal com o básico de acessibilidade no lugar: papel de diálogo, foco que
 * entra ao abrir e volta ao fechar, Esc e clique fora funcionando, e Tab preso
 * dentro da janela.
 */
export function Modal({ aberto, aoFechar, titulo, children, rodape }: ModalProps) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const focoAnteriorRef = useRef<HTMLElement | null>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!aberto) return;

    focoAnteriorRef.current = document.activeElement as HTMLElement;

    const focaveis = () =>
      Array.from(
        caixaRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => !el.hasAttribute("disabled"));

    focaveis()[0]?.focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        aoFechar();
        return;
      }
      if (e.key !== "Tab") return;

      const lista = focaveis();
      if (lista.length === 0) return;

      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];

      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
      focoAnteriorRef.current?.focus?.();
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-roxo-900/55 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="surgir flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-alta)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-borda p-5">
          <h2 id={tituloId} className="fonte-titulo text-xl text-roxo-900">
            {titulo}
          </h2>
          <button
            onClick={aoFechar}
            aria-label="Fechar"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl text-texto-suave transition-colors hover:bg-superficie-2"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {rodape && <div className="border-t border-borda p-5">{rodape}</div>}
      </div>
    </div>
  );
}

/* ====================================================== Modal regras */

export function ModalRegras({
  jogo,
  aberto,
  aoFechar
}: {
  jogo: DefinicaoJogo;
  aberto: boolean;
  aoFechar: () => void;
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={`${jogo.emoji} ${jogo.nome}`}
      rodape={
        <Botao largo onClick={aoFechar}>
          Entendi, bora jogar
        </Botao>
      }
    >
      <p className="mb-5 text-texto-suave">{jogo.resumo}</p>

      <h3 className="mb-3 fonte-titulo text-lg">Como jogar</h3>
      <ol className="mb-5 flex flex-col gap-3">
        {jogo.regras.map((regra, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-roxo-100 fonte-titulo text-sm font-extrabold text-roxo-700">
              {i + 1}
            </span>
            <span className="text-texto-suave">{regra}</span>
          </li>
        ))}
      </ol>

      <div className="rounded-[var(--radius-suave)] bg-amarelo-100 p-4">
        <h3 className="mb-1 fonte-titulo text-base text-amarelo-700">
          <span aria-hidden="true">👀</span> Quem vê o quê
        </h3>
        <p className="text-sm text-amarelo-700">{jogo.visibilidade}</p>
      </div>
    </Modal>
  );
}

/* ================================================ Modal confirmação */

export function ModalConfirmacao({
  aberto,
  aoFechar,
  aoConfirmar,
  titulo,
  mensagem,
  textoConfirmar = "Confirmar",
  perigo = false,
  carregando = false
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoConfirmar: () => void;
  titulo: string;
  mensagem: ReactNode;
  textoConfirmar?: string;
  perigo?: boolean;
  carregando?: boolean;
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={titulo}
      rodape={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Botao
            variante={perigo ? "perigo" : "primario"}
            largo
            carregando={carregando}
            onClick={aoConfirmar}
          >
            {textoConfirmar}
          </Botao>
          <Botao variante="secundario" largo onClick={aoFechar}>
            Cancelar
          </Botao>
        </div>
      }
    >
      <div className="text-texto-suave">{mensagem}</div>
    </Modal>
  );
}
