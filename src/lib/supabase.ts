import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente único do Supabase.
 *
 * A autenticação é anônima: ninguém cria conta para jogar. O `auth.uid()` da
 * sessão é o que amarra a pessoa ao assento dela na sala — e é sobre ele que
 * todas as políticas de RLS decidem o que pode ser lido.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Falta configurar o .env? A interface avisa em vez de quebrar em branco. */
export const supabaseConfigurado = Boolean(url && chave);

export const supabase: SupabaseClient = createClient(
  url ?? "http://localhost:54321",
  chave ?? "chave-ausente",
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
