import { useMemo } from 'react';

const CORES = ['#fbbf24', '#f43f5e', '#10b981', '#0ea5e9', '#ffffff', '#f97316'];

/** Confete em CSS puro: leve o bastante para não engasgar celular fraquinho. */
export default function Confete({ pecas = 28 }: { pecas?: number }) {
  const itens = useMemo(
    () =>
      Array.from({ length: pecas }, (_, i) => ({
        id: i,
        esquerda: Math.random() * 100,
        atraso: Math.random() * 900,
        duracao: 2200 + Math.random() * 1600,
        cor: CORES[Math.floor(Math.random() * CORES.length)] as string,
        largura: 7 + Math.random() * 7,
        redondo: Math.random() > 0.65
      })),
    [pecas]
  );

  return (
    <div className="confete" aria-hidden="true">
      {itens.map((peca) => (
        <span
          key={peca.id}
          className="confete__peca"
          style={{
            left: `${peca.esquerda}%`,
            width: peca.largura,
            height: peca.largura * 1.4,
            background: peca.cor,
            borderRadius: peca.redondo ? '50%' : 2,
            animationDelay: `${peca.atraso}ms`,
            animationDuration: `${peca.duracao}ms`
          }}
        />
      ))}
    </div>
  );
}
