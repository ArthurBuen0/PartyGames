import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import { GAMES } from './games.js';
import {
  LIMITES,
  alternarJogo,
  criarSala,
  entrarNaSala,
  faxina,
  getSala,
  limparTexto,
  marcarOffline,
  normalizarCodigo,
  paraEstado,
  reentrarNaSala,
  sairDaSala,
  sortear,
  totalSalas
} from './rooms.js';
import type { Ack, RoomState } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(compression());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, salas: totalSalas(), uptime: Math.round(process.uptime()) });
});

app.get('/api/jogos', (_req, res) => {
  res.json({ jogos: GAMES });
});

/** Em produção o mesmo servidor entrega o PWA já buildado. */
const candidatosDist = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(process.cwd(), 'client/dist')
];
const clientDist = candidatosDist.find((p) => existsSync(path.join(p, 'index.html')));

if (clientDist) {
  app.use(
    express.static(clientDist, {
      setHeaders(res, filePath) {
        // O SW e o manifest precisam ser sempre frescos; o resto tem hash no nome.
        if (/(sw\.js|manifest\.webmanifest|index\.html)$/.test(filePath)) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (/\/assets\//.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    })
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
  // Reconexão rápida é o que mantém a lista de participantes honesta.
  pingInterval: 20000,
  pingTimeout: 20000
});

type SocketData = { codigo?: string; jogadorId?: string; ultimoSorteio?: number };

function dados(socket: Socket): SocketData {
  return socket.data as SocketData;
}

function emitirEstado(codigo: string): RoomState | undefined {
  const sala = getSala(codigo);
  if (!sala) return undefined;
  const estado = paraEstado(sala);
  io.to(codigo).emit('sala:estado', estado);
  return estado;
}

/**
 * Trocar de sala na mesma aba não pode deixar um fantasma "online" na sala
 * anterior — o socket continua vivo, então ninguém sairia sozinho de lá.
 */
function largarSalaAtual(socket: Socket, exceto?: string): void {
  const { codigo, jogadorId } = dados(socket);
  if (!codigo || !jogadorId || codigo === exceto) return;
  sairDaSala(codigo, jogadorId);
  void socket.leave(codigo);
  emitirEstado(codigo);
  dados(socket).codigo = undefined;
  dados(socket).jogadorId = undefined;
}

function falha(erro: unknown): Ack<never> {
  const mensagem = erro instanceof Error ? erro.message : 'Deu ruim aqui. Tenta de novo!';
  return { ok: false, erro: mensagem };
}

type EntrarPayload = { codigo?: unknown; apelido?: unknown };
type CriarPayload = { nomeGrupo?: unknown; apelido?: unknown };
type ReentrarPayload = { codigo?: unknown; jogadorId?: unknown };
type SessaoAck = { estado: RoomState; jogadorId: string };
type Callback<T> = (resposta: Ack<T>) => void;

function ehFuncao(valor: unknown): valor is Callback<SessaoAck> {
  return typeof valor === 'function';
}

io.on('connection', (socket) => {
  socket.on('sala:criar', (payload: CriarPayload, cb: unknown) => {
    if (!ehFuncao(cb)) return;
    try {
      const nomeGrupo = limparTexto(payload?.nomeGrupo, LIMITES.maxNomeGrupo) || 'Turma sem nome';
      const apelido = limparTexto(payload?.apelido, LIMITES.maxApelido);
      if (!apelido) throw new Error('Escolhe um apelido pra galera te reconhecer!');

      const { sala, jogador } = criarSala(nomeGrupo, apelido);
      largarSalaAtual(socket, sala.codigo);
      dados(socket).codigo = sala.codigo;
      dados(socket).jogadorId = jogador.id;
      void socket.join(sala.codigo);

      cb({ ok: true, data: { estado: paraEstado(sala), jogadorId: jogador.id } });
      emitirEstado(sala.codigo);
    } catch (erro) {
      cb(falha(erro));
    }
  });

  socket.on('sala:entrar', (payload: EntrarPayload, cb: unknown) => {
    if (!ehFuncao(cb)) return;
    try {
      const codigo = normalizarCodigo(payload?.codigo);
      const apelido = limparTexto(payload?.apelido, LIMITES.maxApelido);
      if (!codigo) throw new Error('Digita o código da sala.');
      if (!apelido) throw new Error('Escolhe um apelido pra galera te reconhecer!');

      const { sala, jogador } = entrarNaSala(codigo, apelido);
      largarSalaAtual(socket, sala.codigo);
      dados(socket).codigo = sala.codigo;
      dados(socket).jogadorId = jogador.id;
      void socket.join(sala.codigo);

      cb({ ok: true, data: { estado: paraEstado(sala), jogadorId: jogador.id } });
      emitirEstado(sala.codigo);
    } catch (erro) {
      cb(falha(erro));
    }
  });

  /** Voltar depois de fechar a aba / perder sinal, sem virar um jogador novo. */
  socket.on('sala:reentrar', (payload: ReentrarPayload, cb: unknown) => {
    if (!ehFuncao(cb)) return;
    try {
      const codigo = normalizarCodigo(payload?.codigo);
      const jogadorId = typeof payload?.jogadorId === 'string' ? payload.jogadorId : '';
      if (!codigo || !jogadorId) throw new Error('Sessão inválida.');

      const { sala, jogador } = reentrarNaSala(codigo, jogadorId);
      largarSalaAtual(socket, sala.codigo);
      dados(socket).codigo = sala.codigo;
      dados(socket).jogadorId = jogador.id;
      void socket.join(sala.codigo);

      cb({ ok: true, data: { estado: paraEstado(sala), jogadorId: jogador.id } });
      emitirEstado(sala.codigo);
    } catch (erro) {
      cb(falha(erro));
    }
  });

  socket.on('sala:alternar-jogo', (payload: { gameId?: unknown; ativo?: unknown }) => {
    const { codigo } = dados(socket);
    if (!codigo) return;
    try {
      const gameId = typeof payload?.gameId === 'string' ? payload.gameId : '';
      const ativo = Boolean(payload?.ativo);
      alternarJogo(codigo, gameId, ativo);
      emitirEstado(codigo);
    } catch (erro) {
      socket.emit('sala:aviso', erro instanceof Error ? erro.message : 'Não rolou.');
      emitirEstado(codigo);
    }
  });

  socket.on('sala:sortear', () => {
    const info = dados(socket);
    if (!info.codigo || !info.jogadorId) return;

    // Trava contra dedo nervoso: um sorteio por vez.
    const agora = Date.now();
    if (info.ultimoSorteio && agora - info.ultimoSorteio < 1500) return;
    info.ultimoSorteio = agora;

    try {
      const { sorteio } = sortear(info.codigo, info.jogadorId);
      io.to(info.codigo).emit('sala:sorteio', sorteio);
      emitirEstado(info.codigo);
    } catch (erro) {
      socket.emit('sala:aviso', erro instanceof Error ? erro.message : 'Não rolou o sorteio.');
    }
  });

  socket.on('sala:sair', (_payload: unknown, cb: unknown) => {
    const { codigo, jogadorId } = dados(socket);
    if (codigo && jogadorId) {
      sairDaSala(codigo, jogadorId);
      void socket.leave(codigo);
      emitirEstado(codigo);
    }
    dados(socket).codigo = undefined;
    dados(socket).jogadorId = undefined;
    if (typeof cb === 'function') (cb as () => void)();
  });

  socket.on('disconnect', () => {
    const { codigo, jogadorId } = dados(socket);
    if (!codigo || !jogadorId) return;
    marcarOffline(codigo, jogadorId);
    emitirEstado(codigo);
  });
});

setInterval(() => {
  const { alteradas, removidas } = faxina();
  for (const codigo of alteradas) emitirEstado(codigo);
  for (const codigo of removidas) io.to(codigo).emit('sala:encerrada');
}, 30_000).unref();

httpServer.listen(PORT, () => {
  const modo = clientDist ? `servindo o PWA de ${clientDist}` : 'somente API (rode o client com "npm run dev")';
  console.log(`🎲 Sorteia Aí no ar em http://localhost:${PORT} — ${modo}`);
});
