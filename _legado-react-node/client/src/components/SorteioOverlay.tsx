import { useEffect, useRef, useState } from 'react';
import Confete from './Confete';
import { vibrar } from '../lib/visual';
import type { Jogo, Sorteio } from '../lib/tipos';

type Props = {
  sorteio: Sorteio;
  catalogo: Jogo[];
  /** false quando o usuário só abriu de novo o último resultado */
  animar: boolean;
  podeSortear: boolean;
  onSortearOutro: () => void;
  onFechar: () => void;
};

export default function SorteioOverlay({
  sorteio,
  catalogo,
  animar,
  podeSortear,
  onSortearOutro,
  onFechar
}: Props) {
  const [fase, setFase] = useState<'girando' | 'resultado'>(animar ? 'girando' : 'resultado');
  const [indice, setIndice] = useState(animar ? 0 : sorteio.reel.length - 1);
  const relogio = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(relogio.current);

    if (!animar) {
      setFase('resultado');
      setIndice(sorteio.reel.length - 1);
      return;
    }

    setFase('girando');
    setIndice(0);

    const total = sorteio.reel.length;
    let atual = 0;

    const proximo = () => {
      atual += 1;
      if (atual >= total) {
        setFase('resultado');
        vibrar([18, 40, 90]);
        return;
      }
      setIndice(atual);
      // A roleta vai perdendo o fôlego perto do fim.
      const progresso = atual / total;
      relogio.current = window.setTimeout(proximo, 62 + progresso ** 3 * 420);
    };

    relogio.current = window.setTimeout(proximo, 90);
    return () => window.clearTimeout(relogio.current);
  }, [sorteio.drawId, sorteio.reel.length, animar]);

  // Fechar com Esc ajuda quem está no desktop.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const jogo = catalogo.find((j) => j.id === sorteio.gameId);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-live="polite">
      {fase === 'resultado' && <Confete />}

      <div className="overlay__conteudo">
        {fase === 'girando' ? (
          <div className="roleta">
            <p className="roleta__legenda">🥁 Sorteando a brincadeira...</p>
            <div className="roleta__janela">
              <span className="roleta__nome" key={indice}>
                {sorteio.reel[indice]}
              </span>
            </div>
            <div className="roleta__pontos" aria-hidden="true">
              <span className="roleta__ponto" />
              <span className="roleta__ponto" />
              <span className="roleta__ponto" />
            </div>
            <p className="roleta__aviso">Todo mundo na sala está vendo esse sorteio 👀</p>
          </div>
        ) : (
          <div className="resultado">
            <p className="resultado__chapeu">Vai ser</p>
            <div className="resultado__emoji" aria-hidden="true">
              {jogo?.emoji ?? '🎲'}
            </div>
            <h2 className="resultado__nome">{jogo?.nome ?? 'Jogo misterioso'}</h2>

            <div className="resultado__meta">
              {jogo && <span className="tag">👥 {jogo.jogadores}</span>}
              {jogo && <span className="tag">⏱ {jogo.duracao}</span>}
              <span className="tag">🎯 sorteado por {sorteio.sorteadoPor}</span>
            </div>

            {jogo && (
              <div className="regras">
                <p className="regras__titulo">Como joga</p>
                <ol className="regras__lista">
                  {jogo.regras.map((regra, i) => (
                    <li key={regra} className="regras__item">
                      <span className="regras__marcador">{i + 1}</span>
                      <span>{regra}</span>
                    </li>
                  ))}
                </ol>
                {jogo.dica && (
                  <p className="dica">
                    <span aria-hidden="true">💡</span>
                    <span>{jogo.dica}</span>
                  </p>
                )}
              </div>
            )}

            <div className="acoes-resultado">
              <button
                type="button"
                className="botao botao--claro"
                onClick={onSortearOutro}
                disabled={!podeSortear}
              >
                🎲 Sortear outro
              </button>
              <button type="button" className="botao botao--transparente" onClick={onFechar}>
                Bora jogar esse!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
