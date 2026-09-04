import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import JogoCard from '../components/JogoCard';
import Participantes from '../components/Participantes';
import SorteioOverlay from '../components/SorteioOverlay';
import { compartilharNativo, copiarTexto, linkDaSala } from '../lib/compartilhar';
import { useSala } from '../store/SalaContext';
import type { Sorteio } from '../lib/tipos';

export default function Sala() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const {
    estado,
    jogadorId,
    conectado,
    restaurando,
    sorteioAoVivo,
    alternarJogo,
    sortear,
    sair,
    mostrarAviso
  } = useSala();

  const [overlay, setOverlay] = useState<{ sorteio: Sorteio; animar: boolean } | null>(null);
  const ultimoVisto = useRef<string | null>(null);

  // Sem sala carregada, o caminho natural é a tela de entrar (com o código já preenchido).
  useEffect(() => {
    if (restaurando) return;
    if (!estado) {
      navigate(codigo ? `/entrar?sala=${codigo}` : '/entrar', { replace: true });
      return;
    }
    if (codigo?.toUpperCase() !== estado.codigo) {
      navigate(`/sala/${estado.codigo}`, { replace: true });
    }
  }, [estado, restaurando, codigo, navigate]);

  // Sorteio novo chegando pelo socket: todo mundo vê a mesma animação.
  useEffect(() => {
    if (!sorteioAoVivo || ultimoVisto.current === sorteioAoVivo.drawId) return;
    ultimoVisto.current = sorteioAoVivo.drawId;
    setOverlay({ sorteio: sorteioAoVivo, animar: true });
  }, [sorteioAoVivo]);

  const ativos = useMemo(() => new Set(estado?.jogosAtivos ?? []), [estado]);

  if (restaurando || !estado) {
    return (
      <main className="tela">
        <div className="carregando">
          <span className="girando" aria-hidden="true">
            🎲
          </span>
          <p>Voltando pra sala...</p>
        </div>
      </main>
    );
  }

  const link = linkDaSala(estado.codigo);
  const ultimoSorteio = estado.ultimoSorteio;
  const jogoDoUltimo = ultimoSorteio
    ? estado.catalogo.find((j) => j.id === ultimoSorteio.gameId)
    : undefined;

  async function compartilhar() {
    if (!estado) return;
    const texto = `Bora jogar? Entra na sala "${estado.nomeGrupo}" no Sorteia Aí — código ${estado.codigo}`;
    const foi = await compartilharNativo({ title: 'Sorteia Aí', text: texto, url: link });
    if (foi) return;
    const copiou = await copiarTexto(`${texto}\n${link}`);
    mostrarAviso(copiou ? 'Link copiado! Manda no grupo 🚀' : 'Copia o link da barra de endereço 🙏');
  }

  async function copiarCodigo() {
    if (!estado) return;
    const copiou = await copiarTexto(estado.codigo);
    mostrarAviso(copiou ? `Código ${estado.codigo} copiado!` : `O código é ${estado.codigo}`);
  }

  async function sairDaSala() {
    await sair();
    navigate('/', { replace: true });
  }

  function ligarTodos() {
    for (const jogo of estado?.catalogo ?? []) {
      if (!ativos.has(jogo.id)) alternarJogo(jogo.id, true);
    }
  }

  const podeSortear = conectado && ativos.size > 0;

  return (
    <main className="tela">
      <div className="topo">
        <button type="button" className="voltar" onClick={sairDaSala} aria-label="Sair da sala">
          ←
        </button>
        <span className="topo__titulo">{estado.nomeGrupo}</span>
        <span className="espaco" />
        <span className={`status-conexao ${conectado ? '' : 'status-conexao--off'}`}>
          <span className="status-conexao__bolinha" aria-hidden="true" />
          {conectado ? 'ao vivo' : 'reconectando'}
        </span>
      </div>

      <section className="card card--destaque">
        <p className="rotulo" style={{ marginBottom: 2 }}>
          Código da sala
        </p>
        <div className="codigo-caixa">
          <span className="codigo">{estado.codigo}</span>
          <span className="espaco" />
          <button type="button" className="botao botao--pequeno botao--secundario" onClick={copiarCodigo}>
            Copiar
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          <button type="button" className="botao botao--primario" onClick={compartilhar}>
            📲 Compartilhar convite
          </button>
        </div>
      </section>

      <section className="card">
        <Participantes jogadores={estado.jogadores} euId={jogadorId} />
      </section>

      {ultimoSorteio && jogoDoUltimo && (
        <button
          type="button"
          className="card"
          style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
          onClick={() => setOverlay({ sorteio: ultimoSorteio, animar: false })}
        >
          <p className="legenda">Último sorteio</p>
          <p style={{ fontWeight: 700, fontSize: 17, marginTop: 2 }}>
            {jogoDoUltimo.emoji} {jogoDoUltimo.nome}
          </p>
          <p className="legenda" style={{ marginTop: 4 }}>
            Toque para rever as regras
          </p>
        </button>
      )}

      <section className="pilha">
        <div className="linha">
          <h2 style={{ fontSize: 17 }}>O que pode cair no sorteio</h2>
          <span className="espaco" />
          <span className="legenda">
            {ativos.size}/{estado.catalogo.length}
          </span>
        </div>
        <p className="legenda" style={{ marginTop: -6 }}>
          Toque pra ligar ou desligar. A escolha vale pra sala inteira.
        </p>

        <div className="jogos">
          {estado.catalogo.map((jogo, i) => (
            <JogoCard
              key={jogo.id}
              jogo={jogo}
              indice={i}
              ativo={ativos.has(jogo.id)}
              onAlternar={(ativo) => alternarJogo(jogo.id, ativo)}
            />
          ))}
        </div>

        {ativos.size < estado.catalogo.length && (
          <button type="button" className="botao botao--fantasma" onClick={ligarTodos}>
            Ligar todos de novo
          </button>
        )}
      </section>

      <button type="button" className="botao botao--fantasma" onClick={sairDaSala}>
        Sair da sala
      </button>

      <div className="barra-sortear">
        <button type="button" className="botao botao--festa" onClick={sortear} disabled={!podeSortear}>
          🎲 Sortear brincadeira
        </button>
      </div>

      {overlay && (
        <SorteioOverlay
          sorteio={overlay.sorteio}
          catalogo={estado.catalogo}
          animar={overlay.animar}
          podeSortear={podeSortear}
          onSortearOutro={sortear}
          onFechar={() => setOverlay(null)}
        />
      )}
    </main>
  );
}
