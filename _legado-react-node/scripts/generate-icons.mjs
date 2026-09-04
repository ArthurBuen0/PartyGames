/**
 * Gera os ícones PNG do PWA sem depender de nenhuma lib de imagem:
 * desenha o dado do "Sorteia Aí" pixel a pixel e escreve o PNG na mão.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'client', 'public', 'icons');

/* ---------------------------------------------------------------- PNG cru */

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length, 0);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([tamanho, corpo, crc]);
}

function montarPng(largura, altura, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filtro padrão
  ihdr[12] = 0; // sem entrelace

  const passo = largura * 4;
  const bruto = Buffer.alloc((passo + 1) * altura);
  for (let y = 0; y < altura; y += 1) {
    bruto[y * (passo + 1)] = 0; // filtro "none" na linha
    rgba.copy(bruto, y * (passo + 1) + 1, y * passo, (y + 1) * passo);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(bruto, { level: 9 })),
    bloco('IEND', Buffer.alloc(0))
  ]);
}

/* ------------------------------------------------------------- Desenho */

const ROXO_CLARO = [139, 92, 246];
const ROXO = [109, 40, 217];
const ROSA = [244, 63, 94];
const ROXO_ESCURO = [91, 33, 182];
const BRANCO = [255, 255, 255];

function misturar(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

/** Distância assinada até um retângulo de cantos redondos (negativo = dentro). */
function distanciaRetangulo(px, py, cx, cy, meiaLargura, meiaAltura, raio) {
  const dx = Math.abs(px - cx) - (meiaLargura - raio);
  const dy = Math.abs(py - cy) - (meiaAltura - raio);
  const fora = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return Math.min(Math.max(dx, dy), 0) + fora - raio;
}

/**
 * Cor de um ponto do ícone: fundo em degradê, dado branco por cima e os
 * cinco pontinhos roxos. Devolve [r, g, b, a] com a em 0..1.
 */
function amostrar(x, y, tamanho, opcoes) {
  const t = (x / tamanho) * 0.55 + (y / tamanho) * 0.45;
  const fundo = t < 0.55 ? misturar(ROXO_CLARO, ROXO, t / 0.55) : misturar(ROXO, ROSA, (t - 0.55) / 0.45);

  let alfa = 1;
  if (!opcoes.sangraTudo) {
    const d = distanciaRetangulo(x, y, tamanho / 2, tamanho / 2, tamanho / 2, tamanho / 2, tamanho * 0.235);
    if (d > 0) alfa = 0;
  }
  if (alfa === 0) return [0, 0, 0, 0];

  const meia = tamanho * opcoes.escalaDado;
  const dentroDoDado = distanciaRetangulo(
    x,
    y,
    tamanho / 2,
    tamanho / 2,
    meia,
    meia,
    meia * 0.26
  );

  if (dentroDoDado > 0) return [...fundo, 1];

  // Pontinhos do dado (face 5).
  const desloc = meia * 0.46;
  const raioPonto = meia * 0.135;
  const centros = [
    [tamanho / 2 - desloc, tamanho / 2 - desloc],
    [tamanho / 2 + desloc, tamanho / 2 - desloc],
    [tamanho / 2, tamanho / 2],
    [tamanho / 2 - desloc, tamanho / 2 + desloc],
    [tamanho / 2 + desloc, tamanho / 2 + desloc]
  ];
  for (const [cx, cy] of centros) {
    if (Math.hypot(x - cx, y - cy) <= raioPonto) return [...ROXO_ESCURO, 1];
  }
  return [...BRANCO, 1];
}

/** Renderiza com 4x4 amostras por pixel para as bordas saírem lisinhas. */
function renderizar(tamanho, opcoes) {
  const rgba = Buffer.alloc(tamanho * tamanho * 4);
  const amostras = 4;
  const passo = 1 / amostras;

  for (let y = 0; y < tamanho; y += 1) {
    for (let x = 0; x < tamanho; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < amostras; sy += 1) {
        for (let sx = 0; sx < amostras; sx += 1) {
          const cor = amostrar(x + (sx + 0.5) * passo, y + (sy + 0.5) * passo, tamanho, opcoes);
          r += cor[0] * cor[3];
          g += cor[1] * cor[3];
          b += cor[2] * cor[3];
          a += cor[3];
        }
      }

      const total = amostras * amostras;
      const i = (y * tamanho + x) * 4;
      // Cores já vêm multiplicadas pelo alfa: divide de volta para não escurecer a borda.
      rgba[i] = a > 0 ? Math.round(r / a) : 0;
      rgba[i + 1] = a > 0 ? Math.round(g / a) : 0;
      rgba[i + 2] = a > 0 ? Math.round(b / a) : 0;
      rgba[i + 3] = Math.round((a / total) * 255);
    }
  }

  return montarPng(tamanho, tamanho, rgba);
}

/* --------------------------------------------------------------- Saída */

mkdirSync(DESTINO, { recursive: true });

const arquivos = [
  { nome: 'icon-192.png', tamanho: 192, opcoes: { sangraTudo: false, escalaDado: 0.3 } },
  { nome: 'icon-512.png', tamanho: 512, opcoes: { sangraTudo: false, escalaDado: 0.3 } },
  // Maskable: fundo de ponta a ponta e dado menor, dentro da zona segura (80%).
  { nome: 'maskable-512.png', tamanho: 512, opcoes: { sangraTudo: true, escalaDado: 0.22 } },
  // iOS não respeita transparência: quadrado cheio, o sistema arredonda.
  { nome: 'apple-touch-icon.png', tamanho: 180, opcoes: { sangraTudo: true, escalaDado: 0.28 } }
];

for (const arquivo of arquivos) {
  const png = renderizar(arquivo.tamanho, arquivo.opcoes);
  writeFileSync(path.join(DESTINO, arquivo.nome), png);
  console.log(`✓ ${arquivo.nome} (${arquivo.tamanho}px, ${(png.length / 1024).toFixed(1)} KB)`);
}

console.log(`\nÍcones gerados em ${DESTINO}`);
