import { randomUUID } from 'node:crypto';
import { GAMES, GAME_IDS, getGame } from './games.js';
import type { DrawResult, Player, Room, RoomState } from './types.js';

/** Sem 0/O e 1/I para ninguém errar ao digitar o código. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TAMANHO_CODIGO = 4;

export const LIMITES = {
  maxJogadores: 30,
  maxSalas: 5000,
  maxApelido: 18,
  maxNomeGrupo: 30,
  /** tempo que um jogador desconectado continua na lista antes de sumir */
  toleranciaReconexaoMs: 2 * 60 * 1000,
  /** sala vazia (ninguém online) é descartada depois disso */
  vidaSalaVaziaMs: 15 * 60 * 1000,
  /** sala sem nenhuma atividade é descartada depois disso */
  vidaSalaOciosaMs: 6 * 60 * 60 * 1000
};

const salas = new Map<string, Room>();

export function limparTexto(valor: unknown, max: number): string {
  if (typeof valor !== 'string') return '';
  return valor.replace(/\s+/g, ' ').trim().slice(0, max);
}

function gerarCodigo(): string {
  for (let tentativa = 0; tentativa < 50; tentativa += 1) {
    let codigo = '';
    for (let i = 0; i < TAMANHO_CODIGO; i += 1) {
      codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
    }
    if (!salas.has(codigo)) return codigo;
  }
  // Fallback improvável: cresce o código até achar um livre.
  let codigo = randomUUID().replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
  while (salas.has(codigo)) codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return codigo;
}

export function normalizarCodigo(codigo: unknown): string {
  if (typeof codigo !== 'string') return '';
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function getSala(codigo: string): Room | undefined {
  return salas.get(normalizarCodigo(codigo));
}

export function totalSalas(): number {
  return salas.size;
}

export function criarSala(nomeGrupo: string, apelido: string): { sala: Room; jogador: Player } {
  if (salas.size >= LIMITES.maxSalas) {
    throw new Error('Muitas salas abertas agora. Tenta de novo em alguns minutos!');
  }
  const codigo = gerarCodigo();
  const jogador: Player = {
    id: randomUUID(),
    apelido,
    isHost: true,
    online: true,
    lastSeen: Date.now()
  };
  const sala: Room = {
    codigo,
    nomeGrupo,
    jogadores: [jogador],
    jogosAtivos: new Set(GAME_IDS),
    ultimoSorteio: null,
    criadaEm: Date.now(),
    atualizadaEm: Date.now()
  };
  salas.set(codigo, sala);
  return { sala, jogador };
}

export function entrarNaSala(codigo: string, apelido: string): { sala: Room; jogador: Player } {
  const sala = getSala(codigo);
  if (!sala) throw new Error('Não achamos essa sala. Confere o código!');

  const ativos = sala.jogadores.filter((j) => j.online).length;
  if (ativos >= LIMITES.maxJogadores) {
    throw new Error(`Essa sala já está com ${LIMITES.maxJogadores} pessoas. Lotou!`);
  }

  const jogador: Player = {
    id: randomUUID(),
    apelido: apelidoDisponivel(sala, apelido),
    isHost: sala.jogadores.every((j) => !j.online),
    online: true,
    lastSeen: Date.now()
  };
  sala.jogadores.push(jogador);
  sala.atualizadaEm = Date.now();
  garantirHost(sala);
  return { sala, jogador };
}

/** Dois "Ju" na mesma sala viram "Ju" e "Ju (2)". */
function apelidoDisponivel(sala: Room, apelido: string): string {
  const usados = new Set(sala.jogadores.map((j) => j.apelido.toLowerCase()));
  if (!usados.has(apelido.toLowerCase())) return apelido;
  for (let i = 2; i < 100; i += 1) {
    const candidato = `${apelido} (${i})`;
    if (!usados.has(candidato.toLowerCase())) return candidato;
  }
  return apelido;
}

export function reentrarNaSala(codigo: string, jogadorId: string): { sala: Room; jogador: Player } {
  const sala = getSala(codigo);
  if (!sala) throw new Error('Essa sala não existe mais.');
  const jogador = sala.jogadores.find((j) => j.id === jogadorId);
  if (!jogador) throw new Error('Você não está mais nessa sala.');
  jogador.online = true;
  jogador.lastSeen = Date.now();
  sala.atualizadaEm = Date.now();
  garantirHost(sala);
  return { sala, jogador };
}

export function marcarOffline(codigo: string, jogadorId: string): Room | undefined {
  const sala = getSala(codigo);
  if (!sala) return undefined;
  const jogador = sala.jogadores.find((j) => j.id === jogadorId);
  if (!jogador) return sala;
  jogador.online = false;
  jogador.lastSeen = Date.now();
  sala.atualizadaEm = Date.now();
  garantirHost(sala);
  return sala;
}

export function sairDaSala(codigo: string, jogadorId: string): Room | undefined {
  const sala = getSala(codigo);
  if (!sala) return undefined;
  sala.jogadores = sala.jogadores.filter((j) => j.id !== jogadorId);
  sala.atualizadaEm = Date.now();
  if (sala.jogadores.length === 0) {
    salas.delete(sala.codigo);
    return undefined;
  }
  garantirHost(sala);
  return sala;
}

/** Sempre existe exatamente um host, de preferência alguém online. */
function garantirHost(sala: Room): void {
  const hostAtual = sala.jogadores.find((j) => j.isHost);
  if (hostAtual?.online) return;
  const proximo = sala.jogadores.find((j) => j.online) ?? sala.jogadores[0];
  if (!proximo) return;
  for (const j of sala.jogadores) j.isHost = j.id === proximo.id;
}

export function alternarJogo(codigo: string, gameId: string, ativo: boolean): Room {
  const sala = getSala(codigo);
  if (!sala) throw new Error('Sala não encontrada.');
  if (!getGame(gameId)) throw new Error('Jogo desconhecido.');

  if (ativo) {
    sala.jogosAtivos.add(gameId);
  } else {
    if (sala.jogosAtivos.size <= 1 && sala.jogosAtivos.has(gameId)) {
      throw new Error('Deixa pelo menos um jogo ligado, senão não tem o que sortear!');
    }
    sala.jogosAtivos.delete(gameId);
  }
  sala.atualizadaEm = Date.now();
  return sala;
}

export function definirJogosAtivos(codigo: string, ids: string[]): Room {
  const sala = getSala(codigo);
  if (!sala) throw new Error('Sala não encontrada.');
  const validos = ids.filter((id) => getGame(id));
  if (validos.length === 0) throw new Error('Escolhe pelo menos um jogo!');
  sala.jogosAtivos = new Set(validos);
  sala.atualizadaEm = Date.now();
  return sala;
}

export function sortear(codigo: string, jogadorId: string): { sala: Room; sorteio: DrawResult } {
  const sala = getSala(codigo);
  if (!sala) throw new Error('Sala não encontrada.');

  const ativos = GAME_IDS.filter((id) => sala.jogosAtivos.has(id));
  if (ativos.length === 0) throw new Error('Nenhum jogo ativo para sortear.');

  // Evita repetir o jogo anterior quando há alternativa.
  const anterior = sala.ultimoSorteio?.gameId;
  const candidatos = ativos.length > 1 && anterior ? ativos.filter((id) => id !== anterior) : ativos;
  const escolhido = candidatos[Math.floor(Math.random() * candidatos.length)] ?? ativos[0]!;

  const sorteio: DrawResult = {
    drawId: randomUUID(),
    gameId: escolhido,
    reel: montarReel(ativos, escolhido),
    sorteadoPor: sala.jogadores.find((j) => j.id === jogadorId)?.apelido ?? 'Alguém',
    em: Date.now()
  };
  sala.ultimoSorteio = sorteio;
  sala.atualizadaEm = Date.now();
  return { sala, sorteio };
}

/** Nomes que passam na roleta antes de parar no resultado (iguais em todos os celulares). */
function montarReel(ativos: string[], escolhido: string): string[] {
  const nomes = ativos.map((id) => getGame(id)?.nome ?? id);
  const reel: string[] = [];
  const alvo = 14;
  while (reel.length < alvo) {
    const embaralhado = [...nomes].sort(() => Math.random() - 0.5);
    reel.push(...embaralhado);
  }
  reel.length = alvo;
  reel.push(getGame(escolhido)?.nome ?? escolhido);
  return reel;
}

export function paraEstado(sala: Room): RoomState {
  return {
    codigo: sala.codigo,
    nomeGrupo: sala.nomeGrupo,
    jogadores: sala.jogadores.map((j) => ({
      id: j.id,
      apelido: j.apelido,
      isHost: j.isHost,
      online: j.online
    })),
    jogosAtivos: GAME_IDS.filter((id) => sala.jogosAtivos.has(id)),
    catalogo: GAMES,
    ultimoSorteio: sala.ultimoSorteio
  };
}

/**
 * Faxina periódica: tira quem caiu faz tempo e derruba salas abandonadas.
 * Devolve os códigos das salas que mudaram, para reemitir o estado.
 */
export function faxina(): { alteradas: string[]; removidas: string[] } {
  const agora = Date.now();
  const alteradas: string[] = [];
  const removidas: string[] = [];

  for (const sala of [...salas.values()]) {
    const antes = sala.jogadores.length;
    sala.jogadores = sala.jogadores.filter(
      (j) => j.online || agora - j.lastSeen < LIMITES.toleranciaReconexaoMs
    );
    const mudou = sala.jogadores.length !== antes;

    const temOnline = sala.jogadores.some((j) => j.online);
    const vazia = sala.jogadores.length === 0;
    const abandonada = !temOnline && agora - sala.atualizadaEm > LIMITES.vidaSalaVaziaMs;
    const ociosa = agora - sala.atualizadaEm > LIMITES.vidaSalaOciosaMs;

    if (vazia || abandonada || ociosa) {
      salas.delete(sala.codigo);
      removidas.push(sala.codigo);
      continue;
    }
    if (mudou) {
      garantirHost(sala);
      alteradas.push(sala.codigo);
    }
  }
  return { alteradas, removidas };
}
