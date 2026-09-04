export type Sessao = { codigo: string; jogadorId: string; apelido: string };

const CHAVE = 'sorteia-ai:sessao';
const CHAVE_APELIDO = 'sorteia-ai:apelido';

/** localStorage pode explodir (aba anônima, navegador travado): nunca confie. */
export function lerSessao(): Sessao | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Partial<Sessao>;
    if (!dados?.codigo || !dados?.jogadorId) return null;
    return { codigo: dados.codigo, jogadorId: dados.jogadorId, apelido: dados.apelido ?? '' };
  } catch {
    return null;
  }
}

export function salvarSessao(sessao: Sessao): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(sessao));
    if (sessao.apelido) localStorage.setItem(CHAVE_APELIDO, sessao.apelido);
  } catch {
    /* segue o jogo sem persistir */
  }
}

export function limparSessao(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}

/** O apelido sobrevive à saída da sala: ninguém quer digitar de novo. */
export function lerApelidoSalvo(): string {
  try {
    return localStorage.getItem(CHAVE_APELIDO) ?? '';
  } catch {
    return '';
  }
}

export function salvarApelido(apelido: string): void {
  try {
    localStorage.setItem(CHAVE_APELIDO, apelido);
  } catch {
    /* nada a fazer */
  }
}
