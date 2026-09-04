import type { SessaoLocal } from "./tipos";

/**
 * Lembra em qual sala esta pessoa estava.
 *
 * Serve para o caso mais comum de todos: a pessoa recarrega a página, o celular
 * bloqueia, o app vai para segundo plano. Com o código da sala e o apelido
 * guardados, dá para voltar direto ao assento sem perguntar nada de novo — o
 * `entrar_sala()` reaproveita o participante existente.
 */

const CHAVE = "party-games:sala";

export function guardarSessao(sessao: SessaoLocal): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(sessao));
  } catch {
    /* aba anônima ou armazenamento cheio: segue sem lembrar */
  }
}

export function lerSessao(codigo?: string): SessaoLocal | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;

    const dados = JSON.parse(bruto) as SessaoLocal;
    if (!dados?.salaId || !dados?.codigo) return null;
    if (codigo && dados.codigo.toUpperCase() !== codigo.toUpperCase()) return null;

    return dados;
  } catch {
    return null;
  }
}

export function esquecerSessao(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}

/** Último apelido usado, para já vir preenchido no campo. */
export function ultimoApelido(): string {
  try {
    return localStorage.getItem("party-games:apelido") ?? "";
  } catch {
    return "";
  }
}

export function guardarApelido(apelido: string): void {
  try {
    localStorage.setItem("party-games:apelido", apelido);
  } catch {
    /* nada a fazer */
  }
}
