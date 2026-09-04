import { corDoJogo } from '../lib/visual';
import type { Jogo } from '../lib/tipos';

type Props = {
  jogo: Jogo;
  indice: number;
  ativo: boolean;
  onAlternar: (ativo: boolean) => void;
};

export default function JogoCard({ jogo, indice, ativo, onAlternar }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      className={`jogo ${ativo ? 'jogo--ligado' : 'jogo--desligado'}`}
      onClick={() => onAlternar(!ativo)}
    >
      <span className="jogo__emoji" style={{ ['--cor-jogo' as string]: corDoJogo(indice) }}>
        {jogo.emoji}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="jogo__nome" style={{ display: 'block' }}>
          {jogo.nome}
        </span>
        <span className="jogo__resumo" style={{ display: 'block' }}>
          {jogo.resumo}
        </span>
        <span className="jogo__meta">
          <span>👥 {jogo.jogadores}</span>
          <span>⏱ {jogo.duracao}</span>
        </span>
      </span>

      <span className="interruptor" aria-hidden="true">
        <span className="interruptor__bolinha" />
      </span>
    </button>
  );
}
