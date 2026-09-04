import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { socket } from '../lib/socket';
import { lerSessao, limparSessao, salvarApelido, salvarSessao } from '../lib/sessao';
import type { EstadoSala, Resposta, SessaoAck, Sorteio } from '../lib/tipos';

type SalaCtx = {
  estado: EstadoSala | null;
  jogadorId: string | null;
  conectado: boolean;
  /** true enquanto tentamos voltar para a sala salva no aparelho */
  restaurando: boolean;
  /** só muda quando chega um sorteio novo pelo socket (é o gatilho da animação) */
  sorteioAoVivo: Sorteio | null;
  aviso: string | null;
  criarSala: (nomeGrupo: string, apelido: string) => Promise<string>;
  entrarSala: (codigo: string, apelido: string) => Promise<string>;
  sair: () => Promise<void>;
  alternarJogo: (gameId: string, ativo: boolean) => void;
  sortear: () => void;
  mostrarAviso: (mensagem: string) => void;
};

const Contexto = createContext<SalaCtx | null>(null);

function emitirComResposta<T>(evento: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    let respondeu = false;
    const relogio = setTimeout(() => {
      if (!respondeu) reject(new Error('O servidor não respondeu. Confere sua internet!'));
    }, 9000);

    socket.emit(evento, payload, (resposta: Resposta<T>) => {
      respondeu = true;
      clearTimeout(relogio);
      if (resposta && resposta.ok) resolve(resposta.data);
      else reject(new Error(resposta?.erro ?? 'Não rolou. Tenta de novo!'));
    });
  });
}

export function SalaProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSala | null>(null);
  const [jogadorId, setJogadorId] = useState<string | null>(null);
  const [conectado, setConectado] = useState(socket.connected);
  const [restaurando, setRestaurando] = useState(() => Boolean(lerSessao()));
  const [sorteioAoVivo, setSorteioAoVivo] = useState<Sorteio | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const relogioAviso = useRef<number | undefined>(undefined);
  /** evita duas tentativas de reentrada disputando a mesma sessão */
  const reentrando = useRef(false);

  const mostrarAviso = useCallback((mensagem: string) => {
    setAviso(mensagem);
    window.clearTimeout(relogioAviso.current);
    relogioAviso.current = window.setTimeout(() => setAviso(null), 3600);
  }, []);

  const tentarReentrar = useCallback(async () => {
    const sessao = lerSessao();
    if (!sessao || reentrando.current) {
      setRestaurando(false);
      return;
    }
    reentrando.current = true;
    try {
      const dados = await emitirComResposta<SessaoAck>('sala:reentrar', {
        codigo: sessao.codigo,
        jogadorId: sessao.jogadorId
      });
      setEstado(dados.estado);
      setJogadorId(dados.jogadorId);
    } catch {
      // A sala virou pó (ou expirou): esquece a sessão e deixa a tela decidir.
      limparSessao();
      setEstado(null);
      setJogadorId(null);
    } finally {
      reentrando.current = false;
      setRestaurando(false);
    }
  }, []);

  useEffect(() => {
    function aoConectar() {
      setConectado(true);
      void tentarReentrar();
    }
    function aoDesconectar() {
      setConectado(false);
    }
    function aoAtualizarEstado(novo: EstadoSala) {
      setEstado(novo);
    }
    function aoSortear(sorteio: Sorteio) {
      setSorteioAoVivo(sorteio);
    }
    function aoEncerrar() {
      limparSessao();
      setEstado(null);
      setJogadorId(null);
      mostrarAviso('A sala foi encerrada por inatividade.');
    }

    socket.on('connect', aoConectar);
    socket.on('disconnect', aoDesconectar);
    socket.on('sala:estado', aoAtualizarEstado);
    socket.on('sala:sorteio', aoSortear);
    socket.on('sala:encerrada', aoEncerrar);
    socket.on('sala:aviso', mostrarAviso);

    if (socket.connected) void tentarReentrar();
    else if (!lerSessao()) setRestaurando(false);

    return () => {
      socket.off('connect', aoConectar);
      socket.off('disconnect', aoDesconectar);
      socket.off('sala:estado', aoAtualizarEstado);
      socket.off('sala:sorteio', aoSortear);
      socket.off('sala:encerrada', aoEncerrar);
      socket.off('sala:aviso', mostrarAviso);
    };
  }, [mostrarAviso, tentarReentrar]);

  const criarSala = useCallback(async (nomeGrupo: string, apelido: string) => {
    const dados = await emitirComResposta<SessaoAck>('sala:criar', { nomeGrupo, apelido });
    setEstado(dados.estado);
    setJogadorId(dados.jogadorId);
    salvarSessao({ codigo: dados.estado.codigo, jogadorId: dados.jogadorId, apelido });
    return dados.estado.codigo;
  }, []);

  const entrarSala = useCallback(async (codigo: string, apelido: string) => {
    const dados = await emitirComResposta<SessaoAck>('sala:entrar', { codigo, apelido });
    setEstado(dados.estado);
    setJogadorId(dados.jogadorId);
    salvarSessao({ codigo: dados.estado.codigo, jogadorId: dados.jogadorId, apelido });
    return dados.estado.codigo;
  }, []);

  const sair = useCallback(async () => {
    await new Promise<void>((resolve) => {
      let pronto = false;
      const relogio = setTimeout(() => {
        if (!pronto) resolve();
      }, 1500);
      socket.emit('sala:sair', null, () => {
        pronto = true;
        clearTimeout(relogio);
        resolve();
      });
    });
    limparSessao();
    setEstado(null);
    setJogadorId(null);
    setSorteioAoVivo(null);
  }, []);

  const alternarJogo = useCallback((gameId: string, ativo: boolean) => {
    socket.emit('sala:alternar-jogo', { gameId, ativo });
  }, []);

  const sortear = useCallback(() => {
    socket.emit('sala:sortear');
  }, []);

  // Mantém o apelido à mão para a próxima sala.
  useEffect(() => {
    const eu = estado?.jogadores.find((j) => j.id === jogadorId);
    if (eu) salvarApelido(eu.apelido);
  }, [estado, jogadorId]);

  const valor = useMemo<SalaCtx>(
    () => ({
      estado,
      jogadorId,
      conectado,
      restaurando,
      sorteioAoVivo,
      aviso,
      criarSala,
      entrarSala,
      sair,
      alternarJogo,
      sortear,
      mostrarAviso
    }),
    [
      estado,
      jogadorId,
      conectado,
      restaurando,
      sorteioAoVivo,
      aviso,
      criarSala,
      entrarSala,
      sair,
      alternarJogo,
      sortear,
      mostrarAviso
    ]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSala(): SalaCtx {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSala precisa estar dentro de <SalaProvider>');
  return ctx;
}
