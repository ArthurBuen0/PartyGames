import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente único do Supabase.
 *
 * A autenticação é anônima: ninguém cria conta para jogar. O `auth.uid()` da
 * sessão é o que amarra a pessoa ao assento dela na sala — e é sobre ele que
 * todas as políticas de RLS decidem o que pode ser lido.
 *
 * Sobre a validação abaixo: `createClient` lança exceção se a URL for
 * inválida. Como isso acontece durante a importação do módulo, o React nem
 * chega a montar e a pessoa vê uma tela branca, sem pista nenhuma. Já custou
 * uma sessão de depuração — então aqui a configuração é conferida antes, e o
 * app troca a tela branca por uma explicação do que está faltando.
 */

const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const chave = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

function ehUrlHttp(valor: string): boolean {
  try {
    const partes = new URL(valor);
    return partes.protocol === "https:" || partes.protocol === "http:";
  } catch {
    return false;
  }
}

export interface ProblemaDeConfig {
  variavel: string;
  problema: string;
  comoArrumar: string;
}

/** O que está faltando ou errado no .env / nas variáveis da hospedagem. */
export const problemasDeConfig: ProblemaDeConfig[] = [];

if (!url) {
  problemasDeConfig.push({
    variavel: "VITE_SUPABASE_URL",
    problema: "não foi definida",
    comoArrumar: "Copie a Project URL em Supabase → Project Settings → API"
  });
} else if (!ehUrlHttp(url)) {
  problemasDeConfig.push({
    variavel: "VITE_SUPABASE_URL",
    problema: `recebeu um valor que não é um endereço: "${url.slice(0, 40)}"`,
    comoArrumar: "O valor deve ser algo como https://xxxxx.supabase.co"
  });
}

if (!chave) {
  problemasDeConfig.push({
    variavel: "VITE_SUPABASE_ANON_KEY",
    problema: "não foi definida",
    comoArrumar: "Use a chave publishable (sb_publishable_…) ou a anon (eyJ…)"
  });
} else if (chave.startsWith("sb_secret_") || chave.includes("service_role")) {
  problemasDeConfig.push({
    variavel: "VITE_SUPABASE_ANON_KEY",
    problema: "recebeu a chave SECRETA",
    comoArrumar:
      "Troque pela chave pública imediatamente e revogue esta — a secreta ignora o RLS"
  });
} else if (ehUrlHttp(chave)) {
  problemasDeConfig.push({
    variavel: "VITE_SUPABASE_ANON_KEY",
    problema: "recebeu um endereço, não uma chave",
    comoArrumar: "Parece que os valores das duas variáveis foram trocados"
  });
}

export const supabaseConfigurado = problemasDeConfig.length === 0;

/**
 * Valores de reserva mantêm o `createClient` de explodir quando a configuração
 * está errada. Nesse caso o app nem tenta falar com o servidor: mostra a tela
 * que explica o problema.
 */
export const supabase: SupabaseClient = createClient(
  ehUrlHttp(url) ? url : "http://localhost:54321",
  chave || "chave-ausente",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "party-games-sessao"
    },
    realtime: {
      params: { eventsPerSecond: 20 }
    }
  }
);

/**
 * Garante uma sessão anônima. Chamada antes de qualquer RPC: se a pessoa já
 * jogou antes, o token vem do localStorage e ela volta para o mesmo assento.
 */
export async function garantirSessao(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user?.id) return data.session.user.id;

  const { data: nova, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!nova.user?.id) throw new Error("SEM_SESSAO");
  return nova.user.id;
}

/** Açúcar para as RPCs, já convertendo o retorno. */
export async function chamar<T>(
  funcao: string,
  parametros: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabase.rpc(funcao, parametros);
  if (error) throw error;
  return data as T;
}
