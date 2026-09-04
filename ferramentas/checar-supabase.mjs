/**
 * Confere se o Supabase está configurado direito — de ponta a ponta.
 *
 *   npm run checar                    (usa o .env local)
 *   npm run checar -- <url> <chave>   (confere outro projeto, ex.: o de produção)
 *
 * Faz o mesmo caminho que o app faz: cria uma sessão anônima, abre uma sala,
 * entra com outra sessão, começa uma partida e confere se o segredo do jogo
 * fica escondido de quem não pode ver. No fim, encerra a sala de teste.
 *
 * Se algo estiver faltando, ele diz exatamente o quê e onde arrumar.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const V = "\x1b[32m✓\x1b[0m";
const X = "\x1b[31m✗\x1b[0m";
const I = "\x1b[33m•\x1b[0m";

let falhou = false;

function ok(msg) {
  console.log(`  ${V} ${msg}`);
}

function erro(msg, comoArrumar) {
  falhou = true;
  console.log(`  ${X} \x1b[31m${msg}\x1b[0m`);
  if (comoArrumar) console.log(`      \x1b[33m→ ${comoArrumar}\x1b[0m`);
}

/** Lê o .env sem depender de biblioteca. */
function lerEnv() {
  try {
    const bruto = readFileSync(path.join(RAIZ, ".env"), "utf8");
    const vars = {};
    for (const linha of bruto.split("\n")) {
      const limpa = linha.trim();
      if (!limpa || limpa.startsWith("#")) continue;
      const igual = limpa.indexOf("=");
      if (igual === -1) continue;
      vars[limpa.slice(0, igual).trim()] = limpa.slice(igual + 1).trim();
    }
    return vars;
  } catch {
    return null;
  }
}

console.log("\n\x1b[1m🎲 Party Games — checagem do Supabase\x1b[0m\n");

/* ----------------------------------------------------------- 1. Credenciais */

console.log("\x1b[1m1. Credenciais\x1b[0m");

const [urlArg, chaveArg] = process.argv.slice(2);
let url = urlArg;
let chave = chaveArg;

if (!url || !chave) {
  const env = lerEnv();
  if (!env) {
    erro("Não achei o arquivo .env", "copie o .env.example para .env e preencha");
    process.exit(1);
  }
  url = env.VITE_SUPABASE_URL;
  chave = env.VITE_SUPABASE_ANON_KEY;
}

if (!url || url.includes("xxxx")) {
  erro("VITE_SUPABASE_URL não preenchida", "Supabase → Project Settings → API → Project URL");
} else {
  // O painel mostra vários endereços (REST, GraphQL...). O app quer só a base:
  // o supabase-js acrescenta /rest/v1, /auth/v1 e /realtime/v1 por conta própria.
  let base = url.trim();
  try {
    const partes = new URL(base);
    base = partes.origin;
  } catch {
    erro(`URL inválida: ${url}`, "deve ser algo como https://xxxxx.supabase.co");
  }

  if (base !== url.trim().replace(/\/$/, "")) {
    console.log(`  ${I} Removi o caminho extra da URL — o app usa só a base`);
    console.log(`      ${url.trim()}  →  ${base}`);
  }

  if (!/^https:\/\/[a-z0-9]+\.supabase\.(co|in)$/.test(base)) {
    console.log(`  ${I} Formato fora do usual (${base}) — vou tentar assim mesmo`);
  }

  url = base;
  ok(`URL: ${url}`);
}

/**
 * O Supabase tem dois formatos de chave em circulação:
 *
 *   novo     sb_publishable_...  (pública)   /  sb_secret_...  (secreta)
 *   antigo   eyJ... com "anon"   (pública)   /  eyJ... com "service_role" (secreta)
 *
 * As duas públicas funcionam no app. As secretas ignoram o RLS e não podem,
 * em hipótese alguma, ir para o navegador.
 */
function classificarChave(k) {
  if (!k || k.includes("...")) return "vazia";
  if (k.startsWith("sb_secret_")) return "secreta-nova";
  if (k.startsWith("sb_publishable_")) return "publica-nova";
  if (k.startsWith("eyJ")) {
    try {
      const corpo = JSON.parse(Buffer.from(k.split(".")[1], "base64").toString());
      if (corpo.role === "service_role") return "secreta-antiga";
      if (corpo.role === "anon") return "publica-antiga";
    } catch {
      /* não é um JWT legível */
    }
    return "jwt-desconhecido";
  }
  return "formato-estranho";
}

const tipoChave = classificarChave(chave);

if (tipoChave === "vazia") {
  erro(
    "VITE_SUPABASE_ANON_KEY não preenchida",
    "Project Settings → API Keys → chave 'publishable' (ou 'anon public', se o projeto for antigo)"
  );
} else if (tipoChave === "secreta-nova" || tipoChave === "secreta-antiga") {
  erro(
    tipoChave === "secreta-nova"
      ? "Essa é a chave SECRETA (sb_secret_…)!"
      : "Essa é a chave service_role!",
    "ela ignora o RLS e daria acesso total ao banco para qualquer visitante. " +
      "Use a publishable/anon — e revogue esta, já que ela vazou para um arquivo"
  );
} else if (tipoChave === "publica-nova") {
  ok(`Chave publishable: ${chave.slice(0, 18)}…${chave.slice(-4)}`);
} else if (tipoChave === "publica-antiga") {
  ok(`Chave anon (formato antigo): ${chave.slice(0, 12)}…${chave.slice(-6)}`);
} else {
  console.log(`  ${I} Formato de chave não reconhecido — vou tentar assim mesmo`);
}

if (falhou) {
  console.log("\n\x1b[31mCorrija as credenciais antes de seguir.\x1b[0m\n");
  process.exit(1);
}

/* -------------------------------------------------------------- 2. Conexão */

console.log("\n\x1b[1m2. Conexão e login anônimo\x1b[0m");

const cliente = createClient(url, chave, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data: sessao, error: erroLogin } = await cliente.auth.signInAnonymously();

if (erroLogin) {
  const msg = erroLogin.message ?? "";
  if (/anonymous.*disabled|signups not allowed|anonymous_provider_disabled/i.test(msg)) {
    erro(
      "Login anônimo está desligado",
      "Supabase → Authentication → Providers → Anonymous sign-ins → habilitar"
    );
  } else if (/rate limit|too many/i.test(msg)) {
    erro(
      "Limite de novas sessões atingido",
      "Authentication → Rate Limits → aumente o limite de sign-ups por hora"
    );
  } else if (/fetch failed|ENOTFOUND|getaddrinfo/i.test(msg)) {
    erro("Não consegui alcançar a URL", "confira a VITE_SUPABASE_URL e sua internet");
  } else if (/Invalid API key/i.test(msg)) {
    erro("Chave recusada", "confira se a anon key é deste mesmo projeto");
  } else {
    erro(`Falha no login anônimo: ${msg}`);
  }
  console.log("");
  process.exit(1);
}

ok(`sessão anônima criada (uid ${sessao.user.id.slice(0, 8)}…)`);

/* ---------------------------------------------------------------- 3. Schema */

console.log("\n\x1b[1m3. Schema e baralho\x1b[0m");

const { count, error: erroCartas } = await cliente
  .from("cartas")
  .select("*", { count: "exact", head: true });

if (erroCartas) {
  const msg = erroCartas.message ?? "";
  if (/does not exist|schema cache|Could not find the table/i.test(msg)) {
    erro(
      "As tabelas não existem",
      "cole o supabase/tudo.sql no SQL Editor do Supabase e rode"
    );
    console.log("");
    process.exit(1);
  }
  erro(`Erro lendo o baralho: ${msg}`);
} else if (!count || count < 200) {
  erro(
    `Baralho com apenas ${count ?? 0} cartas`,
    "rode o supabase/04_seed.sql (ou o tudo.sql) de novo"
  );
} else {
  ok(`${count} cartas no baralho (leves; as +18 ficam escondidas pelo RLS, e isso é o certo)`);
}

/* ------------------------------------------------------- 4. Partida completa */

console.log("\n\x1b[1m4. Uma partida de teste\x1b[0m");

let salaId = null;

try {
  const { data: criada, error: e1 } = await cliente.rpc("criar_sala", {
    p_apelido: "Teste A"
  });
  if (e1) throw e1;

  salaId = criada.sala_id;
  ok(`sala criada com o código ${criada.codigo}`);

  // Uma segunda pessoa, com outra sessão anônima
  const cliente2 = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error: e2 } = await cliente2.auth.signInAnonymously();
  if (e2) throw e2;

  const { error: e3 } = await cliente2.rpc("entrar_sala", {
    p_codigo: criada.codigo,
    p_apelido: "Teste B"
  });
  if (e3) throw e3;
  ok("segunda pessoa entrou pelo código");

  const { error: e4 } = await cliente.rpc("iniciar_partida", {
    p_sala: salaId,
    p_jogo: "mimica"
  });
  if (e4) throw e4;
  ok("partida de mímica iniciada");

  // A prova dos nove: o segredo não pode chegar em quem não é dono
  const { data: meuSegredo } = await cliente
    .from("estados_privados")
    .select("tipo")
    .eq("sala_id", salaId);

  const { data: segredoAlheio } = await cliente2
    .from("estados_privados")
    .select("tipo")
    .eq("sala_id", salaId);

  if ((meuSegredo?.length ?? 0) === 1 && (segredoAlheio?.length ?? 0) === 0) {
    ok("RLS funcionando: a palavra secreta só chega em quem faz a mímica");
  } else {
    erro(
      `RLS suspeito (dono viu ${meuSegredo?.length ?? 0}, o outro viu ${segredoAlheio?.length ?? 0}; esperado 1 e 0)`,
      "rode o supabase/02_policies.sql de novo"
    );
  }

  /*
   * Realtime — com os MESMOS bindings do app.
   *
   * Não basta checar se a assinatura conecta: um filtro apontando para uma
   * coluna que não existe deixa o canal "SUBSCRIBED" e mesmo assim mata a
   * entrega de eventos. Por isso aqui a gente provoca uma mudança de verdade e
   * espera o evento chegar.
   */
  const TABELAS_DO_APP = [
    { nome: "salas", coluna: "id" },
    { nome: "participantes", coluna: "sala_id" },
    { nome: "partidas", coluna: "sala_id" },
    { nome: "rodadas", coluna: "sala_id" },
    { nome: "estados_privados", coluna: "sala_id" },
    { nome: "envios", coluna: "sala_id" },
    { nome: "votos", coluna: "sala_id" },
    { nome: "pontuacoes", coluna: "sala_id" },
    { nome: "duelos", coluna: "sala_id" }
  ];

  const canal = cliente.channel(`checagem:${salaId}`);
  let eventosRecebidos = 0;

  for (const { nome, coluna } of TABELAS_DO_APP) {
    canal.on(
      "postgres_changes",
      { event: "*", schema: "public", table: nome, filter: `${coluna}=eq.${salaId}` },
      () => { eventosRecebidos += 1; }
    );
  }

  const conectou = await new Promise((resolve) => {
    const limite = setTimeout(() => resolve(false), 10000);
    canal.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(limite);
        resolve(true);
      }
    });
  });

  if (!conectou) {
    erro(
      "Realtime não conectou em 10 segundos",
      "rode o supabase/05_realtime.sql e confira Database → Replication"
    );
  } else {
    ok("Realtime conectado");

    // Provoca uma mudança na sala e espera o evento voltar
    await new Promise((r) => setTimeout(r, 800));
    await cliente2.rpc("ping_presenca", { p_sala: salaId });

    const chegou = await new Promise((resolve) => {
      const inicio = Date.now();
      const tique = setInterval(() => {
        if (eventosRecebidos > 0) { clearInterval(tique); resolve(true); }
        else if (Date.now() - inicio > 8000) { clearInterval(tique); resolve(false); }
      }, 200);
    });

    if (chegou) {
      ok(`eventos chegando de verdade (${eventosRecebidos} recebido(s))`);
    } else {
      erro(
        "O canal conectou, mas nenhum evento chegou em 8 segundos",
        "as tabelas não estão publicadas: rode o supabase/05_realtime.sql " +
          "e confira em Database → Replication → supabase_realtime"
      );
    }
  }

  await cliente.removeChannel(canal);
} catch (e) {
  erro(`Falhou: ${e.message ?? e}`, "confira se o supabase/tudo.sql foi aplicado inteiro");
} finally {
  if (salaId) {
    await cliente.rpc("encerrar_sala", { p_sala: salaId });
    console.log(`  ${I} sala de teste encerrada`);
  }
}

/* --------------------------------------------------------------- Resultado */

console.log(
  falhou
    ? "\n\x1b[31m\x1b[1mAlgo está faltando — veja as setas amarelas acima.\x1b[0m\n"
    : "\n\x1b[32m\x1b[1m✅ Tudo pronto! Pode chamar a galera.\x1b[0m\n"
);

process.exit(falhou ? 1 : 0);
