export function linkDaSala(codigo: string): string {
  return `${window.location.origin}/entrar?sala=${codigo}`;
}

/**
 * clipboard.writeText só existe em contexto seguro (https ou localhost).
 * Testando pelo IP da rede local no celular caímos no plano B.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    /* tenta o plano B */
  }

  try {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const deu = document.execCommand('copy');
    document.body.removeChild(area);
    return deu;
  } catch {
    return false;
  }
}

/** Usa o compartilhamento nativo quando existe; devolve false se não rolou. */
export async function compartilharNativo(dados: ShareData): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    await navigator.share(dados);
    return true;
  } catch {
    // Cancelar o menu de compartilhamento cai aqui — não é erro.
    return false;
  }
}
