import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSala } from '../store/SalaContext';
import { lerApelidoSalvo } from '../lib/sessao';

const MAX_GRUPO = 30;
const MAX_APELIDO = 18;

export default function CriarSala() {
  const navigate = useNavigate();
  const { criarSala, conectado } = useSala();

  const [nomeGrupo, setNomeGrupo] = useState('');
  const [apelido, setApelido] = useState(lerApelidoSalvo);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;

    const apelidoLimpo = apelido.trim();
    if (!apelidoLimpo) {
      setErro('Escolhe um apelido pra galera te reconhecer!');
      return;
    }

    setErro(null);
    setEnviando(true);
    try {
      const codigo = await criarSala(nomeGrupo.trim() || 'Turma sem nome', apelidoLimpo);
      navigate(`/sala/${codigo}`, { replace: true });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não rolou criar a sala. Tenta de novo!');
      setEnviando(false);
    }
  }

  return (
    <main className="tela">
      <div className="topo">
        <button
          type="button"
          className="voltar"
          onClick={() => navigate('/')}
          aria-label="Voltar para o início"
        >
          ←
        </button>
        <span className="topo__titulo">Criar sala</span>
      </div>

      <div className="pilha">
        <h1 className="titulao">Bora montar a roda 🎉</h1>
        <p className="subtitulo">Dois campos e pronto. Ninguém precisa criar conta.</p>
      </div>

      <form className="pilha pilha--g" onSubmit={aoEnviar}>
        <div>
          <label className="rotulo" htmlFor="grupo">
            Nome do grupo
          </label>
          <input
            id="grupo"
            className="campo"
            value={nomeGrupo}
            onChange={(e) => setNomeGrupo(e.target.value.slice(0, MAX_GRUPO))}
            placeholder="Ex: Churrasco de sábado"
            maxLength={MAX_GRUPO}
            autoComplete="off"
            enterKeyHint="next"
          />
          <p className="contador">
            {nomeGrupo.length}/{MAX_GRUPO}
          </p>
        </div>

        <div>
          <label className="rotulo" htmlFor="apelido">
            Seu apelido
          </label>
          <input
            id="apelido"
            className="campo"
            value={apelido}
            onChange={(e) => setApelido(e.target.value.slice(0, MAX_APELIDO))}
            placeholder="Como te chamam?"
            maxLength={MAX_APELIDO}
            autoComplete="nickname"
            enterKeyHint="go"
            required
          />
          <p className="contador">
            {apelido.length}/{MAX_APELIDO}
          </p>
        </div>

        {erro && (
          <p className="erro" role="alert">
            <span aria-hidden="true">⚠️</span>
            {erro}
          </p>
        )}

        <button type="submit" className="botao botao--primario" disabled={enviando || !apelido.trim()}>
          {enviando ? 'Criando...' : '✨ Criar sala'}
        </button>

        {!conectado && (
          <p className="legenda" style={{ textAlign: 'center' }}>
            Sem conexão com o servidor no momento — assim que voltar, é só tocar de novo.
          </p>
        )}
      </form>
    </main>
  );
}
