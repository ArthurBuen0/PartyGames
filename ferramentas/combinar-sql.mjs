/**
 * Junta os cinco arquivos SQL em um só, para o setup no Supabase ser uma
 * colagem única em vez de cinco.
 *
 *   node ferramentas/combinar-sql.mjs
 *
 * O arquivo gerado (`supabase/tudo.sql`) é conferido pelos testes: se alguém
 * editar uma das partes e esquecer de regerar, `npm run test:sql` reclama.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASTA = path.join(RAIZ, "supabase");

export const PARTES = [
  "01_schema.sql",
  "02_policies.sql",
  "03_funcoes.sql",
  "04_seed.sql",
  "05_realtime.sql"
];

export function montar() {
  const cabecalho = `-- =============================================================================
-- Party Games — setup completo do banco
-- =============================================================================
-- ARQUIVO GERADO. Não edite aqui: mexa nos arquivos 01 a 05 e rode
--   node ferramentas/combinar-sql.mjs
--
-- Como usar: copie este arquivo inteiro e cole no SQL Editor do Supabase
-- (Database → SQL Editor → New query) e clique em Run. Pode rodar de novo
-- sempre que precisar — o script recria o baralho e substitui as funções.
-- =============================================================================

`;

  const corpo = PARTES.map((arquivo) => {
    const conteudo = readFileSync(path.join(PASTA, arquivo), "utf8");
    return `\n-- ${"#".repeat(74)}\n-- ARQUIVO: ${arquivo}\n-- ${"#".repeat(74)}\n\n${conteudo}`;
  }).join("\n");

  return cabecalho + corpo;
}

// Rodado direto pela linha de comando (e não importado por um teste)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destino = path.join(PASTA, "tudo.sql");
  const conteudo = montar();
  writeFileSync(destino, conteudo);

  const linhas = conteudo.split("\n").length;
  console.log(`✓ supabase/tudo.sql gerado — ${PARTES.length} arquivos, ${linhas} linhas`);
}
