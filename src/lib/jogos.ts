import type { CorJogador, JogoId } from "./tipos";

/**
 * Catálogo dos jogos: o que aparece no lobby e nas regras.
 *
 * As classes do Tailwind ficam escritas por extenso de propósito — o v4 varre o
 * código-fonte procurando as classes literais, então `bg-${cor}-100` não geraria
 * CSS nenhum.
 */

export interface Paleta {
  claro: string;
  texto: string;
  borda: string;
  solido: string;
  aro: string;
}

export const PALETA: Record<CorJogador, Paleta> = {
  roxo: {
    claro: "bg-roxo-100", texto: "text-roxo-700", borda: "border-roxo-500",
    solido: "bg-roxo-600", aro: "ring-roxo-500"
  },
  rosa: {
    claro: "bg-rosa-100", texto: "text-rosa-600", borda: "border-rosa-500",
    solido: "bg-rosa-500", aro: "ring-rosa-500"
  },
  amarelo: {
    claro: "bg-amarelo-100", texto: "text-amarelo-700", borda: "border-amarelo-500",
    solido: "bg-amarelo-500", aro: "ring-amarelo-500"
  },
  turquesa: {
    claro: "bg-turquesa-100", texto: "text-turquesa-600", borda: "border-turquesa-600",
    solido: "bg-turquesa-600", aro: "ring-turquesa-600"
  },
  coral: {
    claro: "bg-coral-100", texto: "text-coral-600", borda: "border-coral-600",
    solido: "bg-coral-600", aro: "ring-coral-600"
  },
  azul: {
    claro: "bg-azul-100", texto: "text-azul-600", borda: "border-azul-600",
    solido: "bg-azul-600", aro: "ring-azul-600"
  },
  verde: {
    claro: "bg-verde-100", texto: "text-verde-600", borda: "border-verde-600",
    solido: "bg-verde-600", aro: "ring-verde-600"
  },
  laranja: {
    claro: "bg-laranja-100", texto: "text-laranja-600", borda: "border-laranja-600",
    solido: "bg-laranja-600", aro: "ring-laranja-600"
  }
};

export interface DefinicaoJogo {
  id: JogoId;
  nome: string;
  emoji: string;
  cor: CorJogador;
  resumo: string;
  jogadores: string;
  duracao: string;
  minimo: number;
  regras: string[];
  /** O que cada pessoa vê de diferente na própria tela. */
  visibilidade: string;
}

export const JOGOS: DefinicaoJogo[] = [
  {
    id: "c-s-composto",
    nome: "C, S, Composto",
    emoji: "🔤",
    cor: "roxo",
    resumo: "Categoria sorteada e 5 segundos para responder na sequência C → S → composta.",
    jogadores: "3 a 12 pessoas",
    duracao: "5 a 15 min",
    minimo: 2,
    regras: [
      "O app sorteia uma categoria — frutas, cidades, filmes, animais — e mostra para todo mundo.",
      "Quem está na vez recebe a regra: uma palavra com C, com S ou uma palavra composta.",
      "São 5 segundos para falar em voz alta e tocar em “Próximo jogador”.",
      "Se o tempo zerar, a tela anuncia quem perdeu a rodada.",
      "O anfitrião confirma a eliminação ou perdoa, se a mesa achar que a resposta valeu.",
      "Segue até sobrar uma pessoa."
    ],
    visibilidade: "Todo mundo vê a mesma coisa. Só a tela de quem está na vez tem o botão de avançar."
  },
  {
    id: "palavra-parecida",
    nome: "Palavra Parecida",
    emoji: "🔗",
    cor: "rosa",
    resumo: "Corrente de associações: cada pessoa emenda uma palavra ligada à anterior.",
    jogadores: "3 a 12 pessoas",
    duracao: "5 a 10 min",
    minimo: 2,
    regras: [
      "A tela mostra a palavra da vez para todo mundo.",
      "Quem está na vez tem 5 segundos para falar uma palavra relacionada.",
      "Digite a palavra antes de avançar: ela entra no histórico visível da mesa.",
      "O grupo decide em voz alta se a associação faz sentido.",
      "Não vale repetir palavra nem estourar o tempo.",
      "Quem deixar o relógio zerar perde a rodada."
    ],
    visibilidade: "Tela igual para todos, com o histórico das últimas palavras."
  },
  {
    id: "quem-sou-eu",
    nome: "Quem Sou Eu?",
    emoji: "🕵️",
    cor: "amarelo",
    resumo: "Você é o único que não sabe quem você é. Pergunte até descobrir.",
    jogadores: "3 a 12 pessoas",
    duracao: "10 a 20 min",
    minimo: 2,
    regras: [
      "Cada pessoa recebe uma identidade secreta — que aparece na tela de todo mundo, menos na dela.",
      "Na sua vez, faça perguntas de sim ou não em voz alta.",
      "O grupo responde tocando em Sim, Não ou Talvez.",
      "Use “Meu palpite” quando achar que descobriu.",
      "Acertou: ponto, identidade revelada e a vez passa.",
      "Dá para jogar com limite de 10 perguntas por pessoa ou no modo livre."
    ],
    visibilidade: "Cada tela é diferente: você vê a identidade dos outros, nunca a sua."
  },
  {
    id: "mimica",
    nome: "Mímica",
    emoji: "🎭",
    cor: "turquesa",
    resumo: "60 segundos, só gestos. Quantas palavras a mesa adivinha?",
    jogadores: "3 a 12 pessoas",
    duracao: "10 a 20 min",
    minimo: 2,
    regras: [
      "A palavra secreta aparece só no celular de quem vai representar.",
      "O cronômetro de 60 segundos roda igual para a sala inteira.",
      "Proibido falar, escrever, formar letras com as mãos ou apontar objetos.",
      "Quando a mesa acertar, toque em “Acertaram”: vale ponto e vem palavra nova.",
      "No fim dos 60 segundos, a tela mostra quantas foram.",
      "Depois é só passar a vez para a próxima pessoa."
    ],
    visibilidade: "Só quem está fazendo a mímica recebe a palavra. Os outros veem o cronômetro."
  },
  {
    id: "cara-a-cara",
    nome: "Cara a Cara",
    emoji: "🧩",
    cor: "azul",
    resumo: "Duelo de perguntas até descobrir o personagem do adversário.",
    jogadores: "2 a 12 pessoas (em duplas)",
    duracao: "10 a 20 min",
    minimo: 2,
    regras: [
      "Cada pessoa recebe um personagem secreto — o adversário é quem precisa descobrir.",
      "Os dois veem o mesmo painel de 24 personagens ilustrados.",
      "Na sua vez, faça uma pergunta de sim ou não: “usa óculos?”, “tem barba?”.",
      "O adversário responde e passa a perguntar.",
      "Marque no painel quem já caiu: essa anotação é sua, o adversário não vê.",
      "Palpite certo vence a mesa; palpite errado entrega a vitória para o outro."
    ],
    visibilidade:
      "Com mais de duas pessoas, o anfitrião monta as duplas e cada mesa joga em paralelo."
  },
  {
    id: "duas-verdades",
    nome: "Duas Verdades e Uma Mentira",
    emoji: "🤥",
    cor: "coral",
    resumo: "Três frases sobre você. A mesa vota na inventada.",
    jogadores: "3 a 12 pessoas",
    duracao: "10 a 20 min",
    minimo: 3,
    regras: [
      "Quem está na vez escreve três frases numa tela privada e marca qual é a mentira.",
      "As frases vão embaralhadas para a tela de todo mundo.",
      "Todos votam em segredo — menos quem escreveu.",
      "A mesa vê quantas pessoas já votaram, nunca em quem votaram.",
      "Quando todo mundo vota, a resposta é revelada.",
      "Ponto para quem acertou e um ponto para o autor por cada pessoa enganada."
    ],
    visibilidade: "A escrita e o voto são privados; a contagem de votos é pública."
  },
  {
    id: "verdade-ou-desafio",
    nome: "Verdade ou Desafio",
    emoji: "🎲",
    cor: "verde",
    resumo: "Cartas leves — e um pacote +18 opcional, com consentimento.",
    jogadores: "3 a 12 pessoas",
    duracao: "15 a 30 min",
    minimo: 2,
    regras: [
      "Na sua vez, escolha Verdade ou Desafio.",
      "O app sorteia uma carta da categoria ativa e mostra para todo mundo.",
      "Você pode concluir, pedir outra carta ou pular.",
      "O botão “Não me sinto confortável” troca a carta sem cobrança nenhuma.",
      "Pular fica registrado no histórico, mas nunca vira punição.",
      "O modo +18 só liga com confirmação de maioridade e pode ser desligado a qualquer momento."
    ],
    visibilidade: "Tela igual para todos: a carta é lida em voz alta pela mesa."
  }
];

export function jogoPorId(id: JogoId | null | undefined): DefinicaoJogo | null {
  if (!id) return null;
  return JOGOS.find((j) => j.id === id) ?? null;
}
