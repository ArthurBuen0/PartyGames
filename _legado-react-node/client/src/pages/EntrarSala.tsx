import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSala } from '../store/SalaContext';
import { lerApelidoSalvo } from '../lib/sessao';

const MAX_APELIDO = 18;

export default function EntrarSala() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { entrarSala, conectado } = useSala();

  const convite = (params.get('sala') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const [codigo, setCodigo] = useState(convite);
  const [apelido, setApelido] = useState(lerApelidoSalvo);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campoApelido = useRef<HTMLInputElement>(null);

  // Quem chegou pelo link já tem o código: manda direto pro apelido.
  useEffect(() => {
    if (convite && !lerApelidoSalvo()) campoApelido.current?.focus();
  }, [convite]);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    if (enviando) return;

    const codigoLimpo = codigo.trim().toUpperCase();
    const apelidoLimpo = apelido.trim();
    if (codigoLimpo.length < 4) {
      setErro('O código tem 4 letrinhas. Confere com quem criou a sala!');
      return;
    }
    if (!apelidoLimpo) {
      setErro('Escolhe um apelido pra galera te reconhecer!');
      return;
    }

    setErro(null);
    setEnviando(true);
    try {
      const codigoFinal = await entrarSala(codigoLimpo, apelidoLimpo);
      navigate(`/sala/${codigoFinal}`, { replace: true });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não rolou entrar. Tenta de novo!');
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
        <span className="topo__titulo">Entrar em uma sala</span>
      </div>

      <div className="pilha">
        {/* nbsp para o emoji não cair sozinho numa linha */}
        <h1 className="titulao">{convite ? 'Te chamaram pra jogar! 🎉' : 'Qual é o código?'}</h1>
        <p className="subtitulo">
          {convite
            ? 'O código já veio no link. Só falta dizer como te chamam.'
            : 'Peça o código de 4 letras pra quem criou a sala.'}
        </p>
      </div>

      <form className="pilha pilha--g" onSubmit={aoEnviar}>
        <div>
          <label className="rotulo" htmlFor="codigo">
            Código da sala
          </label>
          <input
            id="codigo"
            className="campo campo--codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="ABCD"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            enterKeyHint="next"
            required
          />
        </div>

        <div>
          <label className="rotulo" htmlFor="apelido">
            Seu apelido
          </label>
          <input
            id="apelido"
            ref={campoApelido}
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

        <button
          type="submit"
          className="botao botao--primario"
          disabled={enviando || codigo.trim().length < 4 || !apelido.trim()}
        >
          {enviando ? 'Entrando...' : '🔑 Entrar na sala'}
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
