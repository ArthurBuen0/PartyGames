/**
 * Sorteia Aí — catálogo de jogos e baralhos de desafios.
 *
 * Este arquivo é a única fonte da verdade do conteúdo: dá para adicionar,
 * editar ou remover jogos aqui sem encostar em app.js.
 *
 * Cada jogo tem um `painel`, que diz qual mecânica a tela individual monta:
 *   sequencia  → sorteia uma categoria e mostra a ordem C / S / composta
 *   corrente   → sorteia a palavra que abre a corrente de associações
 *   identidade → sorteia um personagem que fica escondido até revelar
 *   cronometro → sorteia a palavra secreta e roda 60 segundos
 *   escolha    → o jogador escolhe entre verdade e desafio
 *   jogador    → sorteia quem fala as três frases e sugere um tema
 */

const JOGOS = [
  {
    id: 'c-s-composto',
    nome: 'C, S, Composto',
    emoji: '🔤',
    cor: 'roxo',
    painel: 'sequencia',
    resumo: 'Uma categoria sorteada e três palavras na sequência: com C, com S e uma composta.',
    descricao:
      'O clássico da roda de amigos. O grupo escolhe uma categoria e cada pessoa emenda a palavra ' +
      'certa no ritmo: primeiro uma com C, depois uma com S e por fim uma palavra composta. ' +
      'Quem travar, repetir ou errar a vez perde a rodada.',
    jogadores: '3+ pessoas',
    duracao: '5 a 15 min',
    regras: [
      'Uma pessoa escolhe uma categoria, como cidades, animais ou frutas.',
      'Um jogador fala uma palavra da categoria começando com C.',
      'O próximo fala uma começando com S; depois, uma palavra composta.',
      'Quem repetir, errar ou demorar demais perde a rodada.'
    ],
    dica: 'Combinem antes se palavra com Ç entra como C. Cada roda tem sua regra da casa.',
    baralho: [
      'Cidades', 'Animais', 'Frutas', 'Comidas', 'Filmes', 'Países',
      'Objetos da cozinha', 'Profissões', 'Partes do corpo', 'Marcas',
      'Esportes', 'Instrumentos musicais', 'Personagens de desenho',
      'Coisas que existem na escola', 'Bebidas', 'Peças de roupa',
      'Animais que voam', 'Coisas geladas', 'Séries', 'Cantores brasileiros',
      'Lugares da cidade', 'Times de futebol', 'Doces', 'Plantas',
      'Meios de transporte', 'Coisas que fazem barulho', 'Aplicativos',
      'Coisas que cabem na mochila'
    ]
  },

  {
    id: 'palavra-parecida',
    nome: 'Palavra Parecida',
    emoji: '🔗',
    cor: 'rosa',
    painel: 'corrente',
    resumo: 'Cada pessoa fala uma palavra ligada à anterior. Travou, dançou.',
    descricao:
      'Uma corrente de associações que só termina quando alguém trava. O grupo é o juiz: ' +
      'se a maioria achar que a ligação foi forçada demais, a rodada é de quem falou.',
    jogadores: '3+ pessoas',
    duracao: '5 a 10 min',
    regras: [
      'O primeiro jogador fala qualquer palavra.',
      'Cada pessoa deve dizer uma palavra relacionada à anterior.',
      'A associação pode ser livre, mas o grupo decide se faz sentido.',
      'Não vale repetir palavras ou demorar demais.'
    ],
    dica: 'Alguém pode virar juiz e contar 3 segundos em voz alta. A pressão é metade da graça.',
    baralho: [
      'Praia', 'Café', 'Escola', 'Chuva', 'Futebol', 'Cinema', 'Bicicleta',
      'Feijoada', 'Verão', 'Aniversário', 'Telefone', 'Estrela', 'Guitarra',
      'Foguete', 'Sorvete', 'Biblioteca', 'Montanha', 'Pipoca', 'Domingo',
      'Carnaval', 'Ônibus', 'Relógio', 'Floresta', 'Cachorro', 'Hospital',
      'Aeroporto', 'Violão', 'Churrasco', 'Neve', 'Espelho'
    ]
  },

  {
    id: 'quem-sou-eu',
    nome: 'Quem Sou Eu?',
    emoji: '🕵️',
    cor: 'amarelo',
    painel: 'identidade',
    resumo: 'Um personagem escondido e perguntas de sim ou não até descobrir quem é.',
    descricao:
      'Cada pessoa recebe uma identidade sem ver e tenta descobrir quem é fazendo perguntas ' +
      'que só aceitam sim ou não. O app sorteia com a carta virada — quem está jogando não ' +
      'olha, só o resto do grupo.',
    jogadores: '3+ pessoas',
    duracao: '10 a 20 min',
    regras: [
      'Cada pessoa recebe o nome de uma pessoa, personagem ou objeto sem ver.',
      'Na sua vez, faça perguntas respondidas somente com sim ou não.',
      'Use as respostas para tentar descobrir sua identidade.',
      'Quem acertar pode ajudar a responder as perguntas dos demais.'
    ],
    dica: 'Personagem obscuro demais trava o jogo. Se ninguém do grupo conhecer, sorteie outro.',
    baralho: [
      { nome: 'Neymar', dica: 'Vive no mundo dos esportes' },
      { nome: 'Chapeuzinho Vermelho', dica: 'Saiu de um conto infantil' },
      { nome: 'Homem-Aranha', dica: 'Usa uniforme e salva gente' },
      { nome: 'Mickey Mouse', dica: 'Nasceu num desenho animado' },
      { nome: 'Anitta', dica: 'Vive no palco e nas paradas' },
      { nome: 'Xuxa', dica: 'Marcou a TV brasileira' },
      { nome: 'Papai Noel', dica: 'Só aparece uma vez por ano' },
      { nome: 'Mona Lisa', dica: 'Está pendurada num museu' },
      { nome: 'Batman', dica: 'Trabalha de madrugada' },
      { nome: 'Cinderela', dica: 'Perdeu um objeto numa festa' },
      { nome: 'Sherlock Holmes', dica: 'Vive resolvendo mistérios' },
      { nome: 'Harry Potter', dica: 'Estudou numa escola diferente' },
      { nome: 'Chaves', dica: 'Mora dentro de um barril' },
      { nome: 'Silvio Santos', dica: 'Passou décadas na televisão' },
      { nome: 'Pelé', dica: 'Ficou famoso com uma bola' },
      { nome: 'Ayrton Senna', dica: 'Andava muito rápido' },
      { nome: 'Elsa, de Frozen', dica: 'Tem tudo a ver com gelo' },
      { nome: 'Shrek', dica: 'Mora num pântano' },
      { nome: 'Darth Vader', dica: 'Respira alto e veste preto' },
      { nome: 'Mario', dica: 'Vive dentro de um videogame' },
      { nome: 'Pikachu', dica: 'É pequeno, amarelo e elétrico' },
      { nome: 'Ariel, a pequena sereia', dica: 'Passa o dia na água' },
      { nome: 'Cristiano Ronaldo', dica: 'Comemora sempre do mesmo jeito' },
      { nome: 'Ivete Sangalo', dica: 'Puxa multidão no Carnaval' },
      { nome: 'Mônica', dica: 'Anda com um coelho azul' },
      { nome: 'Cebolinha', dica: 'Troca uma letra ao falar' },
      { nome: 'Saci-Pererê', dica: 'Veio do folclore brasileiro' },
      { nome: 'Curupira', dica: 'Protege a floresta' },
      { nome: 'Bob Esponja', dica: 'Trabalha numa lanchonete' },
      { nome: 'Woody, de Toy Story', dica: 'É um brinquedo' },
      { nome: 'Cleópatra', dica: 'Governou há muito tempo' },
      { nome: 'Albert Einstein', dica: 'Ficou famoso pensando' },
      { nome: 'Michael Jackson', dica: 'Dançava de um jeito só dele' },
      { nome: 'Fada Sininho', dica: 'Cabe na palma da mão' }
    ]
  },

  {
    id: 'mimica',
    nome: 'Mímica',
    emoji: '🎭',
    cor: 'turquesa',
    painel: 'cronometro',
    resumo: 'Sessenta segundos, só gestos, nada de falar. O grupo tem que adivinhar.',
    descricao:
      'Uma palavra secreta aparece só para quem vai representar. A partir do Começar, são ' +
      '60 segundos de gesto puro: sem falar, sem escrever, sem apontar letras.',
    jogadores: '3+ pessoas',
    duracao: '10 a 20 min',
    regras: [
      'Um jogador vê uma palavra secreta.',
      'Ele tem 60 segundos para representá-la usando apenas gestos.',
      'Não pode falar, escrever ou apontar letras.',
      'Cada acerto vale um ponto; em seguida, troque de jogador.'
    ],
    dica: 'Vale combinar sinais universais antes: filme, música, livro, número de palavras.',
    baralho: [
      'Escovar os dentes', 'Andar de skate', 'Tocar violão', 'Fazer pipoca',
      'Jogar futebol', 'Dirigir no trânsito', 'Nadar', 'Pescar',
      'Dançar forró', 'Tirar uma selfie', 'Passar roupa', 'Trocar um pneu',
      'Tomar sorvete', 'Cortar o cabelo', 'Fazer um bolo', 'Acordar atrasado',
      'Assistir filme de terror', 'Varrer a casa', 'Tocar bateria',
      'Andar a cavalo', 'Ninar um bebê', 'Subir uma escada', 'Lavar a louça',
      'Girafa', 'Astronauta', 'Vampiro', 'Robô', 'Palhaço', 'Pinguim',
      'Guarda-chuva', 'Ventilador', 'Micro-ondas', 'Semáforo', 'Espelho',
      'Dentista', 'Bombeiro', 'Fantasma', 'Cachoeira', 'Elevador',
      'Aspirador de pó', 'Bailarina', 'Máquina de lavar', 'Jogador de vôlei',
      'Tirar leite da vaca', 'Montar uma barraca', 'Perder o ônibus'
    ]
  },

  {
    id: 'verdade-ou-desafio',
    nome: 'Verdade ou Desafio',
    emoji: '🎲',
    cor: 'coral',
    painel: 'escolha',
    resumo: 'A versão sem climão: perguntas curiosas e desafios bobos.',
    descricao:
      'Na sua vez, escolha um lado e o app sorteia. As perguntas são curiosas, os desafios ' +
      'são leves — e qualquer pessoa pode trocar algo que não curtiu, sem precisar explicar.',
    jogadores: '3+ pessoas',
    duracao: '15 a 30 min',
    regras: [
      'Na sua vez, escolha Verdade ou Desafio.',
      'Outra pessoa lê uma pergunta ou propõe um desafio leve.',
      'Todos devem respeitar limites; qualquer pessoa pode trocar algo desconfortável.',
      'Passe a vez para a próxima pessoa.'
    ],
    dica: 'Combinem no começo: cada pessoa pode passar uma vez na rodada, sem cobrança.',
    baralho: {
      verdade: [
        'Qual foi a maior mentira que você já contou?',
        'Qual o mico mais recente que você pagou?',
        'Qual música você ouve escondido do grupo?',
        'Qual foi a última coisa que você pesquisou no celular?',
        'Qual série você fingiu ter assistido só para participar da conversa?',
        'Qual comida todo mundo ama e você acha superestimada?',
        'Qual foi o presente mais sem graça que você já recebeu?',
        'Se pudesse trocar de vida com alguém daqui por um dia, com quem seria?',
        'Qual talento você tem que quase ninguém sabe?',
        'Qual foi a maior bobagem que você já comprou por impulso?',
        'Qual apelido de infância você preferia esquecer?',
        'Qual foi a última vez que você chorou vendo alguma coisa?',
        'Qual matéria da escola você odiava de verdade?',
        'Que hábito seu ninguém aqui imagina que você tem?',
        'Qual foi a desculpa mais criativa que você já deu para não sair?',
        'Qual sonho estranho você lembra até hoje?',
        'Qual foi o pior corte de cabelo da sua vida?',
        'Que trend da internet você já tentou copiar?',
        'Qual foi a viagem mais marcante que você já fez?',
        'Qual coisa simples te deixa feliz na hora?',
        'Qual medo bobo você ainda tem?',
        'Se pudesse mandar um recado para você de 10 anos atrás, qual seria?',
        'Qual foi a última promessa que você fez para si e não cumpriu?',
        'Qual foi o elogio mais legal que já te fizeram?'
      ],
      desafio: [
        'Cante o refrão da última música que você ouviu.',
        'Imite alguém do grupo até adivinharem quem é.',
        'Faça 10 polichinelos contando em voz alta.',
        'Fale só cantando até a sua próxima vez.',
        'Mostre a última foto da sua galeria — você escolhe qual pular.',
        'Faça uma pose de estátua por 30 segundos.',
        'Dance 15 segundos sem música nenhuma.',
        'Conte uma piada e aguente o silêncio se ninguém rir.',
        'Faça um comercial de 20 segundos para um objeto que estiver por perto.',
        'Fale com sotaque de outra região até o fim da rodada.',
        'Imite o som de três animais e deixe o grupo adivinhar.',
        'Faça uma cara de desespero e mantenha por 15 segundos.',
        'Invente um nome artístico para cada pessoa do grupo.',
        'Ande pela sala imitando um robô até a sua próxima vez.',
        'Faça uma narração esportiva do que está acontecendo agora.',
        'Diga um elogio sincero para cada pessoa da roda.',
        'Fale uma frase inteira sem usar a letra A.',
        'Repita um trava-língua três vezes seguidas sem errar.',
        'Imite a pessoa à sua direita atendendo o telefone.',
        'Conte uma história de 30 segundos que termine com "e foi aí que tudo mudou".',
        'Faça uma tirolesa imaginária e narre a descida.',
        'Escolha alguém do grupo para ser seu eco por uma rodada.',
        'Reencene a sua reação ao acordar de manhã.',
        'Faça uma pose para uma foto e deixe o grupo escolher a legenda.'
      ]
    }
  },

  {
    id: 'duas-verdades-uma-mentira',
    nome: 'Duas Verdades e Uma Mentira',
    emoji: '🤥',
    cor: 'azul',
    painel: 'jogador',
    resumo: 'Três frases sobre você, duas verdadeiras. O grupo vota na inventada.',
    descricao:
      'O app sorteia quem fala e sugere um tema. A pessoa conta três frases sobre si — duas ' +
      'verdades e uma mentira — e o grupo discute e vota antes da revelação.',
    jogadores: '3+ pessoas',
    duracao: '10 a 20 min',
    regras: [
      'Uma pessoa diz três frases sobre si.',
      'Duas são verdade e uma é mentira.',
      'O grupo conversa e vota na frase inventada.',
      'A pessoa revela a resposta e passa a vez.'
    ],
    dica: 'A melhor mentira é a mais sem graça. Verdade absurda demais entrega o jogo.',
    baralho: [
      'Viagens que você já fez',
      'Comidas que você já provou',
      'Coisas da sua infância',
      'Talentos escondidos',
      'Medos e manias',
      'Histórias de escola',
      'Perrengues de trabalho',
      'Esportes que você já tentou',
      'Famosos que você já viu de perto',
      'Coisas que você nunca fez',
      'Machucados e idas ao hospital',
      'Shows e festas',
      'Animais de estimação',
      'Habilidades bem inúteis',
      'Vergonhas alheias',
      'Recordes pessoais bobos'
    ]
  }
];

/** Frases que aparecem enquanto o dado do sorteio gira. */
const FRASES_SORTEIO = [
  'Embaralhando as cartas…',
  'Rolando o dado…',
  'Consultando o universo…',
  'Quase lá…'
];
