-- =============================================================================
-- Party Games — baralho de cartas
-- =============================================================================
-- Rodar de novo é seguro: limpa e recria o baralho. As cartas ficam no banco
-- porque o sorteio acontece no servidor — assim o cliente nunca escolhe (nem
-- enxerga antes da hora) a palavra da mímica ou a identidade do Quem Sou Eu?.
-- =============================================================================

delete from cartas;

-- ------------------------------------------------- C, S, Composto: categorias

insert into cartas (jogo, tipo, conteudo) values
  ('c-s-composto', 'categoria', '{"texto":"Frutas"}'),
  ('c-s-composto', 'categoria', '{"texto":"Cidades"}'),
  ('c-s-composto', 'categoria', '{"texto":"Filmes"}'),
  ('c-s-composto', 'categoria', '{"texto":"Animais"}'),
  ('c-s-composto', 'categoria', '{"texto":"Comidas"}'),
  ('c-s-composto', 'categoria', '{"texto":"Países"}'),
  ('c-s-composto', 'categoria', '{"texto":"Profissões"}'),
  ('c-s-composto', 'categoria', '{"texto":"Objetos da cozinha"}'),
  ('c-s-composto', 'categoria', '{"texto":"Partes do corpo"}'),
  ('c-s-composto', 'categoria', '{"texto":"Marcas"}'),
  ('c-s-composto', 'categoria', '{"texto":"Esportes"}'),
  ('c-s-composto', 'categoria', '{"texto":"Instrumentos musicais"}'),
  ('c-s-composto', 'categoria', '{"texto":"Personagens de desenho"}'),
  ('c-s-composto', 'categoria', '{"texto":"Coisas que existem na escola"}'),
  ('c-s-composto', 'categoria', '{"texto":"Bebidas"}'),
  ('c-s-composto', 'categoria', '{"texto":"Peças de roupa"}'),
  ('c-s-composto', 'categoria', '{"texto":"Animais que voam"}'),
  ('c-s-composto', 'categoria', '{"texto":"Coisas geladas"}'),
  ('c-s-composto', 'categoria', '{"texto":"Séries"}'),
  ('c-s-composto', 'categoria', '{"texto":"Cantores brasileiros"}'),
  ('c-s-composto', 'categoria', '{"texto":"Lugares da cidade"}'),
  ('c-s-composto', 'categoria', '{"texto":"Times de futebol"}'),
  ('c-s-composto', 'categoria', '{"texto":"Doces"}'),
  ('c-s-composto', 'categoria', '{"texto":"Plantas"}'),
  ('c-s-composto', 'categoria', '{"texto":"Meios de transporte"}'),
  ('c-s-composto', 'categoria', '{"texto":"Aplicativos"}'),
  ('c-s-composto', 'categoria', '{"texto":"Coisas que fazem barulho"}'),
  ('c-s-composto', 'categoria', '{"texto":"Coisas que cabem na mochila"}');

-- --------------------------------------------- Palavra Parecida: palavra inicial

insert into cartas (jogo, tipo, conteudo) values
  ('palavra-parecida', 'palavra', '{"texto":"Praia"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Café"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Escola"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Chuva"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Futebol"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Cinema"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Bicicleta"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Feijoada"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Verão"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Aniversário"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Telefone"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Estrela"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Guitarra"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Foguete"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Sorvete"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Biblioteca"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Montanha"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Pipoca"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Domingo"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Carnaval"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Ônibus"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Relógio"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Floresta"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Cachorro"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Hospital"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Aeroporto"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Churrasco"}'),
  ('palavra-parecida', 'palavra', '{"texto":"Espelho"}');

-- ------------------------------------------------ Quem Sou Eu?: identidades
-- Personagens de domínio público, arquétipos e figuras genéricas — nada de
-- foto ou material de terceiros.

insert into cartas (jogo, tipo, conteudo) values
  ('quem-sou-eu', 'identidade', '{"nome":"Chapeuzinho Vermelho","dica":"Saiu de um conto infantil"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Papai Noel","dica":"Só aparece uma vez por ano"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Cinderela","dica":"Perdeu um objeto numa festa"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Sherlock Holmes","dica":"Vive resolvendo mistérios"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Saci-Pererê","dica":"Veio do folclore brasileiro"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Curupira","dica":"Protege a floresta"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Iara","dica":"Mora nas águas do rio"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Boitatá","dica":"Do folclore, e brilha no escuro"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Mula sem cabeça","dica":"Lenda que corre à noite"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Dom Quixote","dica":"Saiu de um livro muito antigo"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Robin Hood","dica":"Tem pontaria e causa polêmica"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Drácula","dica":"Prefere a madrugada"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Frankenstein","dica":"Nasceu de um experimento"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Pinóquio","dica":"Tem um problema com mentiras"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Alice","dica":"Caiu num lugar muito estranho"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Peter Pan","dica":"Não quis crescer"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Rei Arthur","dica":"Tem uma espada famosa"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Mago","dica":"Personagem clássico de fantasia"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Pirata","dica":"Trabalha no mar, mas sem carteira assinada"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Astronauta","dica":"Trabalha muito longe daqui"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Bombeiro","dica":"Chega quando a situação aperta"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Dentista","dica":"Muita gente tem medo de visitar"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Palhaço","dica":"Trabalha fazendo rir"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Bailarina","dica":"Vive treinando equilíbrio"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Detetive","dica":"Faz muita pergunta por profissão"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Chef de cozinha","dica":"Trabalha no calor"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Girafa","dica":"Não é gente"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Pinguim","dica":"Não é gente, e sente frio de propósito"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Polvo","dica":"Não é gente, e tem muitos braços"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Preguiça","dica":"Não é gente, e não tem pressa"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Dinossauro","dica":"Não é gente, e faz tempo que sumiu"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Unicórnio","dica":"Não é gente, e nem existe"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Escova de dentes","dica":"É um objeto do banheiro"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Geladeira","dica":"É um objeto, e é grande"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Guarda-chuva","dica":"É um objeto, e depende do tempo"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Semáforo","dica":"É um objeto que manda em todo mundo"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Controle remoto","dica":"É um objeto que sempre some"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Espelho","dica":"É um objeto que devolve o que recebe"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Violão","dica":"É um objeto que faz barulho de propósito"}'),
  ('quem-sou-eu', 'identidade', '{"nome":"Ventilador","dica":"É um objeto que só aparece no verão"}');

-- ---------------------------------------------------- Mímica: palavras

insert into cartas (jogo, tipo, conteudo) values
  ('mimica', 'mimica', '{"texto":"Escovar os dentes"}'),
  ('mimica', 'mimica', '{"texto":"Andar de skate"}'),
  ('mimica', 'mimica', '{"texto":"Tocar violão"}'),
  ('mimica', 'mimica', '{"texto":"Fazer pipoca"}'),
  ('mimica', 'mimica', '{"texto":"Jogar futebol"}'),
  ('mimica', 'mimica', '{"texto":"Dirigir no trânsito"}'),
  ('mimica', 'mimica', '{"texto":"Nadar"}'),
  ('mimica', 'mimica', '{"texto":"Pescar"}'),
  ('mimica', 'mimica', '{"texto":"Dançar forró"}'),
  ('mimica', 'mimica', '{"texto":"Tirar uma selfie"}'),
  ('mimica', 'mimica', '{"texto":"Passar roupa"}'),
  ('mimica', 'mimica', '{"texto":"Trocar um pneu"}'),
  ('mimica', 'mimica', '{"texto":"Tomar sorvete"}'),
  ('mimica', 'mimica', '{"texto":"Cortar o cabelo"}'),
  ('mimica', 'mimica', '{"texto":"Fazer um bolo"}'),
  ('mimica', 'mimica', '{"texto":"Acordar atrasado"}'),
  ('mimica', 'mimica', '{"texto":"Assistir filme de terror"}'),
  ('mimica', 'mimica', '{"texto":"Varrer a casa"}'),
  ('mimica', 'mimica', '{"texto":"Tocar bateria"}'),
  ('mimica', 'mimica', '{"texto":"Andar a cavalo"}'),
  ('mimica', 'mimica', '{"texto":"Ninar um bebê"}'),
  ('mimica', 'mimica', '{"texto":"Subir uma escada"}'),
  ('mimica', 'mimica', '{"texto":"Lavar a louça"}'),
  ('mimica', 'mimica', '{"texto":"Perder o ônibus"}'),
  ('mimica', 'mimica', '{"texto":"Montar uma barraca"}'),
  ('mimica', 'mimica', '{"texto":"Tirar leite da vaca"}'),
  ('mimica', 'mimica', '{"texto":"Girafa"}'),
  ('mimica', 'mimica', '{"texto":"Astronauta"}'),
  ('mimica', 'mimica', '{"texto":"Vampiro"}'),
  ('mimica', 'mimica', '{"texto":"Robô"}'),
  ('mimica', 'mimica', '{"texto":"Palhaço"}'),
  ('mimica', 'mimica', '{"texto":"Pinguim"}'),
  ('mimica', 'mimica', '{"texto":"Guarda-chuva"}'),
  ('mimica', 'mimica', '{"texto":"Ventilador"}'),
  ('mimica', 'mimica', '{"texto":"Micro-ondas"}'),
  ('mimica', 'mimica', '{"texto":"Semáforo"}'),
  ('mimica', 'mimica', '{"texto":"Espelho"}'),
  ('mimica', 'mimica', '{"texto":"Dentista"}'),
  ('mimica', 'mimica', '{"texto":"Bombeiro"}'),
  ('mimica', 'mimica', '{"texto":"Fantasma"}'),
  ('mimica', 'mimica', '{"texto":"Cachoeira"}'),
  ('mimica', 'mimica', '{"texto":"Elevador"}'),
  ('mimica', 'mimica', '{"texto":"Aspirador de pó"}'),
  ('mimica', 'mimica', '{"texto":"Bailarina"}'),
  ('mimica', 'mimica', '{"texto":"Máquina de lavar"}'),
  ('mimica', 'mimica', '{"texto":"Jogador de vôlei"}'),
  ('mimica', 'mimica', '{"texto":"Chuva forte"}'),
  ('mimica', 'mimica', '{"texto":"Fila de banco"}');

-- ------------------------------------------- Duas Verdades: temas sugeridos

insert into cartas (jogo, tipo, conteudo) values
  ('duas-verdades', 'tema', '{"texto":"Viagens que você já fez"}'),
  ('duas-verdades', 'tema', '{"texto":"Comidas que você já provou"}'),
  ('duas-verdades', 'tema', '{"texto":"Coisas da sua infância"}'),
  ('duas-verdades', 'tema', '{"texto":"Talentos escondidos"}'),
  ('duas-verdades', 'tema', '{"texto":"Medos e manias"}'),
  ('duas-verdades', 'tema', '{"texto":"Histórias de escola"}'),
  ('duas-verdades', 'tema', '{"texto":"Perrengues de trabalho"}'),
  ('duas-verdades', 'tema', '{"texto":"Esportes que você já tentou"}'),
  ('duas-verdades', 'tema', '{"texto":"Famosos que você já viu de perto"}'),
  ('duas-verdades', 'tema', '{"texto":"Coisas que você nunca fez"}'),
  ('duas-verdades', 'tema', '{"texto":"Machucados e idas ao hospital"}'),
  ('duas-verdades', 'tema', '{"texto":"Shows e festas"}'),
  ('duas-verdades', 'tema', '{"texto":"Animais de estimação"}'),
  ('duas-verdades', 'tema', '{"texto":"Habilidades bem inúteis"}'),
  ('duas-verdades', 'tema', '{"texto":"Vergonhas alheias"}'),
  ('duas-verdades', 'tema', '{"texto":"Recordes pessoais bobos"}'),
  ('duas-verdades', 'tema', '{"texto":"Tema livre — invente à vontade"}');

-- ------------------------------------------ Verdade ou Desafio: modo leve

insert into cartas (jogo, tipo, conteudo, adulto) values
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi a maior mentira que você já contou?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual o mico mais recente que você pagou?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual música você ouve escondido do grupo?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi a última coisa que você pesquisou no celular?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual série você fingiu ter assistido só para participar da conversa?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual comida todo mundo ama e você acha superestimada?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi o presente mais sem graça que você já recebeu?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual talento você tem que quase ninguém sabe?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi a maior bobagem que você já comprou por impulso?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual apelido de infância você preferia esquecer?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual matéria da escola você odiava de verdade?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Que hábito seu ninguém aqui imagina que você tem?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi a desculpa mais criativa que você já deu para não sair?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual sonho estranho você lembra até hoje?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi o pior corte de cabelo da sua vida?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Que trend da internet você já tentou copiar?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi a viagem mais marcante que você já fez?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual coisa simples te deixa feliz na hora?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual medo bobo você ainda tem?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi o elogio mais legal que já te fizeram?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Se pudesse mandar um recado para você de 10 anos atrás, qual seria?"}', false),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi a última promessa que você fez para si e não cumpriu?"}', false);

insert into cartas (jogo, tipo, conteudo, adulto) values
  ('verdade-ou-desafio', 'desafio', '{"texto":"Cante o refrão da última música que você ouviu."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Imite alguém do grupo até adivinharem quem é."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Faça 10 polichinelos contando em voz alta."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Fale só cantando até a sua próxima vez."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Mostre a última foto da sua galeria — você escolhe qual pular."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Faça uma pose de estátua por 30 segundos."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Dance 15 segundos sem música nenhuma."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Conte uma piada e aguente o silêncio se ninguém rir."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Faça um comercial de 20 segundos para um objeto que estiver por perto."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Fale com sotaque de outra região até o fim da rodada."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Imite o som de três animais e deixe o grupo adivinhar."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Invente um nome artístico para cada pessoa do grupo."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Ande pela sala imitando um robô até a sua próxima vez."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Faça uma narração esportiva do que está acontecendo agora."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Diga um elogio sincero para cada pessoa da roda."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Fale uma frase inteira sem usar a letra A."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Repita um trava-língua três vezes seguidas sem errar."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Imite a pessoa à sua direita atendendo o telefone."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Conte uma história de 30 segundos que termine com \"e foi aí que tudo mudou\"."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Escolha alguém do grupo para ser seu eco por uma rodada."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Reencene a sua reação ao acordar de manhã."}', false),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Faça uma pose para uma foto e deixe o grupo escolher a legenda."}', false);

-- ---------------------------------------- Verdade ou Desafio: pacote +18
--
-- Tom: picante, divertido e consensual. Sem conteúdo explícito, sem humilhar
-- ninguém, sem envolver quem não está na roda e sem nada ilegal. Toda carta
-- pode ser pulada sem justificativa (botão "Não me sinto confortável").

insert into cartas (jogo, tipo, conteudo, adulto) values
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi a sua primeira impressão sobre alguém desta sala?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual é uma qualidade que você acha mais atraente em alguém?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi o encontro mais inusitado que você já teve?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual detalhe bobo faz você reparar em alguém na hora?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi a cantada mais sem noção que já te fizeram?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi a cantada mais sem noção que VOCÊ já fez?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual música te deixa no clima em qualquer situação?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Você já mandou mensagem para a pessoa errada? Como se salvou?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi o flerte mais óbvio que você não percebeu na hora?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Que tipo de encontro você acha realmente romântico?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi o maior perrengue que você passou tentando impressionar alguém?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual sinal você dá quando está interessado em alguém?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi a coisa mais romântica que já fizeram por você?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Você prefere ser conquistado com conversa, comida ou surpresa?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual apelido carinhoso você acha insuportável?"}', true),
  ('verdade-ou-desafio', 'verdade', '{"texto":"Qual foi o beijo mais inesperado da sua vida? (sem nomes, se preferir)"}', true);

insert into cartas (jogo, tipo, conteudo, adulto) values
  ('verdade-ou-desafio', 'desafio', '{"texto":"Faça um elogio sincero e respeitoso para uma pessoa da roda."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Escolha alguém para uma dança de 20 segundos, se a pessoa aceitar."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Mande um áudio cantando um trecho romântico para o grupo ouvir."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Faça sua melhor cara de conquista e mantenha por 10 segundos."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Dê uma cantada — a mais brega possível — em alguém que aceitar participar."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Descreva o encontro perfeito em 30 segundos, sem gaguejar."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Imite o jeito que você flerta quando está nervoso."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Escolha uma pessoa da roda e diga uma qualidade que você admira nela."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Conte um plano de conquista digno de novela para o grupo aprovar ou vaiar."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Faça uma serenata improvisada de 15 segundos para quem estiver à sua esquerda, se topar."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Declame um poema romântico inventado na hora."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Dê uma nota de 0 a 10 para a sua própria habilidade de flerte e justifique."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Mostre a última música romântica que você ouviu, se não for vergonha demais."}', true),
  ('verdade-ou-desafio', 'desafio', '{"texto":"Convença o grupo, em 20 segundos, de que você é um ótimo par."}', true);

-- ----------------------------------------------- Cara a Cara: personagens
--
-- Ilustrações geradas no próprio app a partir destes atributos (src/lib/avatar.ts).
-- São personagens inventados: nenhuma pessoa real, nenhuma imagem de terceiros.

insert into cartas (jogo, tipo, conteudo) values
  ('cara-a-cara','personagem','{"nome":"Alma","cabelo":"preto","estilo_cabelo":"longo","oculos":false,"chapeu":false,"barba":false,"camiseta":"roxo","acessorio":"brinco","pele":"morena"}'),
  ('cara-a-cara','personagem','{"nome":"Bento","cabelo":"castanho","estilo_cabelo":"curto","oculos":true,"chapeu":false,"barba":true,"camiseta":"azul","acessorio":"nenhum","pele":"clara"}'),
  ('cara-a-cara','personagem','{"nome":"Célia","cabelo":"ruivo","estilo_cabelo":"cacheado","oculos":true,"chapeu":false,"barba":false,"camiseta":"amarelo","acessorio":"colar","pele":"clara"}'),
  ('cara-a-cara','personagem','{"nome":"Dário","cabelo":"preto","estilo_cabelo":"curto","oculos":false,"chapeu":true,"barba":true,"camiseta":"verde","acessorio":"nenhum","pele":"negra"}'),
  ('cara-a-cara','personagem','{"nome":"Elis","cabelo":"loiro","estilo_cabelo":"longo","oculos":false,"chapeu":false,"barba":false,"camiseta":"rosa","acessorio":"colar","pele":"clara"}'),
  ('cara-a-cara','personagem','{"nome":"Fábio","cabelo":"grisalho","estilo_cabelo":"curto","oculos":true,"chapeu":false,"barba":true,"camiseta":"cinza","acessorio":"nenhum","pele":"clara"}'),
  ('cara-a-cara','personagem','{"nome":"Gina","cabelo":"castanho","estilo_cabelo":"cacheado","oculos":false,"chapeu":true,"barba":false,"camiseta":"laranja","acessorio":"brinco","pele":"morena"}'),
  ('cara-a-cara','personagem','{"nome":"Hugo","cabelo":"careca","estilo_cabelo":"careca","oculos":true,"chapeu":false,"barba":false,"camiseta":"azul","acessorio":"cachecol","pele":"clara"}'),
  ('cara-a-cara','personagem','{"nome":"Íris","cabelo":"preto","estilo_cabelo":"cacheado","oculos":true,"chapeu":false,"barba":false,"camiseta":"verde","acessorio":"nenhum","pele":"negra"}'),
  ('cara-a-cara','personagem','{"nome":"Jonas","cabelo":"loiro","estilo_cabelo":"curto","oculos":false,"chapeu":true,"barba":false,"camiseta":"vermelho","acessorio":"nenhum","pele":"clara"}'),
  ('cara-a-cara','personagem','{"nome":"Kátia","cabelo":"ruivo","estilo_cabelo":"longo","oculos":false,"chapeu":false,"barba":false,"camiseta":"roxo","acessorio":"cachecol","pele":"clara"}'),
  ('cara-a-cara','personagem','{"nome":"Lucas","cabelo":"castanho","estilo_cabelo":"curto","oculos":true,"chapeu":true,"barba":true,"camiseta":"amarelo","acessorio":"nenhum","pele":"morena"}'),
  ('cara-a-cara','personagem','{"nome":"Malu","cabelo":"preto","estilo_cabelo":"longo","oculos":true,"chapeu":false,"barba":false,"camiseta":"rosa","acessorio":"brinco","pele":"negra"}'),
  ('cara-a-cara','personagem','{"nome":"Nico","cabelo":"grisalho","estilo_cabelo":"curto","oculos":false,"chapeu":false,"barba":true,"camiseta":"azul","acessorio":"colar","pele":"morena"}'),
  ('cara-a-cara','personagem','{"nome":"Olga","cabelo":"grisalho","estilo_cabelo":"cacheado","oculos":true,"chapeu":false,"barba":false,"camiseta":"verde","acessorio":"colar","pele":"clara"}'),
  ('cara-a-cara','personagem','{"nome":"Paulo","cabelo":"careca","estilo_cabelo":"careca","oculos":false,"chapeu":false,"barba":true,"camiseta":"cinza","acessorio":"nenhum","pele":"negra"}'),
  ('cara-a-cara','personagem','{"nome":"Quenia","cabelo":"castanho","estilo_cabelo":"longo","oculos":false,"chapeu":true,"barba":false,"camiseta":"laranja","acessorio":"colar","pele":"morena"}'),
  ('cara-a-cara','personagem','{"nome":"Rui","cabelo":"preto","estilo_cabelo":"curto","oculos":true,"chapeu":false,"barba":false,"camiseta":"vermelho","acessorio":"cachecol","pele":"clara"}'),
  ('cara-a-cara','personagem','{"nome":"Sara","cabelo":"loiro","estilo_cabelo":"cacheado","oculos":true,"chapeu":false,"barba":false,"camiseta":"azul","acessorio":"nenhum","pele":"clara"}'),
  ('cara-a-cara','personagem','{"nome":"Tiago","cabelo":"ruivo","estilo_cabelo":"curto","oculos":false,"chapeu":false,"barba":true,"camiseta":"roxo","acessorio":"brinco","pele":"clara"}'),
  ('cara-a-cara','personagem','{"nome":"Ubi","cabelo":"careca","estilo_cabelo":"careca","oculos":true,"chapeu":true,"barba":false,"camiseta":"amarelo","acessorio":"nenhum","pele":"morena"}'),
  ('cara-a-cara','personagem','{"nome":"Vera","cabelo":"preto","estilo_cabelo":"cacheado","oculos":false,"chapeu":false,"barba":false,"camiseta":"rosa","acessorio":"cachecol","pele":"negra"}'),
  ('cara-a-cara','personagem','{"nome":"Wilson","cabelo":"castanho","estilo_cabelo":"curto","oculos":false,"chapeu":false,"barba":false,"camiseta":"verde","acessorio":"nenhum","pele":"clara"}'),
  ('cara-a-cara','personagem','{"nome":"Zuma","cabelo":"loiro","estilo_cabelo":"longo","oculos":false,"chapeu":true,"barba":false,"camiseta":"cinza","acessorio":"brinco","pele":"morena"}');
