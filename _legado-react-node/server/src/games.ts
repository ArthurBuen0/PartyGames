import type { Game } from './types.js';

/**
 * Catálogo inicial. Esta é a única fonte da verdade: o cliente recebe o
 * catálogo pelo socket, então dá para editar/adicionar jogos aqui sem mexer
 * em nada no front.
 */
export const GAMES: Game[] = [
  {
    id: 'c-s-composto',
    nome: 'C, S, Composto',
    emoji: '🔤',
    resumo: 'Alguém fala uma palavra, o grupo grita se é com C, com S ou composta.',
    regras: [
      'Todo mundo em roda, marcando um ritmo com as mãos (bate-bate-palma).',
      'No ritmo, uma pessoa fala uma palavra qualquer.',
      'A pessoa seguinte responde na hora: "C", "S" ou "Composto", de acordo com a escrita da palavra.',
      'Quem errar, repetir palavra ou perder o ritmo paga uma prenda e a roda recomeça.',
      'A cada rodada o ritmo fica mais rápido — é aí que a bagunça começa.'
    ],
    dica: 'Combinem antes se vale palavra com Ç e como ela conta. Cada roda tem sua regra da casa!',
    jogadores: '3+',
    duracao: '5-10 min'
  },
  {
    id: 'palavra-parecida',
    nome: 'Palavra Parecida',
    emoji: '🔗',
    resumo: 'Cada pessoa fala uma palavra ligada à anterior. Travou, dançou.',
    regras: [
      'A primeira pessoa fala uma palavra qualquer. Ex: "praia".',
      'A próxima fala uma palavra relacionada à anterior. Ex: "areia".',
      'Segue na roda, sempre puxando gancho só da última palavra dita.',
      'Não vale repetir palavra que já saiu nem demorar mais que 3 segundos.',
      'Se o grupo achar que a ligação foi forçada, vota: se a maioria reclamar, a pessoa paga prenda.'
    ],
    dica: 'Alguém do grupo pode ficar de juiz e contar os 3 segundos em voz alta. Pressão é metade da graça.',
    jogadores: '3+',
    duracao: '5-10 min'
  },
  {
    id: 'quem-sou-eu',
    nome: 'Quem Sou Eu?',
    emoji: '🕵️',
    resumo: 'Um personagem na testa e perguntas de sim ou não até descobrir quem é.',
    regras: [
      'Cada pessoa escreve um personagem (famoso, desenho, alguém do grupo) num papel e passa para quem está à esquerda.',
      'Sem olhar, a pessoa segura o papel na testa ou cola no rosto.',
      'Na sua vez, faça perguntas que só tenham resposta "sim" ou "não". Ex: "sou pessoa real?".',
      'Se a resposta for "sim", continue perguntando. Se for "não", passa a vez.',
      'Ganha quem descobrir o próprio personagem primeiro.'
    ],
    dica: 'Sem celular! Personagem muito obscuro trava o jogo — vale combinar temas (novela, jogo, música).',
    jogadores: '3+',
    duracao: '10-15 min'
  },
  {
    id: 'verdade-ou-desafio',
    nome: 'Verdade ou Desafio (leve)',
    emoji: '🎯',
    resumo: 'A versão sem climão: perguntas curiosas e desafios bobos.',
    regras: [
      'Escolha quem começa e siga na roda (ou gire uma garrafa, se tiver).',
      'Na sua vez, escolha "verdade" ou "desafio".',
      'Verdade: responda com honestidade uma pergunta do grupo.',
      'Desafio: cumpra uma missão boba — imitar alguém, dançar 15 segundos, falar só cantando por uma rodada.',
      'Regra de ouro: nada constrangedor, nada perigoso e todo mundo pode dar "passo" uma vez.'
    ],
    dica: 'Combinem no início: 1 "passo" por pessoa, sem cobrança. Quem passa, paga um mico leve.',
    jogadores: '3+',
    duracao: '10-20 min'
  },
  {
    id: 'mimica',
    nome: 'Mímica',
    emoji: '🎭',
    resumo: 'Sem falar, sem apontar: represente até o time adivinhar.',
    regras: [
      'Dividam-se em dois times (ou joguem todos contra todos, um por vez).',
      'Uma pessoa recebe a palavra ou o filme e tem 1 minuto para representar.',
      'Proibido falar, fazer barulho, apontar objetos ou desenhar no ar as letras.',
      'Vale sinalizar categoria (filme, música, objeto) e número de palavras com os dedos.',
      'Acertou no tempo, ponto para o time. Depois passa a vez para o outro time.'
    ],
    dica: 'Sem lista pronta? Cada time escreve 5 palavras num papel e passa para o time adversário sortear.',
    jogadores: '4+',
    duracao: '15-20 min'
  },
  {
    id: 'eu-nunca',
    nome: 'Eu Nunca',
    emoji: '🙋',
    resumo: '"Eu nunca..." — quem já fez, abaixa um dedo. Prepare-se para as revelações.',
    regras: [
      'Todo mundo levanta cinco dedos (ou dez, se quiserem partida longa).',
      'Na sua vez, diga algo que você nunca fez. Ex: "eu nunca dormi no ônibus e perdi o ponto".',
      'Quem JÁ fez aquilo abaixa um dedo — e pode contar a história, se quiser.',
      'Segue na roda até sobrar uma pessoa com dedo levantado: essa é a mais certinha da mesa.',
      'Ninguém é obrigado a explicar nada: abaixar o dedo já basta.'
    ],
    dica: 'Mantenham no nível "engraçado", não no nível "terapia". O grupo agradece.',
    jogadores: '3+',
    duracao: '10-15 min'
  },
  {
    id: 'duas-verdades-uma-mentira',
    nome: 'Duas Verdades e Uma Mentira',
    emoji: '🤥',
    resumo: 'Três afirmações sobre você. O grupo tenta achar a mentira.',
    regras: [
      'Na sua vez, diga três coisas sobre você: duas verdadeiras e uma mentira.',
      'O grupo pode fazer até 3 perguntas para tentar te desmascarar.',
      'Todo mundo aponta ao mesmo tempo qual acha que é a mentira.',
      'Quem acertar ganha 1 ponto. Se ninguém acertar, quem contou ganha 2.',
      'Passa a vez e continua até todo mundo ter contado suas três.'
    ],
    dica: 'A melhor mentira é chata e possível. Verdade absurda de verdade é o que engana o grupo.',
    jogadores: '3+',
    duracao: '10-15 min'
  }
];

export const GAME_IDS = GAMES.map((g) => g.id);

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}
