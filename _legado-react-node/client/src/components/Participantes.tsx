import { corDoApelido, iniciais } from '../lib/visual';
import type { Participante } from '../lib/tipos';

type Props = {
  jogadores: Participante[];
  euId: string | null;
};

export default function Participantes({ jogadores, euId }: Props) {
  const online = jogadores.filter((j) => j.online).length;

  return (
    <div className="pilha">
      <div className="linha">
        <h2 style={{ fontSize: 17 }}>Quem já chegou</h2>
        <span className="espaco" />
        <span className="legenda">
          {online} {online === 1 ? 'pessoa' : 'pessoas'} na sala
        </span>
      </div>

      <div className="participantes">
        {jogadores.map((jogador) => (
          <span
            key={jogador.id}
            className={[
              'participante',
              jogador.online ? '' : 'participante--offline',
              jogador.id === euId ? 'participante--voce' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            title={jogador.online ? undefined : 'Caiu a conexão dessa pessoa'}
          >
            <span className="avatar" style={{ background: corDoApelido(jogador.apelido) }}>
              {iniciais(jogador.apelido)}
            </span>
            {jogador.apelido}
            {jogador.id === euId && ' (você)'}
            {jogador.isHost && ' 👑'}
          </span>
        ))}
      </div>

      {jogadores.length === 1 && (
        <p className="legenda">
          Tá sozinho por enquanto — manda o link ou o código pra galera entrar. 👇
        </p>
      )}
    </div>
  );
}
