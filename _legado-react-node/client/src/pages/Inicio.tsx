import { Link } from 'react-router-dom';
import { useSala } from '../store/SalaContext';

const EMOJIS = ['🔤', '🔗', '🕵️', '🎯', '🎭', '🙋', '🤥'];

export default function Inicio() {
  const { estado } = useSala();

  return (
    <main className="tela tela--centro">
      <div className="pilha pilha--g">
        <header className="marca">
          <span className="marca__selo" aria-hidden="true">
            🎲
          </span>
          <span className="marca__nome">
            Sorteia <em>Aí</em>
          </span>
        </header>

        <div className="pilha">
          <h1 className="titulao">Chega de discutir o que jogar.</h1>
          <p className="subtitulo">
            Crie uma sala, chame a galera pelo link e deixe o sorteio escolher a brincadeira. Em
            menos de um minuto todo mundo já está jogando.
          </p>
        </div>

        <div className="card">
          <div className="passos">
            <p className="passo">
              <span className="passo__num">1</span> Crie a sala com o nome da turma
            </p>
            <p className="passo">
              <span className="passo__num">2</span> Compartilhe o link ou o código de 4 letras
            </p>
            <p className="passo">
              <span className="passo__num">3</span> Toque em sortear e comece a jogar
            </p>
          </div>
        </div>

        {estado && (
          <Link to={`/sala/${estado.codigo}`} className="botao botao--secundario">
            ⬅️ Voltar pra sala {estado.nomeGrupo}
          </Link>
        )}

        <div className="pilha">
          <Link to="/criar" className="botao botao--primario">
            ✨ Criar sala
          </Link>
          <Link to="/entrar" className="botao botao--secundario">
            🔑 Entrar em uma sala
          </Link>
        </div>

        <div className="pilha">
          <p className="legenda" style={{ textAlign: 'center' }}>
            7 brincadeiras prontas pra roda — e sem cadastro nenhum.
          </p>
          <div className="fita" aria-hidden="true">
            {EMOJIS.map((emoji, i) => (
              <span key={emoji} className="fita__item" style={{ animationDelay: `${i * 160}ms` }}>
                {emoji}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
