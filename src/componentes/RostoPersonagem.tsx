import type { Personagem } from "../lib/tipos";

/**
 * Rosto do Cara a Cara desenhado em SVG a partir dos atributos do personagem.
 *
 * Tudo é gerado aqui: nenhuma foto, nenhuma pessoa real, nenhuma imagem de
 * terceiros. Os traços são justamente os que viram pergunta no jogo — cabelo,
 * óculos, chapéu, barba, cor da camiseta e acessório.
 */

const PELE: Record<Personagem["pele"], string> = {
  clara: "#f4cba6",
  morena: "#c68642",
  negra: "#7d4b28"
};

const CABELO: Record<Personagem["cabelo"], string> = {
  preto: "#2b2118",
  castanho: "#6b4226",
  loiro: "#e8c56b",
  ruivo: "#b5462a",
  grisalho: "#c9c4c0",
  careca: "transparent"
};

const CAMISETA: Record<string, string> = {
  roxo: "#8b5cf6",
  rosa: "#ec4899",
  amarelo: "#facc15",
  azul: "#38bdf8",
  verde: "#34d399",
  vermelho: "#f87171",
  laranja: "#fb923c",
  cinza: "#94a3b8"
};

interface Props {
  personagem: Personagem;
  /** Marcado como descartado no painel: fica apagado e recebe um X. */
  eliminado?: boolean;
  className?: string;
}

export function RostoPersonagem({ personagem, eliminado = false, className = "" }: Props) {
  const pele = PELE[personagem.pele] ?? PELE.clara;
  const cabelo = CABELO[personagem.cabelo] ?? CABELO.castanho;
  const camiseta = CAMISETA[personagem.camiseta] ?? CAMISETA.azul;

  return (
    <svg
      viewBox="0 0 100 118"
      className={className}
      role="img"
      aria-label={`Ilustração de ${personagem.nome}`}
      style={{ opacity: eliminado ? 0.28 : 1, transition: "opacity 180ms" }}
    >
      {/* Ombros / camiseta */}
      <path d="M14 118 C16 96 32 88 50 88 C68 88 84 96 86 118 Z" fill={camiseta} />

      {/* Pescoço */}
      <rect x="43" y="74" width="14" height="18" rx="6" fill={pele} />

      {/* Cabeça */}
      <ellipse cx="50" cy="52" rx="27" ry="30" fill={pele} />

      {/* Orelhas */}
      <ellipse cx="23" cy="54" rx="4.5" ry="6" fill={pele} />
      <ellipse cx="77" cy="54" rx="4.5" ry="6" fill={pele} />

      {/* Cabelo, conforme o estilo */}
      {personagem.estilo_cabelo === "curto" && (
        <path d="M23 45 C24 26 38 20 50 20 C62 20 76 26 77 45 C72 36 62 32 50 32 C38 32 28 36 23 45 Z" fill={cabelo} />
      )}
      {personagem.estilo_cabelo === "longo" && (
        <>
          <path d="M21 48 C21 26 36 19 50 19 C64 19 79 26 79 48 L79 78 C79 70 74 66 74 52 C68 40 58 36 50 36 C42 36 32 40 26 52 C26 66 21 70 21 78 Z" fill={cabelo} />
        </>
      )}
      {personagem.estilo_cabelo === "cacheado" && (
        <g fill={cabelo}>
          <circle cx="32" cy="32" r="11" />
          <circle cx="50" cy="25" r="12" />
          <circle cx="68" cy="32" r="11" />
          <circle cx="24" cy="45" r="9" />
          <circle cx="76" cy="45" r="9" />
        </g>
      )}

      {/* Barba */}
      {personagem.barba && (
        <path
          d="M27 56 C27 78 38 88 50 88 C62 88 73 78 73 56 C70 72 62 78 50 78 C38 78 30 72 27 56 Z"
          fill={cabelo === "transparent" ? "#4b3a2a" : cabelo}
        />
      )}

      {/* Olhos */}
      <circle cx="39" cy="52" r="3.4" fill="#2a1a4a" />
      <circle cx="61" cy="52" r="3.4" fill="#2a1a4a" />

      {/* Sobrancelhas */}
      <rect x="33" y="43" width="12" height="3" rx="1.5" fill={cabelo === "transparent" ? "#6b4226" : cabelo} />
      <rect x="55" y="43" width="12" height="3" rx="1.5" fill={cabelo === "transparent" ? "#6b4226" : cabelo} />

      {/* Boca */}
      <path d="M42 66 Q50 72 58 66" stroke="#2a1a4a" strokeWidth="2.4" fill="none" strokeLinecap="round" />

      {/* Óculos */}
      {personagem.oculos && (
        <g stroke="#2a1a4a" strokeWidth="2.4" fill="rgba(255,255,255,0.35)">
          <circle cx="39" cy="52" r="9" />
          <circle cx="61" cy="52" r="9" />
          <path d="M48 52 h4" />
        </g>
      )}

      {/* Chapéu */}
      {personagem.chapeu && (
        <g>
          <rect x="16" y="26" width="68" height="6" rx="3" fill="#3b0764" />
          <path d="M30 26 C30 12 42 8 50 8 C58 8 70 12 70 26 Z" fill="#6d28d9" />
        </g>
      )}

      {/* Acessórios */}
      {personagem.acessorio === "brinco" && (
        <>
          <circle cx="23" cy="61" r="3" fill="#facc15" />
          <circle cx="77" cy="61" r="3" fill="#facc15" />
        </>
      )}
      {personagem.acessorio === "colar" && (
        <>
          <path d="M40 92 Q50 102 60 92" stroke="#facc15" strokeWidth="2.6" fill="none" />
          <circle cx="50" cy="99" r="3.4" fill="#facc15" />
        </>
      )}
      {personagem.acessorio === "cachecol" && (
        <>
          <path d="M30 90 Q50 100 70 90 L70 99 Q50 109 30 99 Z" fill="#ec4899" />
          <rect x="44" y="98" width="8" height="16" rx="3" fill="#ec4899" />
        </>
      )}

      {/* Marca de eliminado */}
      {eliminado && (
        <g stroke="#e11d48" strokeWidth="6" strokeLinecap="round" opacity="0.9">
          <path d="M22 22 L78 96" />
          <path d="M78 22 L22 96" />
        </g>
      )}
    </svg>
  );
}
