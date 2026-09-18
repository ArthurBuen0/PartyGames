/**
 * Testes do banco — Postgres de verdade, rodando em WASM (PGlite).
 *
 *   npm run test:sql
 *
 * Sobe um Postgres limpo, cria os stubs que o Supabase fornece (schema `auth`,
 * papéis `anon`/`authenticated`), aplica os cinco arquivos SQL na ordem e joga
 * partidas inteiras trocando de usuário a cada chamada.
 *
 * O que realmente importa aqui é o RLS: cada consulta roda com
 * `set role authenticated`, então as políticas valem de verdade. É assim que dá
 * para afirmar que o segredo de um jogador não chega no cliente do outro.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ----------------------------------------------------------- mini framework */

let passou = 0;
const falhas = [];
let grupoAtual = "";

function grupo(nome) {
  grupoAtual = nome;
  console.log(`\n[1m── ${nome} ──[0m`);
}

function ok(condicao, mensagem) {
  if (condicao) {
    passou += 1;
    console.log(`  [32m✓[0m ${mensagem}`);
  } else {
    falhas.push(`[${grupoAtual}] ${mensagem}`);
    console.log(`  [31m✗ ${mensagem}[0m`);
  }
}

/** Espera que a chamada falhe com um código de erro específico. */
async function esperaErro(fn, codigo, mensagem) {
  try {
    await fn();
    ok(false, `${mensagem} (não levantou erro nenhum)`);
  } catch (erro) {
    const texto = String(erro.message || erro);
    ok(texto.includes(codigo), `${mensagem} → ${texto.split("\n")[0].slice(0, 90)}`);
  }
}

/* ------------------------------------------------------------------ banco */

const db = new PGlite();

// O que o Supabase já entrega pronto e o PGlite não tem
await db.exec(`
  create schema if not exists auth;

  create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);

for (const arquivo of [
  "01_schema.sql",
  "02_policies.sql",
  "03_funcoes.sql",
  "04_seed.sql",
  "05_realtime.sql"
]) {
  try {
    await db.exec(readFileSync(path.join(RAIZ, arquivo), "utf8"));
    console.log(`[90m  aplicado ${arquivo}[0m`);
  } catch (erro) {
    console.error(`\n[31mFalha ao aplicar ${arquivo}:[0m\n${erro.message}`);
    process.exit(1);
  }
}

/* ------------------------------------------------ trocar de usuário/sessão */

const UID = {
  ana: "11111111-1111-4111-8111-111111111111",
  bruno: "22222222-2222-4222-8222-222222222222",
  carla: "33333333-3333-4333-8333-333333333333",
  davi: "44444444-4444-4444-8444-444444444444",
  estranho: "99999999-9999-4999-8999-999999999999"
};

/** Roda uma consulta como um usuário autenticado — com RLS valendo. */
async function como(uid, sql, params = []) {
  await db.exec(`set role authenticated;`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
  try {
    const r = await db.query(sql, params);
    return r.rows;
  } finally {
    await db.exec(`reset role;`);
  }
}

/** Uma chamada RPC como usuário; devolve o valor escalar. */
async function rpc(uid, chamada, params = []) {
  const linhas = await como(uid, `select ${chamada} as r`, params);
  return linhas[0]?.r;
}

/** Consulta administrativa (sem RLS) — usada só para montar cenários. */
async function admin(sql, params = []) {
  const r = await db.query(sql, params);
  return r.rows;
}

/** Força o cronômetro a estourar sem esperar de verdade. */
async function estourarTempo(rodadaId) {
  await admin(`update rodadas set turno_fim = now() - interval '1 second' where id = $1`, [rodadaId]);
}

/* ========================================================================= */
/* 1. SALA                                                                   */
/* ========================================================================= */

grupo("Sala: criar, entrar, reconectar");

const criada = await rpc(UID.ana, `criar_sala($1)`, ["Ana"]);
const salaId = criada.sala_id;
const codigo = criada.codigo;
ok(/^[A-Z0-9]{4}$/.test(codigo), `sala criada com código ${codigo}`);

const eBruno = await rpc(UID.bruno, `entrar_sala($1, $2)`, [codigo, "Bruno"]);
const eCarla = await rpc(UID.carla, `entrar_sala($1, $2)`, [codigo, "Carla"]);
ok(eBruno.participante_id && eCarla.participante_id, "Bruno e Carla entraram");

const P = {};
for (const linha of await admin(`select id, apelido from participantes where sala_id = $1`, [salaId])) {
  P[linha.apelido.toLowerCase()] = linha.id;
}

const listaAna = await como(UID.ana, `select apelido, e_anfitriao from participantes order by ordem`);
ok(listaAna.length === 3, `sala com ${listaAna.length} participantes`);
ok(listaAna[0].apelido === "Ana" && listaAna[0].e_anfitriao === true, "Ana é a anfitriã");

// RLS: quem não entrou não enxerga nada da sala
const doEstranho = await como(UID.estranho, `select * from salas`);
const partsEstranho = await como(UID.estranho, `select * from participantes`);
ok(doEstranho.length === 0, "quem não está na sala não lê a sala (RLS)");
ok(partsEstranho.length === 0, "quem não está na sala não lê os participantes (RLS)");

await esperaErro(() => rpc(UID.davi, `entrar_sala($1, $2)`, ["ZZZZ", "Davi"]),
  "SALA_NAO_ENCONTRADA", "código inexistente é recusado");
await esperaErro(() => rpc(UID.davi, `entrar_sala($1, $2)`, [codigo, "ana"]),
  "APELIDO_EM_USO", "apelido repetido é recusado");
await esperaErro(() => rpc(UID.davi, `entrar_sala($1, $2)`, [codigo, "  "]),
  "APELIDO_INVALIDO", "apelido vazio é recusado");

const rejoin = await rpc(UID.bruno, `entrar_sala($1, $2)`, [codigo, "Bruno"]);
const totalDepois = await admin(`select count(*)::int n from participantes where sala_id = $1`, [salaId]);
ok(rejoin.reconectado === true, "recarregar a página reconecta no mesmo assento");
ok(totalDepois[0].n === 3, "reconexão não cria participante duplicado");

// Saiu e, enquanto estava fora, outra pessoa assumiu o apelido dele
await rpc(UID.bruno, `sair_sala($1)`, [salaId]);
await rpc(UID.davi, `entrar_sala($1, $2)`, [codigo, "Bruno"]);
await esperaErro(() => rpc(UID.bruno, `entrar_sala($1, $2)`, [codigo, "Bruno"]),
  "APELIDO_EM_USO", "voltar com apelido que outra pessoa assumiu é recusado");
await rpc(UID.davi, `sair_sala($1)`, [salaId]);
await rpc(UID.bruno, `entrar_sala($1, $2)`, [codigo, "Bruno"]);

await rpc(UID.davi, `entrar_sala($1, $2)`, [codigo, "Davi"]);
for (const linha of await admin(`select id, apelido from participantes where sala_id = $1`, [salaId])) {
  P[linha.apelido.toLowerCase()] = linha.id;
}
ok(Object.keys(P).length === 4, "Davi entrou: 4 pessoas na sala");

grupo("Sala: quem manda é o anfitrião");

await esperaErro(() => rpc(UID.bruno, `definir_jogo($1, 'mimica')`, [salaId]),
  "SO_O_ANFITRIAO", "jogador comum não escolhe o jogo");
await rpc(UID.ana, `definir_jogo($1, 'mimica')`, [salaId]);
const salaJogo = await admin(`select jogo_atual from salas where id = $1`, [salaId]);
ok(salaJogo[0].jogo_atual === "mimica", "anfitriã escolheu o jogo");

await esperaErro(() => rpc(UID.bruno, `remover_participante($1)`, [P.davi]),
  "SO_O_ANFITRIAO", "jogador comum não remove ninguém");

/* ========================================================================= */
/* 2. C, S, COMPOSTO                                                         */
/* ========================================================================= */

grupo("C, S, Composto: prontos, cadeia de 10s e votação anônima");

let r = await rpc(UID.ana, `iniciar_partida($1, 'c-s-composto', $2)`,
  [salaId, JSON.stringify({ rodadas: 4 })]);
let rodadaId = r.rodada_id;

let rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.fase === "preparando", "começa esperando todo mundo confirmar pronto");
ok(rod.estado.meta_rodadas === 4, "número de rodadas veio da config do anfitrião");
ok(rod.estado.historico.length === 1 && rod.estado.historico[0].autor_id === null,
  `cadeia começa com a palavra sorteada: "${rod.estado.historico[0].palavra}"`);
ok(rod.turno_fim === null, "cronômetro não corre antes de todo mundo estar pronto");

await esperaErro(() => rpc(UID.ana, `csc_enviar_palavra($1, $2)`, [rodadaId, "Areia"]),
  "RODADA_NAO_ESTA_ABERTA", "não dá para escrever antes da cadeia abrir");

await rpc(UID.ana, `csc_marcar_pronto($1)`, [rodadaId]);
await rpc(UID.bruno, `csc_marcar_pronto($1)`, [rodadaId]);
await rpc(UID.carla, `csc_marcar_pronto($1)`, [rodadaId]);
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.fase === "preparando" && rod.estado.prontos.length === 3,
  "ainda espera o último confirmar");

await rpc(UID.davi, `csc_marcar_pronto($1)`, [rodadaId]);
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
const janela = (new Date(rod.turno_fim) - new Date(rod.turno_inicio)) / 1000;
ok(rod.fase === "em_andamento" && janela === 10,
  `todo mundo pronto: cadeia libera com ${janela}s por vez`);
ok(rod.vez_de === P.ana, "a vez começa com a anfitriã");

await esperaErro(() => rpc(UID.bruno, `csc_enviar_palavra($1, $2)`, [rodadaId, "Areia"]),
  "NAO_E_SUA_VEZ", "quem não está na vez não escreve na cadeia");

await rpc(UID.ana, `csc_enviar_palavra($1, $2)`, [rodadaId, "Areia"]);
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.estado.rodada_atual === 1 && rod.vez_de === P.bruno,
  "primeira palavra entrou na cadeia e a vez passou para Bruno");

const enviosPalavraCsc = await como(UID.carla,
  `select conteudo from envios where rodada_id = $1 and tipo = 'palavra'`, [rodadaId]);
ok(enviosPalavraCsc.length === 1, "a palavra fica registrada e visível para a sala inteira");

await rpc(UID.bruno, `csc_enviar_palavra($1, $2)`, [rodadaId, "Onda"]);
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.estado.rodada_atual === 2 && rod.vez_de === P.carla, "segunda palavra, vez da Carla");

// Carla deixa o tempo acabar — ninguém é punido, só passa a vez
await estourarTempo(rodadaId);
await esperaErro(() => rpc(UID.davi, `csc_enviar_palavra($1, $2)`, [rodadaId, "Vento"]),
  "NAO_E_SUA_VEZ", "Davi ainda não está na vez enquanto o tempo da Carla não estoura");
await rpc(UID.bruno, `csc_registrar_timeout($1)`, [rodadaId]);
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.estado.rodada_atual === 2 && rod.vez_de === P.davi,
  "estourou o tempo: pula a vez sem contar como rodada e sem eliminar");

const carlaSegueAtiva = await admin(`select eliminado from participantes where id = $1`, [P.carla]);
ok(carlaSegueAtiva[0].eliminado === false, "C, S, Composto não elimina ninguém");

await esperaErro(() => rpc(UID.bruno, `csc_registrar_timeout($1)`, [rodadaId]),
  "AINDA_TEM_TEMPO", "não dá para forçar o fim do tempo antes da hora");

await rpc(UID.davi, `csc_enviar_palavra($1, $2)`, [rodadaId, "Furacão"]);
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.estado.rodada_atual === 3 && rod.vez_de === P.ana, "terceira palavra, a roda volta para Ana");

// Última palavra: fecha a cadeia (meta = 4) e abre a votação
await rpc(UID.ana, `csc_enviar_palavra($1, $2)`, [rodadaId, "Maré"]);
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.fase === "votacao" && rod.estado.rodada_atual === 4 && rod.estado.historico.length === 5,
  "quarta palavra fecha a cadeia e abre a votação anônima");

await esperaErro(() => rpc(UID.ana, `csc_avaliar_palavra($1, 1, 'valeu')`, [rodadaId]),
  "AUTOR_NAO_AVALIA", "quem escreveu a palavra não vota nela");
await esperaErro(() => rpc(UID.bruno, `csc_avaliar_palavra($1, 1, 'talvez')`, [rodadaId]),
  "VALOR_INVALIDO", "só vale valeu, não_valeu ou neutro");
await esperaErro(() => rpc(UID.bruno, `csc_avaliar_palavra($1, 99, 'valeu')`, [rodadaId]),
  "INDICE_INVALIDO", "índice fora da cadeia é recusado");
await esperaErro(() => rpc(UID.bruno, `csc_avaliar_palavra($1, 0, 'valeu')`, [rodadaId]),
  "PALAVRA_SEM_AUTOR", "a palavra semente (sem autor) não entra na votação");

// índice 1 = "Areia" (Ana): maioria "valeu" → +1
await rpc(UID.bruno, `csc_avaliar_palavra($1, 1, 'valeu')`, [rodadaId]);
await rpc(UID.carla, `csc_avaliar_palavra($1, 1, 'valeu')`, [rodadaId]);
await rpc(UID.davi, `csc_avaliar_palavra($1, 1, 'valeu')`, [rodadaId]);

// índice 2 = "Onda" (Bruno): maioria "não valeu" → -1
await rpc(UID.ana, `csc_avaliar_palavra($1, 2, 'nao_valeu')`, [rodadaId]);
await rpc(UID.carla, `csc_avaliar_palavra($1, 2, 'nao_valeu')`, [rodadaId]);
await rpc(UID.davi, `csc_avaliar_palavra($1, 2, 'valeu')`, [rodadaId]);

// índice 3 = "Furacão" (Davi): tudo neutro → empate, 0
await rpc(UID.ana, `csc_avaliar_palavra($1, 3, 'neutro')`, [rodadaId]);
await rpc(UID.bruno, `csc_avaliar_palavra($1, 3, 'neutro')`, [rodadaId]);
await rpc(UID.carla, `csc_avaliar_palavra($1, 3, 'neutro')`, [rodadaId]);

rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.fase === "votacao" && rod.estado.avaliacoes_feitas === 9,
  "a mesa vê o progresso da votação sem saber quem votou o quê");

// índice 4 = "Maré" (Ana), último voto fecha a votação e revela sozinho
await rpc(UID.bruno, `csc_avaliar_palavra($1, 4, 'valeu')`, [rodadaId]);
await rpc(UID.carla, `csc_avaliar_palavra($1, 4, 'nao_valeu')`, [rodadaId]);
await rpc(UID.davi, `csc_avaliar_palavra($1, 4, 'valeu')`, [rodadaId]);

rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.fase === "resultado", "última avaliação revela a votação sozinha");

const porIndice = Object.fromEntries(rod.resultado.avaliacoes.map((a) => [a.indice, a]));
ok(porIndice[1].delta === 1, `"Areia" valeu (3x valeu, 0x não valeu) → +1`);
ok(porIndice[2].delta === -1, `"Onda" não valeu (2x não valeu, 1x valeu) → -1`);
ok(porIndice[3].delta === 0, `"Furacão" empatou em neutro → 0`);
ok(porIndice[4].delta === 1, `"Maré" valeu (2x valeu, 1x não valeu) → +1`);

const avaliacoesReveladas = await como(UID.bruno,
  `select valor from avaliacoes where rodada_id = $1`, [rodadaId]);
ok(avaliacoesReveladas.length === 12, "depois da revelação todas as avaliações ficam visíveis");

const placarCSC = Object.fromEntries((await admin(
  `select apelido, pontos from participantes where sala_id = $1`, [salaId]))
  .map((l) => [l.apelido, l.pontos]));
ok(placarCSC.Ana === 2, `Ana somou os dois "+1" das palavras dela (Ana: ${placarCSC.Ana})`);
ok(placarCSC.Bruno === -1, `Bruno perdeu 1 ponto pela palavra que não valeu (Bruno: ${placarCSC.Bruno})`);
ok(placarCSC.Davi === 0, `Davi empatou em neutro, sem pontos (Davi: ${placarCSC.Davi})`);

/* ========================================================================= */
/* 3. PALAVRA PARECIDA                                                       */
/* ========================================================================= */

grupo("Palavra Parecida: corrente e histórico");

r = await rpc(UID.ana, `iniciar_partida($1, 'palavra-parecida')`, [salaId]);
rodadaId = r.rodada_id;
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(!!rod.estado.palavra_atual, `palavra inicial: "${rod.estado.palavra_atual}"`);
ok(rod.estado.historico.length === 1, "histórico começa com a palavra sorteada");

await rpc(UID.ana, `avancar_turno($1, $2)`, [rodadaId, "Areia"]);
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.estado.palavra_atual === "Areia", "a palavra dita virou a palavra da vez");
ok(rod.estado.historico.length === 2 && rod.estado.historico[1].autor === "Ana",
  "histórico coletivo guarda quem falou o quê");

const enviosPalavra = await como(UID.carla,
  `select conteudo from envios where rodada_id = $1 and tipo = 'palavra'`, [rodadaId]);
ok(enviosPalavra.length === 1, "a palavra fica visível para a sala inteira");

/* ========================================================================= */
/* 4. QUEM SOU EU? — visibilidade invertida                                  */
/* ========================================================================= */

grupo("Quem Sou Eu?: a identidade some para o dono e aparece para os outros");

r = await rpc(UID.ana, `iniciar_partida($1, 'quem-sou-eu', $2)`,
  [salaId, JSON.stringify({ limitePerguntas: 10 })]);
rodadaId = r.rodada_id;

const idsAna = await como(UID.ana,
  `select dono_id, conteudo->>'nome' as nome from estados_privados where rodada_id = $1`, [rodadaId]);
const idsBruno = await como(UID.bruno,
  `select dono_id, conteudo->>'nome' as nome from estados_privados where rodada_id = $1`, [rodadaId]);

ok(idsAna.length === 4 - 1, `Ana enxerga ${idsAna.length} identidades (todas menos a dela)`);
ok(!idsAna.some((l) => l.dono_id === P.ana), "Ana NÃO enxerga a própria identidade");
ok(idsBruno.some((l) => l.dono_id === P.ana), "Bruno enxerga a identidade da Ana");
ok(!idsBruno.some((l) => l.dono_id === P.bruno), "Bruno NÃO enxerga a própria identidade");

const totalReal = await admin(`select count(*)::int n from estados_privados where rodada_id = $1`, [rodadaId]);
ok(totalReal[0].n === 4, "o banco guarda 4 identidades — o filtro é do RLS, não da consulta");

const nomes = new Set((await admin(
  `select conteudo->>'nome' n from estados_privados where rodada_id = $1`, [rodadaId])).map((l) => l.n));
ok(nomes.size === 4, "cada pessoa recebeu uma identidade diferente");

await esperaErro(() => rpc(UID.ana, `quem_sou_eu_responder($1, 'sim')`, [rodadaId]),
  "QUEM_PERGUNTA_NAO_RESPONDE", "quem está adivinhando não responde a própria pergunta");
await esperaErro(() => rpc(UID.bruno, `quem_sou_eu_responder($1, 'talvez!')`, [rodadaId]),
  "RESPOSTA_INVALIDA", "resposta fora de sim/não/talvez é recusada");

await rpc(UID.bruno, `quem_sou_eu_responder($1, 'sim')`, [rodadaId]);
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.estado.perguntas[P.ana] === 1, "contador de perguntas da Ana subiu para 1");
ok(rod.estado.ultima_resposta.resposta === "sim", "a resposta aparece para a mesa");

const palpiteErrado = await rpc(UID.ana, `quem_sou_eu_palpite($1, $2)`, [rodadaId, "Coisa Nenhuma"]);
ok(palpiteErrado.acertou === false, "palpite errado não pontua");
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.vez_de === P.bruno, "errando, a vez passa adiante");

// Bruno acerta o próprio nome (lido pelo admin, como se ele tivesse deduzido)
const nomeDoBruno = (await admin(
  `select conteudo->>'nome' n from estados_privados where rodada_id = $1 and dono_id = $2`,
  [rodadaId, P.bruno]))[0].n;

const pontosBrunoAntes = (await admin(`select pontos from participantes where id = $1`, [P.bruno]))[0].pontos;

const palpiteCerto = await rpc(UID.bruno, `quem_sou_eu_palpite($1, $2)`,
  [rodadaId, nomeDoBruno.toUpperCase()]);
ok(palpiteCerto.acertou === true, `acertou "${nomeDoBruno}" mesmo digitando em CAIXA ALTA`);

const brunoAgoraVe = await como(UID.bruno,
  `select conteudo->>'nome' n from estados_privados where rodada_id = $1 and dono_id = $2`,
  [rodadaId, P.bruno]);
ok(brunoAgoraVe.length === 1, "depois de acertar, a pessoa passa a ver a própria identidade");

const pontosBruno = await admin(`select pontos from participantes where id = $1`, [P.bruno]);
ok(pontosBruno[0].pontos === pontosBrunoAntes + 1, "quem acertou ganhou ponto");

/* ========================================================================= */
/* 5. MÍMICA                                                                 */
/* ========================================================================= */

grupo("Mímica: palavra secreta e cronômetro de 60s");

r = await rpc(UID.ana, `iniciar_partida($1, 'mimica')`, [salaId]);
rodadaId = r.rodada_id;
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.fase === "preparando", "a rodada espera o mímico começar");
ok(rod.turno_fim === null, "cronômetro só arranca quando ele mandar");

const palavraAna = await como(UID.ana,
  `select conteudo->>'texto' t from estados_privados where rodada_id = $1 and tipo = 'palavra'`,
  [rodadaId]);
const palavraBruno = await como(UID.bruno,
  `select conteudo->>'texto' t from estados_privados where rodada_id = $1 and tipo = 'palavra'`,
  [rodadaId]);
ok(palavraAna.length === 1, `só a mímica vê a palavra ("${palavraAna[0]?.t}")`);
ok(palavraBruno.length === 0, "os outros jogadores NÃO recebem a palavra secreta");

await esperaErro(() => rpc(UID.bruno, `mimica_acertou($1)`, [rodadaId]),
  "NAO_E_SUA_VEZ", "quem não está na vez não marca ponto sozinho");

await rpc(UID.ana, `mimica_iniciar($1)`, [rodadaId]);
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
const duracao = Math.round((new Date(rod.turno_fim) - new Date(rod.turno_inicio)) / 1000);
ok(rod.fase === "em_andamento" && duracao === 60, `cronômetro sincronizado de ${duracao}s`);

const antes = palavraAna[0].t;
const acerto = await rpc(UID.ana, `mimica_acertou($1)`, [rodadaId]);
const depois = (await como(UID.ana,
  `select conteudo->>'texto' t from estados_privados where rodada_id = $1 and tipo = 'palavra'`,
  [rodadaId]))[0].t;
ok(acerto.acertos === 1, "acerto contabilizado");
ok(antes !== depois, `palavra nova sorteada na sequência ("${depois}")`);

rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.estado.palavras_acertadas.includes(antes), "a palavra acertada entra na lista da rodada");

await estourarTempo(rodadaId);
await esperaErro(() => rpc(UID.ana, `mimica_acertou($1)`, [rodadaId]),
  "TEMPO_ESGOTADO", "depois dos 60s não dá para somar ponto");

await rpc(UID.bruno, `mimica_encerrar($1)`, [rodadaId]);
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.fase === "resultado" && rod.resultado.acertos === 1,
  `resultado da vez: ${rod.resultado.acertos} acerto(s) de ${rod.resultado.jogador}`);

/* ========================================================================= */
/* 6. DUAS VERDADES E UMA MENTIRA                                            */
/* ========================================================================= */

grupo("Duas Verdades: escrita privada, voto secreto e revelação");

r = await rpc(UID.ana, `iniciar_partida($1, 'duas-verdades')`, [salaId]);
rodadaId = r.rodada_id;
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.fase === "escrevendo", "começa na tela privada de escrita");
ok(!!rod.estado.tema, `tema sugerido: "${rod.estado.tema}"`);

await esperaErro(
  () => rpc(UID.bruno, `duas_verdades_enviar($1, $2::text[], 0)`,
    [rodadaId, "{a,b,c}"]),
  "NAO_E_SUA_VEZ", "só quem está na vez escreve as frases");

await esperaErro(
  () => rpc(UID.ana, `duas_verdades_enviar($1, $2::text[], 0)`, [rodadaId, "{só uma}"]),
  "PRECISA_TRES_FRASES", "exige exatamente três frases");

await rpc(UID.ana, `duas_verdades_enviar($1, $2::text[], 1)`, [
  rodadaId,
  '{"Já morei em outro país","Tenho medo de pombo","Sei tocar sanfona"}'
]);

rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.fase === "votacao" && rod.estado.frases.length === 3, "três frases foram para a mesa");
ok(rod.estado.total_votantes === 3, `${rod.estado.total_votantes} pessoas podem votar (o autor não vota)`);

const mentiraReal = (await admin(
  `select (conteudo->>'mentira')::int m from estados_privados where rodada_id = $1 and tipo = 'frases'`,
  [rodadaId]))[0].m;
ok(rod.estado.frases[mentiraReal] === "Tenho medo de pombo",
  "a mentira foi embaralhada junto com as verdades");

const frasesParaBruno = await como(UID.bruno,
  `select conteudo from estados_privados where rodada_id = $1 and tipo = 'frases'`, [rodadaId]);
ok(frasesParaBruno.length === 0, "ninguém descobre qual é a mentira antes da hora");

await esperaErro(() => rpc(UID.ana, `duas_verdades_votar($1, 0)`, [rodadaId]),
  "AUTOR_NAO_VOTA", "o autor não vota nas próprias frases");

await rpc(UID.bruno, `duas_verdades_votar($1, $2)`, [rodadaId, mentiraReal]);

const votoDoBrunoParaCarla = await como(UID.carla,
  `select alvo from votos where rodada_id = $1 and votante_id = $2`, [rodadaId, P.bruno]);
const votoProprio = await como(UID.bruno, `select alvo from votos where rodada_id = $1`, [rodadaId]);
ok(votoDoBrunoParaCarla.length === 0, "voto do Bruno é secreto para a Carla");
ok(votoProprio.length === 1, "cada pessoa enxerga o próprio voto");

rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.estado.votos === 1, "a mesa vê a CONTAGEM de votos, não os votos");

const erradas = [0, 1, 2].filter((i) => i !== mentiraReal);
await rpc(UID.carla, `duas_verdades_votar($1, $2)`, [rodadaId, erradas[0]]);
await rpc(UID.davi, `duas_verdades_votar($1, $2)`, [rodadaId, erradas[1]]);

rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.fase === "resultado", "quando todo mundo vota, revela sozinho");
ok(rod.resultado.acertos === 1 && rod.resultado.enganados === 2,
  `1 acertou e 2 foram enganados`);

const votosRevelados = await como(UID.carla, `select alvo from votos where rodada_id = $1`, [rodadaId]);
ok(votosRevelados.length === 3, "depois da revelação todos os votos ficam visíveis");

const placar = Object.fromEntries((await admin(
  `select apelido, pontos from participantes where sala_id = $1`, [salaId]))
  .map((l) => [l.apelido, l.pontos]));
ok(placar.Ana >= 2, `autora ganhou ponto por cada pessoa enganada (Ana: ${placar.Ana})`);

/* ========================================================================= */
/* 7. VERDADE OU DESAFIO + MODO +18                                          */
/* ========================================================================= */

grupo("Verdade ou Desafio: modo +18 exige confirmação explícita");

r = await rpc(UID.ana, `iniciar_partida($1, 'verdade-ou-desafio')`, [salaId]);
rodadaId = r.rodada_id;

await esperaErro(() => rpc(UID.ana, `verdade_desafio_sortear($1, 'verdade', true)`, [rodadaId]),
  "MODO_ADULTO_DESLIGADO", "conteúdo +18 bloqueado com o modo desligado");

await esperaErro(() => rpc(UID.ana, `definir_modo_adulto($1, true, false)`, [salaId]),
  "CONFIRMACAO_MAIORIDADE_OBRIGATORIA", "ligar o +18 sem confirmar maioridade é recusado");

await esperaErro(() => rpc(UID.bruno, `definir_modo_adulto($1, true, true)`, [salaId]),
  "SO_O_ANFITRIAO", "jogador comum não liga o modo +18");

const cartasAdultasParaJogador = await como(UID.bruno, `select id from cartas where adulto`);
ok(cartasAdultasParaJogador.length === 0,
  "baralho +18 não é legível por consulta direta, nem com o modo ligado");

await rpc(UID.ana, `definir_modo_adulto($1, true, true)`, [salaId]);
const salaAdulta = (await admin(`select modo_adulto, adulto_confirmado_em from salas where id = $1`, [salaId]))[0];
ok(salaAdulta.modo_adulto === true && !!salaAdulta.adulto_confirmado_em,
  "modo +18 ligado com carimbo de confirmação");

const cartaAdulta = await rpc(UID.ana, `verdade_desafio_sortear($1, 'verdade', true)`, [rodadaId]);
const ehAdulta = await admin(
  `select adulto from cartas where conteudo->>'texto' = $1`, [cartaAdulta.texto]);
ok(ehAdulta[0]?.adulto === true, `carta +18 sorteada: "${cartaAdulta.texto.slice(0, 50)}…"`);

await rpc(UID.ana, `verdade_desafio_resolver($1, 'desconfortavel')`, [rodadaId]);
rod = (await admin(`select * from rodadas where id = $1`, [rodadaId]))[0];
ok(rod.estado.historico[0].acao === "desconfortavel",
  "pular por desconforto fica registrado, sem punição");
ok(rod.vez_de === P.bruno, "a vez passa normalmente depois de pular");

const pontosAntes = (await admin(`select pontos from participantes where id = $1`, [P.ana]))[0].pontos;
await rpc(UID.ana, `definir_modo_adulto($1, false)`, [salaId]);
await esperaErro(() => rpc(UID.bruno, `verdade_desafio_sortear($1, 'desafio', true)`, [rodadaId]),
  "MODO_ADULTO_DESLIGADO", "anfitriã desliga o +18 a qualquer momento e ele para na hora");
ok((await admin(`select pontos from participantes where id = $1`, [P.ana]))[0].pontos === pontosAntes,
  "pular não tirou ponto de ninguém");

/* ========================================================================= */
/* 8. CARA A CARA                                                            */
/* ========================================================================= */

grupo("Cara a Cara: duelos em duplas com painel compartilhado");

r = await rpc(UID.ana, `iniciar_partida($1, 'cara-a-cara')`, [salaId]);
const duelos = await admin(`select * from duelos where partida_id = $1 order by mesa`, [r.partida_id]);
ok(duelos.length === 2, `4 jogadores viraram ${duelos.length} mesas`);

const painel = (await admin(`select config->'painel' p from partidas where id = $1`, [r.partida_id]))[0].p;
ok(painel.length === 24, `painel compartilhado com ${painel.length} personagens`);

const duelo1 = duelos[0];
const meuPersonagem = await como(UID.ana,
  `select conteudo->>'nome' n from estados_privados where partida_id = $1 and tipo = 'personagem'`,
  [r.partida_id]);
ok(meuPersonagem.length === 1, `Ana vê só o próprio personagem ("${meuPersonagem[0]?.n}")`);

await esperaErro(() => rpc(UID.carla, `cara_a_cara_perguntar($1, $2)`, [duelo1.id, "Usa óculos?"]),
  "NAO_E_SUA_MESA", "quem é de outra mesa não interfere no duelo");

await esperaErro(() => rpc(UID.bruno, `cara_a_cara_perguntar($1, $2)`, [duelo1.id, "Usa óculos?"]),
  "NAO_E_SUA_VEZ", "fora da vez não dá para perguntar");

await rpc(UID.ana, `cara_a_cara_perguntar($1, $2)`, [duelo1.id, "Seu personagem usa óculos?"]);
let d = (await admin(`select * from duelos where id = $1`, [duelo1.id]))[0];
ok(d.fase === "respondendo" && d.pergunta_atual.includes("óculos"), "pergunta registrada na mesa");

await esperaErro(() => rpc(UID.ana, `cara_a_cara_responder($1, 'sim')`, [duelo1.id]),
  "QUEM_PERGUNTA_NAO_RESPONDE", "quem perguntou não responde a si mesmo");

await rpc(UID.bruno, `cara_a_cara_responder($1, 'nao')`, [duelo1.id]);
d = (await admin(`select * from duelos where id = $1`, [duelo1.id]))[0];
ok(d.fase === "perguntando" && d.historico.length === 1, "resposta entra no histórico da mesa");
ok(d.vez_de === P.bruno, "a vez passou para o adversário");

// Eliminação é anotação particular
const alvoQualquer = painel[0].id;
await rpc(UID.ana, `cara_a_cara_eliminar($1, $2, true)`, [duelo1.id, alvoQualquer]);
const marcadosAna = await como(UID.ana,
  `select conteudo->'ids' ids from estados_privados where partida_id = $1 and tipo = 'eliminados'`,
  [r.partida_id]);
const marcadosBruno = await como(UID.bruno,
  `select conteudo->'ids' ids from estados_privados where partida_id = $1 and tipo = 'eliminados'`,
  [r.partida_id]);
ok(marcadosAna[0]?.ids?.length === 1, "Ana marcou um personagem como eliminado");
ok((marcadosBruno[0]?.ids?.length ?? 0) === 0, "a marcação da Ana não aparece na tela do Bruno");

await rpc(UID.ana, `cara_a_cara_eliminar($1, $2, false)`, [duelo1.id, alvoQualquer]);
const desmarcado = await como(UID.ana,
  `select conteudo->'ids' ids from estados_privados where partida_id = $1 and tipo = 'eliminados'`,
  [r.partida_id]);
ok(desmarcado[0].ids.length === 0, "dá para desmarcar");

// Palpite errado entrega a mesa para o adversário
const cartaErrada = painel.find((c) => c.p.nome !== meuPersonagem[0].n).id;
const alvoCerto = (await admin(
  `select (conteudo->>'carta_id')::uuid id from estados_privados
   where partida_id = $1 and dono_id = $2 and tipo = 'personagem'`,
  [r.partida_id, P.bruno]))[0].id;

const errou = await rpc(UID.ana, `cara_a_cara_palpite($1, $2)`,
  [duelo1.id, cartaErrada === alvoCerto ? painel.find((c) => c.id !== alvoCerto).id : cartaErrada]);
d = (await admin(`select * from duelos where id = $1`, [duelo1.id]))[0];
ok(errou.acertou === false && d.vencedor_id === P.bruno,
  "palpite errado encerra a mesa a favor do adversário");

await esperaErro(() => rpc(UID.ana, `cara_a_cara_palpite($1, $2)`, [duelo1.id, alvoCerto]),
  "DUELO_ENCERRADO", "mesa encerrada não aceita mais palpite");

// A segunda mesa, com palpite certeiro
const duelo2 = duelos[1];
const alvoDuelo2 = (await admin(
  `select (conteudo->>'carta_id')::uuid id from estados_privados
   where partida_id = $1 and dono_id = $2 and tipo = 'personagem'`,
  [r.partida_id, duelo2.jogador_b]))[0].id;
const uidDoA = duelo2.jogador_a === P.carla ? UID.carla : UID.davi;
const acertouPalpite = await rpc(uidDoA, `cara_a_cara_palpite($1, $2)`, [duelo2.id, alvoDuelo2]);
d = (await admin(`select * from duelos where id = $1`, [duelo2.id]))[0];
ok(acertouPalpite.acertou === true && d.vencedor_id === duelo2.jogador_a,
  `palpite certeiro vence a mesa ("${acertouPalpite.personagem}")`);

/* ========================================================================= */
/* 8-B. CRONÔMETRO                                                          */
/* ========================================================================= */

grupo("Cronômetro: alvo privado, tempo mandado pelo cliente, erro calculado no banco");

const pontosAnaAntesCron = (await admin(`select pontos from participantes where id = $1`, [P.ana]))[0].pontos;

r = await rpc(UID.ana, `iniciar_partida($1, 'cronometro')`, [salaId]);
let rodadaCron = r.rodada_id;

let rodCron = (await admin(`select * from rodadas where id = $1`, [rodadaCron]))[0];
ok(rodCron.fase === "em_andamento" && rodCron.vez_de === null,
  "todo mundo joga junto, sem vez");

const janelaCron = (new Date(rodCron.turno_fim) - new Date(rodCron.turno_inicio)) / 1000;
ok(janelaCron === 60, `prazo geral da rodada: ${janelaCron}s`);

const alvoAna = await como(UID.ana,
  `select conteudo->>'alvo_ms' a from estados_privados where rodada_id = $1 and tipo = 'alvo_tempo'`,
  [rodadaCron]);
const alvoParaBruno = await como(UID.bruno,
  `select conteudo->>'alvo_ms' a from estados_privados where rodada_id = $1 and tipo = 'alvo_tempo' and dono_id = $2`,
  [rodadaCron, P.ana]);
ok(alvoAna.length === 1 && Number(alvoAna[0].a) >= 3000 && Number(alvoAna[0].a) <= 12000,
  `Ana tem um alvo só dela: ${alvoAna[0].a}ms`);
ok(alvoParaBruno.length === 0, "Bruno não enxerga o alvo da Ana");

const alvoAnaMs = Number(alvoAna[0].a);
await esperaErro(() => rpc(UID.ana, `cronometro_enviar($1, $2)`, [rodadaCron, -5]),
  "TEMPO_INVALIDO", "tempo negativo é recusado");

await rpc(UID.ana, `cronometro_enviar($1, $2)`, [rodadaCron, alvoAnaMs]);
await esperaErro(() => rpc(UID.ana, `cronometro_enviar($1, $2)`, [rodadaCron, alvoAnaMs]),
  "JA_ENVIOU", "não dá para mandar o resultado duas vezes");

await rpc(UID.bruno, `cronometro_enviar($1, $2)`, [rodadaCron, alvoAnaMs + 5000]);
await rpc(UID.carla, `cronometro_enviar($1, $2)`, [rodadaCron, alvoAnaMs + 3000]);
rodCron = (await admin(`select * from rodadas where id = $1`, [rodadaCron]))[0];
ok(rodCron.fase === "em_andamento" && rodCron.estado.resultados.length === 3,
  "ainda falta o Davi mandar o dele");

await rpc(UID.davi, `cronometro_enviar($1, $2)`, [rodadaCron, alvoAnaMs + 4000]);
rodCron = (await admin(`select * from rodadas where id = $1`, [rodadaCron]))[0];
ok(rodCron.fase === "resultado", "o último resultado revela a rodada sozinho");
ok(rodCron.resultado.vencedores.includes(P.ana),
  `Ana bateu o próprio alvo em cheio — venceu (vencedores: ${rodCron.resultado.vencedores.length})`);

const pontosAnaCron = (await admin(`select pontos from participantes where id = $1`, [P.ana]))[0].pontos;
ok(pontosAnaCron === pontosAnaAntesCron + 1,
  `Ana ganhou o ponto da rodada mais precisa (pontos: ${pontosAnaAntesCron} → ${pontosAnaCron})`);

/* ========================================================================= */
/* 8-C. DESENHO TELEFONE                                                    */
/* ========================================================================= */

grupo("Desenho Telefone: cadernos em rotação, tarefas privadas e revelação final");

async function tarefaDesenho(uid, rodadaId) {
  const linhas = await como(uid,
    `select conteudo from estados_privados where rodada_id = $1 and tipo = 'tarefa_desenho'`,
    [rodadaId]);
  return linhas[0]?.conteudo;
}

async function enviarEtapa(uid, rodadaId, tipo) {
  const conteudo = tipo === "frase"
    ? { texto: `frase de ${uid.slice(0, 4)}` }
    : { tracos: [{ cor: "#000000", pontos: [[10, 10], [50, 50], [90, 10]] }] };
  return rpc(uid, `desenho_enviar_etapa($1, $2::jsonb)`, [rodadaId, JSON.stringify(conteudo)]);
}

r = await rpc(UID.ana, `iniciar_partida($1, 'desenho-telefone')`, [salaId]);
const rodadaDesenho = r.rodada_id;

let rodDesenho = (await admin(`select * from rodadas where id = $1`, [rodadaDesenho]))[0];
ok(rodDesenho.fase === "em_andamento" && rodDesenho.estado.tipo_passo === "frase"
  && rodDesenho.estado.passo_atual === 0 && rodDesenho.estado.total_passos === 4,
  "passo 0 já monta sozinho: todo mundo escreve a própria frase inicial");

const tarefaAnaP0 = await tarefaDesenho(UID.ana, rodadaDesenho);
ok(tarefaAnaP0.tipo === "frase" && tarefaAnaP0.passo === 0,
  "a tarefa do passo 0 é escrever, sem nada de referência");

await enviarEtapa(UID.ana, rodadaDesenho, "frase");
await enviarEtapa(UID.bruno, rodadaDesenho, "frase");
await esperaErro(() => enviarEtapa(UID.ana, rodadaDesenho, "frase"),
  "JA_ENVIOU", "não dá para mandar a mesma etapa duas vezes");
await esperaErro(() => rpc(UID.carla, `desenho_enviar_etapa($1, $2::jsonb)`,
  [rodadaDesenho, JSON.stringify({ texto: "   " })]),
  "FRASE_VAZIA", "frase em branco é recusada");

await enviarEtapa(UID.carla, rodadaDesenho, "frase");
rodDesenho = (await admin(`select * from rodadas where id = $1`, [rodadaDesenho]))[0];
ok(rodDesenho.estado.passo_atual === 0 && rodDesenho.estado.enviaram.length === 3,
  "ainda falta o Davi para fechar o passo 0");

await enviarEtapa(UID.davi, rodadaDesenho, "frase");
rodDesenho = (await admin(`select * from rodadas where id = $1`, [rodadaDesenho]))[0];
ok(rodDesenho.estado.passo_atual === 1 && rodDesenho.estado.tipo_passo === "desenho",
  "todo mundo escreveu: o passo 1 já é de desenho");

const tarefaBrunoP1 = await tarefaDesenho(UID.bruno, rodadaDesenho);
ok(tarefaBrunoP1.tipo === "desenho" && tarefaBrunoP1.anterior?.texto,
  `Bruno recebe uma frase de outra pessoa para desenhar: "${tarefaBrunoP1.anterior.texto}"`);
ok(tarefaBrunoP1.caderno !== undefined, "cada tarefa sabe a qual caderno pertence");

await esperaErro(() => rpc(UID.bruno, `desenho_enviar_etapa($1, $2::jsonb)`,
  [rodadaDesenho, JSON.stringify({ tracos: [] })]),
  "DESENHO_VAZIO", "desenho sem nenhum traço é recusado");

for (const uid of [UID.ana, UID.bruno, UID.carla, UID.davi]) {
  const tarefa = await tarefaDesenho(uid, rodadaDesenho);
  await enviarEtapa(uid, rodadaDesenho, tarefa.tipo);
}
rodDesenho = (await admin(`select * from rodadas where id = $1`, [rodadaDesenho]))[0];
ok(rodDesenho.estado.passo_atual === 2 && rodDesenho.estado.tipo_passo === "frase",
  "passo 2 volta a ser de legenda, sobre o desenho do passo 1");

const tarefaCarlaP2 = await tarefaDesenho(UID.carla, rodadaDesenho);
ok(tarefaCarlaP2.tipo === "frase" && Array.isArray(tarefaCarlaP2.anterior?.tracos),
  "quem legenda vê os traços do desenho anterior, não a frase original");

for (const uid of [UID.ana, UID.bruno, UID.carla, UID.davi]) {
  const tarefa = await tarefaDesenho(uid, rodadaDesenho);
  await enviarEtapa(uid, rodadaDesenho, tarefa.tipo);
}
rodDesenho = (await admin(`select * from rodadas where id = $1`, [rodadaDesenho]))[0];
ok(rodDesenho.estado.passo_atual === 3 && rodDesenho.estado.tipo_passo === "desenho",
  "último passo (3 de 4), de novo desenho");

await esperaErro(() => rpc(UID.bruno, `desenho_forcar_avanco($1)`, [rodadaDesenho]),
  "AINDA_TEM_TEMPO", "quem não é anfitrião não força antes do prazo estourar");

// Carla deixa o último passo em branco — o anfitrião força mesmo assim
const tarefaCarlaP3 = await tarefaDesenho(UID.carla, rodadaDesenho);
await enviarEtapa(UID.ana, rodadaDesenho, (await tarefaDesenho(UID.ana, rodadaDesenho)).tipo);
await enviarEtapa(UID.bruno, rodadaDesenho, (await tarefaDesenho(UID.bruno, rodadaDesenho)).tipo);
await enviarEtapa(UID.davi, rodadaDesenho, (await tarefaDesenho(UID.davi, rodadaDesenho)).tipo);

await rpc(UID.ana, `desenho_forcar_avanco($1)`, [rodadaDesenho]);
rodDesenho = (await admin(`select * from rodadas where id = $1`, [rodadaDesenho]))[0];
ok(rodDesenho.fase === "resultado", "anfitriã força o fim do último passo e revela a rodada");

const cadernoDaCarla = rodDesenho.resultado.cadernos.find((c) => c.caderno === tarefaCarlaP3.caderno);
const passoFaltante = cadernoDaCarla.passos.find((p) => p.passo === tarefaCarlaP3.passo);
ok(passoFaltante.autor === null && passoFaltante.conteudo === null,
  "o passo que a Carla não respondeu aparece como buraco, sem travar a revelação");

ok(rodDesenho.resultado.cadernos.length === 4, "quatro cadernos completos na revelação");
const cadernoCompleto = rodDesenho.resultado.cadernos.find((c) => c.caderno !== tarefaCarlaP3.caderno);
ok(cadernoCompleto.passos.length === 4 && cadernoCompleto.passos.every((p) => p.conteudo !== null),
  `um caderno sem buracos tem os 4 passos completos, começando com "${cadernoCompleto.autor_original}"`);

const etapasReveladas = await como(UID.bruno,
  `select id from etapas_desenho where rodada_id = $1 and revelado`, [rodadaDesenho]);
ok(etapasReveladas.length > 0, "depois da revelação as etapas ficam visíveis para a mesa inteira");

/* ========================================================================= */
/* 8-D. CODE NAMES                                                          */
/* ========================================================================= */

grupo("Code Names: times, tabuleiro secreto, dicas e vitória");

r = await rpc(UID.ana, `iniciar_partida($1, 'code-names')`, [salaId]);
const rodadaCN = r.rodada_id;

let rodCN = (await admin(`select * from rodadas where id = $1`, [rodadaCN]))[0];
ok(rodCN.fase === "preparando", "começa esperando os times se organizarem");

await esperaErro(() => rpc(UID.ana, `codenames_entrar_time($1, 'C')`, [rodadaCN]),
  "TIME_INVALIDO", "só existe time A ou B");

await rpc(UID.ana, `codenames_entrar_time($1, 'A')`, [rodadaCN]);
await rpc(UID.bruno, `codenames_entrar_time($1, 'A')`, [rodadaCN]);
await rpc(UID.carla, `codenames_entrar_time($1, 'B')`, [rodadaCN]);
await rpc(UID.davi, `codenames_entrar_time($1, 'B')`, [rodadaCN]);

await esperaErro(() => rpc(UID.ana, `codenames_iniciar_tabuleiro($1)`, [rodadaCN]),
  "SEM_SPYMASTER", "não começa sem um espião escolhido em cada time");

await esperaErro(() => rpc(UID.carla, `codenames_virar_spymaster($1, 'A')`, [rodadaCN]),
  "NAO_ESTA_NO_TIME", "só quem está no time A pode virar o espião do time A");

await rpc(UID.ana, `codenames_virar_spymaster($1, 'A')`, [rodadaCN]);
await rpc(UID.carla, `codenames_virar_spymaster($1, 'B')`, [rodadaCN]);

await esperaErro(() => rpc(UID.bruno, `codenames_iniciar_tabuleiro($1)`, [rodadaCN]),
  "SO_O_ANFITRIAO", "só a anfitriã destrava o tabuleiro");

await rpc(UID.ana, `codenames_iniciar_tabuleiro($1)`, [rodadaCN]);
rodCN = (await admin(`select * from rodadas where id = $1`, [rodadaCN]))[0];
ok(rodCN.fase === "em_andamento" && rodCN.estado.palavras.length === 25,
  "tabuleiro pronto: 25 palavras");
ok(rodCN.estado.palavras.every((p) => p.revelada === false && p.cor === null),
  "nenhuma cor verdadeira aparece no estado público");

const timeQueComeca = rodCN.estado.time_da_vez;
const timeQueEspera = timeQueComeca === "A" ? "B" : "A";
ok(rodCN.estado.restantes[timeQueComeca] === 9 && rodCN.estado.restantes[timeQueEspera] === 8,
  `quem começa (Time ${timeQueComeca}) tem 9 palavras; o outro, 8`);

const spyDoComeco = timeQueComeca === "A" ? UID.ana : UID.carla;
const spyDoOutro = timeQueComeca === "A" ? UID.carla : UID.ana;
const guessDoComeco = timeQueComeca === "A" ? UID.bruno : UID.davi;
const guessDoOutro = timeQueComeca === "A" ? UID.davi : UID.bruno;

const mapaSecreto = await como(spyDoComeco,
  `select conteudo->'cores' c from estados_privados where rodada_id = $1 and tipo = 'mapa_secreto'`,
  [rodadaCN]);
const cores = mapaSecreto[0].c;
ok(cores.length === 25, "o espião vê as 25 cores verdadeiras");

const mapaParaQuemNaoEEspiao = await como(guessDoComeco,
  `select * from estados_privados where rodada_id = $1 and tipo = 'mapa_secreto'`, [rodadaCN]);
ok(mapaParaQuemNaoEEspiao.length === 0, "quem não é espião não enxerga o mapa secreto");

await esperaErro(() => rpc(guessDoComeco, `codenames_virar_palavra($1, 0)`, [rodadaCN]),
  "SEM_DICA_AINDA", "não dá para chutar sem uma dica na mesa");

await esperaErro(() => rpc(guessDoComeco, `codenames_dar_dica($1, 'ANIMAL', 2)`, [rodadaCN]),
  "NAO_E_O_SPYMASTER", "quem não é o espião não dá dica");
await esperaErro(() => rpc(spyDoOutro, `codenames_dar_dica($1, 'ANIMAL', 2)`, [rodadaCN]),
  "NAO_E_O_SPYMASTER", "o espião do outro time não dá dica fora da vez dele");
await esperaErro(() => rpc(spyDoComeco, `codenames_dar_dica($1, 'DOIS 3', 2)`, [rodadaCN]),
  "DICA_INVALIDA", "a dica não pode ter espaço");
await esperaErro(() => rpc(spyDoComeco, `codenames_dar_dica($1, 'ANIMAL2', 2)`, [rodadaCN]),
  "DICA_INVALIDA", "a dica não pode ter número junto");
await esperaErro(() => rpc(spyDoComeco, `codenames_dar_dica($1, 'ANIMAL', 15)`, [rodadaCN]),
  "DICA_INVALIDA", "o número da dica tem limite");

await rpc(spyDoComeco, `codenames_dar_dica($1, 'animal', 2)`, [rodadaCN]);
rodCN = (await admin(`select * from rodadas where id = $1`, [rodadaCN]))[0];
ok(rodCN.estado.dica_atual.palavra === "ANIMAL" && rodCN.estado.dica_atual.numero === 2,
  "dica registrada em maiúsculas, com o número");
ok(rodCN.estado.palpites_restantes === 3, "número + 1 palpites, contando a margem de segurança");

await esperaErro(() => rpc(spyDoComeco, `codenames_dar_dica($1, 'OUTRA', 1)`, [rodadaCN]),
  "DICA_JA_DADA", "não dá pra trocar a dica no meio do turno");
await esperaErro(() => rpc(spyDoComeco, `codenames_virar_palavra($1, 0)`, [rodadaCN]),
  "SPYMASTER_NAO_CLICA", "o espião não aponta palavra, só dá dica");
await esperaErro(() => rpc(guessDoOutro, `codenames_virar_palavra($1, 0)`, [rodadaCN]),
  "NAO_E_SEU_TIME", "só o time da vez aponta palavra");

const indiceDoTime = cores.findIndex((c) => c === timeQueComeca);
const indiceNeutro = cores.findIndex((c) => c === "neutro");
const indiceBomba = cores.findIndex((c) => c === "bomba");

const acertoCN = await rpc(guessDoComeco, `codenames_virar_palavra($1, $2)`, [rodadaCN, indiceDoTime]);
ok(acertoCN.fim === false && acertoCN.cor === timeQueComeca, "acertou a cor do próprio time");
rodCN = (await admin(`select * from rodadas where id = $1`, [rodadaCN]))[0];
ok(rodCN.estado.time_da_vez === timeQueComeca && rodCN.estado.palpites_restantes === 2,
  "acertando, o turno continua com um palpite a menos");
ok(rodCN.estado.restantes[timeQueComeca] === 8, "uma palavra do time a menos para completar");

await esperaErro(() => rpc(guessDoComeco, `codenames_virar_palavra($1, $2)`, [rodadaCN, indiceDoTime]),
  "PALAVRA_JA_VIRADA", "não dá pra virar a mesma palavra duas vezes");

const erro = await rpc(guessDoComeco, `codenames_virar_palavra($1, $2)`, [rodadaCN, indiceNeutro]);
ok(erro.fim === false && erro.cor === "neutro", "palavra neutra não pertence a ninguém");
rodCN = (await admin(`select * from rodadas where id = $1`, [rodadaCN]))[0];
ok(rodCN.estado.time_da_vez === timeQueEspera && rodCN.estado.dica_atual === null,
  "errando a cor, o turno passa e a dica reseta");

// Atalho para não precisar acertar 7 ou 8 palavras uma por uma: leva o time
// que está com a vez a um passo da vitória e confere se o acerto final fecha o jogo
await rpc(spyDoOutro, `codenames_dar_dica($1, 'ULTIMA', 1)`, [rodadaCN]);
await admin(
  `update rodadas set estado = estado || jsonb_build_object('restantes',
     (estado->'restantes') || jsonb_build_object($2::text, 1)) where id = $1`,
  [rodadaCN, timeQueEspera]
);

const indiceDoOutroTime = cores.findIndex((c, i) => c === timeQueEspera && i !== indiceDoTime);
const vitoria = await rpc(guessDoOutro, `codenames_virar_palavra($1, $2)`, [rodadaCN, indiceDoOutroTime]);
ok(vitoria.fim === true && vitoria.vencedor_time === timeQueEspera,
  `Time ${timeQueEspera} completou as próprias palavras e venceu`);

rodCN = (await admin(`select * from rodadas where id = $1`, [rodadaCN]))[0];
ok(rodCN.fase === "resultado" && rodCN.resultado.motivo === "completou_palavras",
  "motivo da vitória registrado");
ok(rodCN.resultado.tabuleiro.length === 25 && rodCN.resultado.tabuleiro[indiceBomba].cor === "bomba",
  "o resumo final mostra o tabuleiro inteiro, bomba incluída");

grupo("Code Names: pegar a bomba perde na hora");

r = await rpc(UID.ana, `iniciar_partida($1, 'code-names')`, [salaId]);
const rodadaBomba = r.rodada_id;

await rpc(UID.ana, `codenames_entrar_time($1, 'A')`, [rodadaBomba]);
await rpc(UID.bruno, `codenames_entrar_time($1, 'A')`, [rodadaBomba]);
await rpc(UID.carla, `codenames_entrar_time($1, 'B')`, [rodadaBomba]);
await rpc(UID.davi, `codenames_entrar_time($1, 'B')`, [rodadaBomba]);
await rpc(UID.ana, `codenames_virar_spymaster($1, 'A')`, [rodadaBomba]);
await rpc(UID.carla, `codenames_virar_spymaster($1, 'B')`, [rodadaBomba]);
await rpc(UID.ana, `codenames_iniciar_tabuleiro($1)`, [rodadaBomba]);

let rodBomba = (await admin(`select * from rodadas where id = $1`, [rodadaBomba]))[0];
const timeDaBomba = rodBomba.estado.time_da_vez;
const spyDaBomba = timeDaBomba === "A" ? UID.ana : UID.carla;
const guessDaBomba = timeDaBomba === "A" ? UID.bruno : UID.davi;
const timeAdversarioBomba = timeDaBomba === "A" ? "B" : "A";

const coresBomba = (await como(spyDaBomba,
  `select conteudo->'cores' c from estados_privados where rodada_id = $1 and tipo = 'mapa_secreto'`,
  [rodadaBomba]))[0].c;
const indiceBombaReal = coresBomba.findIndex((c) => c === "bomba");

await rpc(spyDaBomba, `codenames_dar_dica($1, 'CUIDADO', 1)`, [rodadaBomba]);
const explodiu = await rpc(guessDaBomba, `codenames_virar_palavra($1, $2)`, [rodadaBomba, indiceBombaReal]);
ok(explodiu.fim === true && explodiu.vencedor_time === timeAdversarioBomba,
  `Time ${timeDaBomba} pegou a bomba — Time ${timeAdversarioBomba} vence na hora`);

rodBomba = (await admin(`select * from rodadas where id = $1`, [rodadaBomba]))[0];
ok(rodBomba.fase === "resultado" && rodBomba.resultado.motivo === "bomba",
  "motivo registrado como bomba");

/* ========================================================================= */
/* 9. PRESENÇA, DESCONEXÃO E SAÍDA                                           */
/* ========================================================================= */

grupo("Presença, desconexão e troca de anfitrião");

await admin(`update participantes set visto_em = now() - interval '2 minutes' where id = $1`, [P.davi]);
await rpc(UID.ana, `varrer_ausentes($1)`, [salaId]);
const davi = (await admin(`select conectado from participantes where id = $1`, [P.davi]))[0];
ok(davi.conectado === false, "quem sumiu há mais de 30s aparece como desconectado");

const estado = await rpc(UID.ana, `estado_da_sala($1)`, [salaId]);
const daviNoEstado = estado.participantes.find((p) => p.id === P.davi);
ok(daviNoEstado.conectado === false, "o estado da sala mostra a desconexão para todo mundo");
ok(!!estado.servidor_agora, "o estado carrega o relógio do servidor para sincronizar cronômetros");
ok(estado.eu.apelido === "Ana" && estado.eu.e_anfitriao === true, "estado_da_sala se adapta a quem pergunta");

const estadoBruno = await rpc(UID.bruno, `estado_da_sala($1)`, [salaId]);
ok(estadoBruno.eu.apelido === "Bruno" && estadoBruno.eu.e_anfitriao === false,
  "…e Bruno recebe o mesmo estado compartilhado, com o 'eu' dele");
await esperaErro(() => rpc(UID.estranho, `estado_da_sala($1)`, [salaId]),
  "NAO_ESTA_NA_SALA", "de fora da sala não se lê o estado");

// Anfitriã sai: a faixa passa adiante
await rpc(UID.ana, `sair_sala($1)`, [salaId]);
const novaSala = (await admin(`select anfitriao_id from salas where id = $1`, [salaId]))[0];
const novoAnfitriao = (await admin(`select apelido from participantes where id = $1`, [novaSala.anfitriao_id]))[0];
ok(novaSala.anfitriao_id === P.bruno, `anfitrião passou para ${novoAnfitriao.apelido}`);

const anaFora = await como(UID.ana, `select * from salas where id = $1`, [salaId]);
ok(anaFora.length === 0, "quem saiu perde o acesso à sala na hora");

await rpc(UID.bruno, `remover_participante($1)`, [P.davi]);
const daviRemovido = (await admin(`select saiu_em from participantes where id = $1`, [P.davi]))[0];
ok(daviRemovido.saiu_em !== null, "o novo anfitrião consegue remover participante");

await rpc(UID.bruno, `encerrar_sala($1)`, [salaId]);
await esperaErro(() => rpc(UID.carla, `entrar_sala($1, $2)`, [codigo, "Carla2"]),
  "SALA_ENCERRADA", "sala encerrada não recebe mais ninguém");

/* ========================================================================= */
/* 10. SETUP DE UMA COLAGEM SÓ (supabase/tudo.sql)                           */
/* ========================================================================= */

grupo("Arquivo único: o que a pessoa cola no SQL Editor");

const { montar } = await import("../../ferramentas/combinar-sql.mjs");
const combinadoEsperado = montar();
const combinadoNoDisco = readFileSync(path.join(RAIZ, "tudo.sql"), "utf8");
const emDia = combinadoNoDisco === combinadoEsperado;

ok(
  emDia,
  emDia
    ? "tudo.sql está em dia com os arquivos 01 a 05"
    : "tudo.sql DESATUALIZADO — rode: npm run sql:combinar"
);

// Um banco novo recebendo o arquivo inteiro de uma vez — exatamente o que
// acontece quando a pessoa cola tudo no SQL Editor e clica em Run.
const db2 = new PGlite();
await db2.exec(`
  create schema if not exists auth;

  create or replace function auth.uid() returns uuid
  language sql stable as $fn$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $fn$;

  do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);

let colagemOk = true;
let erroColagem = "";
try {
  await db2.exec(combinadoNoDisco);
} catch (e) {
  colagemOk = false;
  erroColagem = String(e.message || e).split("\n")[0];
}

ok(
  colagemOk,
  colagemOk
    ? "a colagem única aplica sem erro num banco vazio"
    : `a colagem falhou: ${erroColagem}`
);

if (colagemOk) {
  async function comoNoDb2(uid, sql, params = []) {
    await db2.exec(`set role authenticated;`);
    await db2.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
    try {
      return (await db2.query(sql, params)).rows;
    } finally {
      await db2.exec(`reset role;`);
    }
  }

  const nova = (await comoNoDb2(UID.ana, `select criar_sala($1) as r`, ["Ana"]))[0].r;
  await comoNoDb2(UID.bruno, `select entrar_sala($1, $2) as r`, [nova.codigo, "Bruno"]);
  const partidaNova = (
    await comoNoDb2(UID.ana, `select iniciar_partida($1, 'mimica') as r`, [nova.sala_id])
  )[0].r;

  const cartas = (await db2.query(`select count(*)::int n from cartas`)).rows[0].n;
  const funcoes = (await db2.query(
    `select count(*)::int n from pg_proc p
     join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'`
  )).rows[0].n;

  ok(!!partidaNova.rodada_id, "banco recém-colado já inicia uma partida");
  ok(cartas > 200, `baralho carregado com ${cartas} cartas`);
  ok(funcoes > 30, `${funcoes} funções criadas`);
}

await db2.close();

/* ========================================================================= */

console.log(
  `\n${falhas.length ? "[31m❌ FALHOU" : "[32m✅ TUDO PASSOU"}[0m` +
  ` — ${passou} verificações, ${falhas.length} falha(s)`
);
if (falhas.length) {
  falhas.forEach((f) => console.log(`   ${f}`));
  process.exitCode = 1;
}
await db.close();
