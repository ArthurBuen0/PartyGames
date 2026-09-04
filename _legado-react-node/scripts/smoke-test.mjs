import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';
const ok = [];
const falhas = [];

function checar(nome, condicao, extra = '') {
  if (condicao) ok.push(nome);
  else falhas.push(`${nome} ${extra}`);
  console.log(`${condicao ? '✓' : '✗'} ${nome} ${condicao ? '' : extra}`);
}

function conectar() {
  const s = io(URL, { transports: ['websocket'] });
  return new Promise((resolve, reject) => {
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
    setTimeout(() => reject(new Error('timeout conectando')), 5000);
  });
}

function emitir(s, evento, payload) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`sem ack em ${evento}`)), 5000);
    s.emit(evento, payload, (r) => {
      clearTimeout(t);
      resolve(r);
    });
  });
}

function esperar(s, evento, filtro = () => true, ms = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`sem evento ${evento}`)), ms);
    const handler = (dados) => {
      if (!filtro(dados)) return;
      clearTimeout(t);
      s.off(evento, handler);
      resolve(dados);
    };
    s.on(evento, handler);
  });
}

// --- HTTP -------------------------------------------------------------
const saude = await (await fetch(`${URL}/api/health`)).json();
checar('GET /api/health responde ok', saude.ok === true, JSON.stringify(saude));

const home = await fetch(`${URL}/`);
const html = await home.text();
checar('GET / entrega o PWA', home.status === 200 && html.includes('<div id="root">'));

const manifest = await (await fetch(`${URL}/manifest.webmanifest`)).json();
checar('manifest tem nome e ícones', manifest.short_name === 'Sorteia Aí' && manifest.icons.length === 3, JSON.stringify(manifest.icons?.length));

const sw = await fetch(`${URL}/sw.js`);
checar('service worker é servido', sw.status === 200);

const icone = await fetch(`${URL}/icons/icon-512.png`);
checar('ícone 512 é servido como png', icone.status === 200 && icone.headers.get('content-type') === 'image/png');

// --- Sala em tempo real ----------------------------------------------
const ana = await conectar();
const criacao = await emitir(ana, 'sala:criar', { nomeGrupo: 'Churrasco de sábado', apelido: 'Ana' });
checar('cria sala', criacao.ok === true, JSON.stringify(criacao));
const codigo = criacao.data.estado.codigo;
const anaId = criacao.data.jogadorId;
checar('código tem 4 caracteres', /^[A-Z0-9]{4}$/.test(codigo), codigo);
checar('todos os 7 jogos vêm ativos', criacao.data.estado.jogosAtivos.length === 7);
checar('catálogo tem 7 jogos com regras', criacao.data.estado.catalogo.every((j) => j.regras.length >= 3));

// Bia entra e Ana precisa ver na hora.
const estadoNaAna = esperar(ana, 'sala:estado', (e) => e.jogadores.length === 2);
const bia = await conectar();
const entrada = await emitir(bia, 'sala:entrar', { codigo, apelido: 'Bia' });
checar('entra pelo código', entrada.ok === true, JSON.stringify(entrada));
const biaId = entrada.data.jogadorId;
const visto = await estadoNaAna;
checar('lista de participantes atualiza em tempo real', visto.jogadores.map((j) => j.apelido).sort().join(',') === 'Ana,Bia');
checar('quem criou é host', visto.jogadores.find((j) => j.apelido === 'Ana').isHost === true);

// Código errado.
const erro = await emitir(bia, 'sala:entrar', { codigo: 'ZZZZ', apelido: 'Zé' });
checar('código inexistente dá erro amigável', erro.ok === false && /sala/i.test(erro.erro), JSON.stringify(erro));

// Errar o código não pode expulsar quem já estava numa sala.
const aindaNaSala = await emitir(bia, 'sala:reentrar', { codigo, jogadorId: biaId });
checar(
  'código errado não expulsa da sala atual',
  aindaNaSala.ok === true && aindaNaSala.data.estado.jogadores.some((j) => j.id === biaId),
  JSON.stringify(aindaNaSala.erro ?? '')
);

// Apelido repetido.
const cadu = await conectar();
const repetido = await emitir(cadu, 'sala:entrar', { codigo, apelido: 'Ana' });
checar('apelido repetido vira "Ana (2)"', repetido.data.estado.jogadores.filter((j) => j.apelido === 'Ana (2)').length === 1);
await emitir(cadu, 'sala:sair', null);

// Desligar jogo propaga para todo mundo.
const propagou = esperar(ana, 'sala:estado', (e) => !e.jogosAtivos.includes('mimica'));
bia.emit('sala:alternar-jogo', { gameId: 'mimica', ativo: false });
const semMimica = await propagou;
checar('desligar jogo propaga para a sala', semMimica.jogosAtivos.length === 6);

// Sorteio chega igual nos dois aparelhos.
const naAna = esperar(ana, 'sala:sorteio');
const naBia = esperar(bia, 'sala:sorteio');
ana.emit('sala:sortear');
const [s1, s2] = await Promise.all([naAna, naBia]);
checar('sorteio chega nos dois aparelhos', s1.drawId === s2.drawId && s1.gameId === s2.gameId, `${s1.gameId} vs ${s2.gameId}`);
checar('roleta é idêntica nos dois', JSON.stringify(s1.reel) === JSON.stringify(s2.reel));
checar('jogo desligado não é sorteado', s1.gameId !== 'mimica', s1.gameId);
checar('sorteio registra quem sorteou', s1.sorteadoPor === 'Ana', s1.sorteadoPor);

// Não repete o jogo anterior.
const repeticoes = new Set();
for (let i = 0; i < 5; i += 1) {
  const proximo = esperar(bia, 'sala:sorteio');
  await new Promise((r) => setTimeout(r, 1600));
  bia.emit('sala:sortear');
  const s = await proximo;
  repeticoes.add(s.gameId);
}
checar('sorteios seguidos variam os jogos', repeticoes.size >= 3, [...repeticoes].join(','));

// Queda de conexão: fica offline e volta com o mesmo jogador.
const ficouOffline = esperar(ana, 'sala:estado', (e) => e.jogadores.some((j) => j.id === biaId && !j.online));
bia.disconnect();
await ficouOffline;
checar('quem cai aparece como offline', true);

const bia2 = await conectar();
const volta = await emitir(bia2, 'sala:reentrar', { codigo, jogadorId: biaId });
checar('reconectar mantém o mesmo jogador', volta.ok === true && volta.data.estado.jogadores.filter((j) => j.apelido === 'Bia').length === 1, JSON.stringify(volta.erro ?? ''));

// Sair de vez.
const saiu = esperar(ana, 'sala:estado', (e) => e.jogadores.length === 1);
await emitir(bia2, 'sala:sair', null);
await saiu;
checar('sair remove da lista', true);

// Trocar de sala na mesma aba não pode deixar "fantasma" na sala anterior.
const anfitriao = await conectar();
const salaA = await emitir(anfitriao, 'sala:criar', { nomeGrupo: 'Sala A', apelido: 'Host' });
const nomade = await conectar();
await emitir(nomade, 'sala:entrar', { codigo: salaA.data.estado.codigo, apelido: 'Nômade' });
const ficouSozinho = esperar(anfitriao, 'sala:estado', (e) => e.jogadores.length === 1).then(
  () => true,
  () => false
);
await emitir(nomade, 'sala:criar', { nomeGrupo: 'Sala B', apelido: 'Nômade' });
checar('trocar de sala não deixa fantasma na anterior', await ficouSozinho);
anfitriao.disconnect();
nomade.disconnect();

// Não dá pra desligar o último jogo.
const estadoAtual = await emitir(ana, 'sala:reentrar', { codigo, jogadorId: anaId });
for (const jogo of estadoAtual.data.estado.catalogo) {
  ana.emit('sala:alternar-jogo', { gameId: jogo.id, ativo: false });
}
await new Promise((r) => setTimeout(r, 400));
const depois = await emitir(ana, 'sala:reentrar', { codigo, jogadorId: anaId });
checar('sempre sobra pelo menos 1 jogo ligado', depois.data.estado.jogosAtivos.length === 1, JSON.stringify(depois.data.estado.jogosAtivos));

ana.disconnect();
bia2.disconnect();

console.log(`\n${ok.length} ok, ${falhas.length} falhas`);
if (falhas.length) {
  console.log(falhas.join('\n'));
  process.exit(1);
}
process.exit(0);
