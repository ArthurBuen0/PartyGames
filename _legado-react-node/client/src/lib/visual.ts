/** Cores dos avatares — sempre a mesma cor para o mesmo apelido. */
const CORES_AVATAR = [
  '#6d28d9',
  '#f43f5e',
  '#f97316',
  '#0ea5e9',
  '#10b981',
  '#d946ef',
  '#eab308',
  '#14b8a6'
];

/** Fundinho do emoji de cada jogo, na ordem do catálogo. */
const CORES_JOGO = [
  'rgba(139, 92, 246, 0.18)',
  'rgba(244, 63, 94, 0.16)',
  'rgba(14, 165, 233, 0.16)',
  'rgba(249, 115, 22, 0.18)',
  'rgba(16, 185, 129, 0.16)',
  'rgba(217, 70, 239, 0.16)',
  'rgba(234, 179, 8, 0.2)'
];

function hash(texto: string): number {
  let total = 0;
  for (let i = 0; i < texto.length; i += 1) total = (total * 31 + texto.charCodeAt(i)) >>> 0;
  return total;
}

export function corDoApelido(apelido: string): string {
  return CORES_AVATAR[hash(apelido) % CORES_AVATAR.length] as string;
}

export function corDoJogo(indice: number): string {
  return CORES_JOGO[indice % CORES_JOGO.length] as string;
}

export function iniciais(apelido: string): string {
  const partes = apelido.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2);
  return `${partes[0]![0]}${partes[1]![0]}`;
}

/** Vibração curtinha no celular quando o resultado aparece. */
export function vibrar(padrao: number | number[]): void {
  try {
    navigator.vibrate?.(padrao);
  } catch {
    /* navegador sem vibração, tudo bem */
  }
}
