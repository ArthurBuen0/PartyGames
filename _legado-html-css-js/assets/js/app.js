/**
 * Sorteia Aí — lógica do app.
 *
 * Tudo em JavaScript puro, sem build e sem backend. As três telas (início,
 * lista e jogo) vivem no mesmo HTML e a navegação é pelo hash da URL:
 *
 *   #/inicio            tela inicial
 *   #/jogos             lista de jogos
 *   #/jogo/mimica       tela individual de um jogo
 *
 * O código da sala fica na query (?sala=ABCD) e serve de semente do sorteio:
 * duas pessoas na mesma sala, na mesma rodada, veem exatamente a mesma carta.
 * É o que permite "jogar pelo link" sem servidor nenhum.
 */

(function () {
  "use strict";

  /* ==================================================== 1. Atalhos e util */

  const $ = (seletor, raiz) => (raiz || document).querySelector(seletor);
  const $$ = (seletor, raiz) => Array.from((raiz || document).querySelectorAll(seletor));

  /** Escapa texto antes de jogar em innerHTML (nomes vêm do usuário). */
  function esc(texto) {
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const armazem = {
    ler(chave, padrao) {
      try {
        const bruto = localStorage.getItem(chave);
        return bruto === null ? padrao : JSON.parse(bruto);
      } catch (erro) {
        return padrao;
      }
    },
    gravar(chave, valor) {
      try {
        localStorage.setItem(chave, JSON.stringify(valor));
      } catch (erro) {
        /* modo privado ou armazenamento cheio: o app segue funcionando */
      }
    }
  };

  let tempoAviso = null;
  function avisar(mensagem) {
    const caixa = $("#aviso");
    caixa.textContent = mensagem;
    caixa.classList.add("visivel");
    clearTimeout(tempoAviso);
    tempoAviso = setTimeout(() => caixa.classList.remove("visivel"), 2600);
  }

  function vibrar(padrao) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(padrao);
      } catch (erro) {
        /* alguns navegadores bloqueiam sem gesto do usuário */
      }
    }
  }

  /* ====================================== 2. Sorteio com semente (sala) */

  /** Hash simples e estável de string para inteiro de 32 bits. */
  function semente(texto) {
    let h = 2166136261;
    for (let i = 0; i < texto.length; i += 1) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** PRNG determinístico: mesma semente, mesma sequência. */
  function gerador(sementeInicial) {
    let a = sementeInicial >>> 0;
    return function () {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const cacheBaralhos = new Map();

  /**
   * Embaralha os índices de uma lista de forma determinística (Fisher-Yates
   * com semente). Percorrer a ordem embaralhada evita repetir carta antes de
   * o baralho acabar — e todo mundo na mesma sala vê a mesma ordem.
   */
  function ordemDoBaralho(tamanho, chave) {
    const cacheId = chave + "#" + tamanho;
    if (cacheBaralhos.has(cacheId)) return cacheBaralhos.get(cacheId);

    const indices = Array.from({ length: tamanho }, (_, i) => i);
    const proximo = gerador(semente(chave));
    for (let i = tamanho - 1; i > 0; i -= 1) {
      const j = Math.floor(proximo() * (i + 1));
      const troca = indices[i];
      indices[i] = indices[j];
      indices[j] = troca;
    }

    cacheBaralhos.set(cacheId, indices);
    return indices;
  }

  /** Pega a n-ésima carta do baralho embaralhado daquela sala. */
  function cartaDoBaralho(lista, chave, posicao) {
    if (!lista || lista.length === 0) return null;
    const ordem = ordemDoBaralho(lista.length, estado.sala + "|" + chave);
    return lista[ordem[Math.abs(posicao) % lista.length]];
  }

  /* ============================================== 3. Estado da aplicação */

  const CHAVE_ESTADO = "sorteia-ai:jogos";
  const CHAVE_PARTICIPANTES = "sorteia-ai:participantes";

  const estado = {
    sala: "",
    rota: { tela: "inicio", jogoId: null },
    jogos: armazem.ler(CHAVE_ESTADO, {}),
    participantes: armazem.ler(CHAVE_PARTICIPANTES, [])
  };

  /** Estado de um jogo: em que rodada está e quantas cartas já passaram. */
  function estadoDoJogo(id) {
    if (!estado.jogos[id]) {
      estado.jogos[id] = { rodada: 1, passo: 0, modo: null, pontos: 0 };
    }
    const atual = estado.jogos[id];
    if (typeof atual.rodada !== "number") atual.rodada = 1;
    if (typeof atual.passo !== "number") atual.passo = 0;
    return atual;
  }

  function salvarEstado() {
    armazem.gravar(CHAVE_ESTADO, estado.jogos);
  }

  function jogoPorId(id) {
    return JOGOS.find((jogo) => jogo.id === id) || null;
  }

  /* ========================================================= 4. A sala */

  const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I, O, 0 e 1

  function novoCodigo() {
    let codigo = "";
    for (let i = 0; i < 4; i += 1) {
      codigo += LETRAS[Math.floor(Math.random() * LETRAS.length)];
    }
    return codigo;
  }

  /** Lê a sala da URL; se não houver, cria uma e guarda na URL sem recarregar. */
  function iniciarSala() {
    const parametros = new URLSearchParams(location.search);
    const daUrl = (parametros.get("sala") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (daUrl.length >= 3) {
      estado.sala = daUrl.slice(0, 8);
    } else {
      estado.sala = armazem.ler("sorteia-ai:sala", "") || novoCodigo();
      parametros.set("sala", estado.sala);
      history.replaceState(null, "", location.pathname + "?" + parametros.toString() + location.hash);
    }

    armazem.gravar("sorteia-ai:sala", estado.sala);
  }

  function linkDaSala() {
    const url = new URL(location.href);
    url.searchParams.set("sala", estado.sala);
    return url.toString();
  }

  async function compartilharSala(nomeDoJogo) {
    const link = linkDaSala();
    const texto = nomeDoJogo
      ? "Bora jogar " + nomeDoJogo + " no Sorteia Aí! Sala " + estado.sala
      : "Bora jogar no Sorteia Aí! Sala " + estado.sala;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Sorteia Aí", text: texto, url: link });
        return;
      } catch (erro) {
        if (erro && erro.name === "AbortError") return; // usuário desistiu
      }
    }

    try {
      await navigator.clipboard.writeText(link);
      avisar("Link da sala copiado! 🔗");
    } catch (erro) {
      window.prompt("Copie o link da sala:", link);
    }
  }

  /* ====================================================== 5. Navegação */

  function irPara(tela, jogoId) {
    const destino = tela === "jogo" ? "#/jogo/" + jogoId : "#/" + tela;
    if (location.hash === destino) {
      aplicarRota();
      return;
    }
    location.hash = destino;
  }

  function lerRota() {
    const bruto = (location.hash || "").replace(/^#\/?/, "");
    const partes = bruto.split("/").filter(Boolean);

    if (partes[0] === "jogo" && partes[1] && jogoPorId(partes[1])) {
      return { tela: "jogo", jogoId: partes[1] };
    }
    if (partes[0] === "jogos") return { tela: "jogos", jogoId: null };
    return { tela: "inicio", jogoId: null };
  }

  function aplicarRota() {
    const rota = lerRota();
    estado.rota = rota;

    pararCronometro();

    $$(".tela").forEach((secao) => {
      secao.hidden = true;
    });

    if (rota.tela === "jogo") {
      montarTelaDoJogo(jogoPorId(rota.jogoId));
      $("#tela-jogo").hidden = false;
    } else {
      $("#tela-" + rota.tela).hidden = false;
    }

    // Marca o item ativo nas duas navegações
    const ativo = rota.tela === "inicio" ? "inicio" : "jogos";
    $$("[data-ir]").forEach((botao) => {
      if (botao.dataset.ir === ativo) botao.setAttribute("aria-current", "page");
      else botao.removeAttribute("aria-current");
    });

    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    focarTitulo();
  }

  /** Depois de trocar de tela, joga o foco no título para quem usa teclado/leitor. */
  function focarTitulo() {
    const visivel = $$(".tela").find((secao) => !secao.hidden);
    if (!visivel) return;
    const titulo = $("h1, h2", visivel);
    if (!titulo) return;
    titulo.setAttribute("tabindex", "-1");
    titulo.focus({ preventScroll: true });
  }

  /* ================================================ 6. Lista de jogos */

  function montarListaDeJogos() {
    const grade = $("#grade-jogos");
    grade.innerHTML = "";

    JOGOS.forEach((jogo) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card-jogo";
      card.dataset.cor = jogo.cor;
      card.setAttribute("aria-label", "Abrir " + jogo.nome);
      card.innerHTML =
        '<div class="card-jogo__topo">' +
        '<span class="card-jogo__emoji" aria-hidden="true">' + jogo.emoji + "</span>" +
        '<h3 class="card-jogo__titulo">' + esc(jogo.nome) + "</h3>" +
        "</div>" +
        '<p class="card-jogo__resumo">' + esc(jogo.resumo) + "</p>" +
        '<div class="card-jogo__rodape">' +
        '<span class="etiqueta">👥 ' + esc(jogo.jogadores) + "</span>" +
        '<span class="etiqueta">⏱️ ' + esc(jogo.duracao) + "</span>" +
        '<span class="card-jogo__seta" aria-hidden="true">→</span>' +
        "</div>";

      card.addEventListener("click", () => irPara("jogo", jogo.id));
      grade.appendChild(card);
    });

    // Card extra que dispara o sorteio
    const sortear = document.createElement("button");
    sortear.type = "button";
    sortear.className = "card-sortear";
    sortear.innerHTML =
      '<span class="card-sortear__dado" aria-hidden="true">🎲</span>' +
      "<h3>Não sabe qual escolher?</h3>" +
      '<p class="card-jogo__resumo">Deixa com a gente: o dado escolhe um jogo para a turma.</p>' +
      '<span class="botao botao--principal">Sortear jogo</span>';
    sortear.addEventListener("click", abrirSorteio);
    grade.appendChild(sortear);
  }

  /* ============================================= 7. Tela de cada jogo */

  let cronometro = null; // { intervalo, restante, estado }

  function montarTelaDoJogo(jogo) {
    if (!jogo) {
      irPara("jogos");
      return;
    }

    const alvo = $("#conteudo-jogo");
    const dados = estadoDoJogo(jogo.id);

    alvo.dataset.cor = jogo.cor;
    alvo.innerHTML =
      '<div class="jogo-topo">' +
      '<button class="botao botao--fantasma" type="button" id="voltar-lista">' +
      '<span aria-hidden="true">←</span> Voltar para os jogos' +
      "</button>" +
      '<div class="jogo-identidade">' +
      '<span class="jogo-identidade__emoji" aria-hidden="true">' + jogo.emoji + "</span>" +
      "<div>" +
      '<h1 id="titulo-jogo">' + esc(jogo.nome) + "</h1>" +
      '<p class="etiqueta etiqueta--destaque">👥 ' + esc(jogo.jogadores) +
      " · ⏱️ " + esc(jogo.duracao) + "</p>" +
      "</div>" +
      "</div>" +
      '<p class="jogo-descricao">' + esc(jogo.descricao) + "</p>" +
      "</div>" +

      '<div class="jogo-corpo">' +
      '<section class="painel" aria-labelledby="titulo-painel">' +
      '<div class="painel__cabecalho">' +
      '<h2 class="cartao__titulo" id="titulo-painel">Rodada em andamento</h2>' +
      '<span class="contador-rodada" id="contador-rodada">Rodada ' + dados.rodada + "</span>" +
      "</div>" +
      '<div id="area-jogo" aria-live="polite"></div>' +
      '<div class="painel__acoes">' +
      '<button class="botao botao--principal" type="button" id="novo-desafio">' +
      'Novo desafio' +
      "</button>" +
      '<button class="botao botao--secundario" type="button" id="proxima-rodada">' +
      'Próxima rodada <span aria-hidden="true">→</span>' +
      "</button>" +
      "</div>" +
      "</section>" +

      '<aside class="lateral">' +
      '<section class="cartao" aria-labelledby="titulo-regras">' +
      '<h2 class="cartao__titulo" id="titulo-regras"><span aria-hidden="true">📋</span> Como jogar</h2>' +
      '<ol class="lista-regras">' +
      jogo.regras.map((regra) => "<li>" + esc(regra) + "</li>").join("") +
      "</ol>" +
      "</section>" +

      '<section class="cartao cartao--dica" aria-labelledby="titulo-dica">' +
      '<h2 class="cartao__titulo" id="titulo-dica"><span aria-hidden="true">💡</span> Dica da casa</h2>' +
      "<p>" + esc(jogo.dica) + "</p>" +
      "</section>" +

      '<section class="cartao cartao--sala" aria-labelledby="titulo-sala">' +
      '<h2 class="cartao__titulo" id="titulo-sala"><span aria-hidden="true">📱</span> Todo mundo junto</h2>' +
      '<div class="dica-sala">' +
      "<p>Podem acompanhar tudo <strong>no mesmo celular</strong>, no meio da roda, ou cada " +
      "um na sua tela pelo <strong>link da sala</strong> — na mesma rodada, a carta é a mesma " +
      "para todo mundo.</p>" +
      '<span class="codigo-sala"><span aria-hidden="true">🔑</span> Sala ' + esc(estado.sala) + "</span>" +
      '<button class="botao botao--secundario botao--largo" type="button" id="compartilhar-sala">' +
      '<span class="botao__emoji" aria-hidden="true">🔗</span> Compartilhar link da sala' +
      "</button>" +
      "</div>" +
      "</section>" +
      "</aside>" +
      "</div>" +

      '<footer class="rodape"><p>Boa rodada! 🎉</p></footer>';

    $("#voltar-lista").addEventListener("click", () => irPara("jogos"));
    $("#compartilhar-sala").addEventListener("click", () => compartilharSala(jogo.nome));

    $("#novo-desafio").addEventListener("click", () => {
      dados.passo += 1;
      salvarEstado();
      desenharPainel(jogo, true);
      vibrar(12);
    });

    $("#proxima-rodada").addEventListener("click", () => {
      dados.rodada += 1;
      dados.passo += 1;
      dados.modo = null;
      salvarEstado();
      desenharPainel(jogo, true);
      avisar("Rodada " + dados.rodada + "! Passa a vez 👉");
      vibrar([12, 60, 12]);
    });

    desenharPainel(jogo, false);
  }

  /** Redesenha só a área de jogo, de acordo com o painel do jogo. */
  function desenharPainel(jogo, animar) {
    const area = $("#area-jogo");
    const dados = estadoDoJogo(jogo.id);

    pararCronometro();
    $("#contador-rodada").textContent = "Rodada " + dados.rodada;

    const construtor = PAINEIS[jogo.painel] || PAINEIS.corrente;
    construtor(area, jogo, dados);

    if (animar) {
      const carta = $(".carta-desafio, .carta-segredo, .cronometro", area);
      if (carta) {
        carta.classList.remove("trocou");
        void carta.offsetWidth; // reinicia a animação
        carta.classList.add("trocou");
      }
    }
  }

  /* ---------------------------------------------------- Os seis painéis */

  const PAINEIS = {
    /* C, S, Composto — sorteia a categoria e lembra a ordem das palavras */
    sequencia(area, jogo, dados) {
      const categoria = cartaDoBaralho(jogo.baralho, jogo.id, dados.passo);

      area.innerHTML =
        '<div class="carta-desafio">' +
        '<span class="carta-desafio__rotulo">Categoria da rodada</span>' +
        '<strong class="carta-desafio__valor">' + esc(categoria) + "</strong>" +
        '<p class="carta-desafio__nota">Todas as palavras precisam caber nesta categoria.</p>' +
        "</div>" +
        '<div class="sequencia">' +
        '<div class="sequencia__passo"><span class="sequencia__letra">C</span>' +
        '<span class="sequencia__texto">Começa com C</span></div>' +
        '<div class="sequencia__passo"><span class="sequencia__letra">S</span>' +
        '<span class="sequencia__texto">Começa com S</span></div>' +
        '<div class="sequencia__passo"><span class="sequencia__letra" aria-hidden="true">＋</span>' +
        '<span class="sequencia__texto">Palavra composta</span></div>' +
        "</div>";
    },

    /* Palavra Parecida — sorteia a palavra que abre a corrente */
    corrente(area, jogo, dados) {
      const palavra = cartaDoBaralho(jogo.baralho, jogo.id, dados.passo);

      area.innerHTML =
        '<div class="carta-desafio">' +
        '<span class="carta-desafio__rotulo">Palavra de partida</span>' +
        '<strong class="carta-desafio__valor">' + esc(palavra) + "</strong>" +
        '<p class="carta-desafio__nota">A próxima pessoa fala algo ligado a esta palavra — e a ' +
        "corrente segue até alguém travar.</p>" +
        "</div>";
    },

    /* Quem Sou Eu? — carta virada, só revela quando o grupo pedir */
    identidade(area, jogo, dados) {
      const carta = cartaDoBaralho(jogo.baralho, jogo.id, dados.passo);

      area.innerHTML =
        '<div class="carta-segredo" id="carta-identidade" data-revelada="false">' +
        '<div class="carta-segredo__aviso">' +
        '<span aria-hidden="true">🙈</span>' +
        "<p>Identidade sorteada!<br />Quem está adivinhando <strong>não pode olhar</strong>.</p>" +
        "</div>" +
        "</div>" +
        '<button class="botao botao--amarelo botao--largo" type="button" id="revelar-identidade">' +
        '<span class="botao__emoji" aria-hidden="true">👀</span> Mostrar para o grupo' +
        "</button>";

      const caixa = $("#carta-identidade", area);
      const botao = $("#revelar-identidade", area);

      botao.addEventListener("click", () => {
        const revelada = caixa.dataset.revelada === "true";

        if (revelada) {
          caixa.dataset.revelada = "false";
          caixa.innerHTML =
            '<div class="carta-segredo__aviso"><span aria-hidden="true">🙈</span>' +
            "<p>Identidade escondida de novo.</p></div>";
          botao.innerHTML =
            '<span class="botao__emoji" aria-hidden="true">👀</span> Mostrar para o grupo';
          return;
        }

        caixa.dataset.revelada = "true";
        caixa.innerHTML =
          '<div class="carta-desafio" style="background:none;border:0;padding:0">' +
          '<span class="carta-desafio__rotulo">Quem é</span>' +
          '<strong class="carta-desafio__valor">' + esc(carta.nome) + "</strong>" +
          '<p class="carta-desafio__nota">Dica para o grupo: ' + esc(carta.dica) + "</p>" +
          "</div>";
        botao.innerHTML = '<span class="botao__emoji" aria-hidden="true">🙈</span> Esconder';
      });
    },

    /* Mímica — palavra secreta + cronômetro de 60 segundos */
    cronometro(area, jogo, dados) {
      const palavra = cartaDoBaralho(jogo.baralho, jogo.id, dados.passo);
      const pontos = dados.pontos || 0;

      area.innerHTML =
        '<div class="carta-segredo" id="carta-mimica" data-revelada="false">' +
        '<div class="carta-segredo__aviso">' +
        '<span aria-hidden="true">🤫</span>' +
        "<p>Só quem vai fazer a mímica pode ver.<br />O resto do grupo desvia o olhar!</p>" +
        "</div>" +
        "</div>" +
        '<button class="botao botao--secundario botao--largo" type="button" id="ver-palavra">' +
        '<span class="botao__emoji" aria-hidden="true">👁️</span> Ver a palavra secreta' +
        "</button>" +

        '<div class="cronometro" id="cronometro" data-estado="parado">' +
        '<div class="cronometro__anel">' +
        '<svg viewBox="0 0 120 120" aria-hidden="true">' +
        '<circle class="cronometro__trilha" cx="60" cy="60" r="54"></circle>' +
        '<circle class="cronometro__progresso" id="anel-progresso" cx="60" cy="60" r="54"' +
        ' stroke-dasharray="339.292" stroke-dashoffset="0"></circle>' +
        "</svg>" +
        '<span class="cronometro__numero" id="cronometro-numero" role="timer" aria-live="off">60</span>' +
        "</div>" +
        '<div class="painel__acoes" style="width:100%">' +
        '<button class="botao botao--principal" type="button" id="cronometro-acao">' +
        'Começar 60s' +
        "</button>" +
        '<button class="botao botao--secundario" type="button" id="cronometro-zerar">' +
        'Zerar' +
        "</button>" +
        "</div>" +
        '<div class="placar">' +
        '<button class="placar__botao" type="button" id="ponto-menos" aria-label="Tirar um ponto">−</button>' +
        '<span>Acertos: <span class="placar__valor" id="placar-valor">' + pontos + "</span></span>" +
        '<button class="placar__botao" type="button" id="ponto-mais" aria-label="Marcar um acerto">+</button>' +
        "</div>" +
        "</div>";

      const caixa = $("#carta-mimica", area);
      const botaoVer = $("#ver-palavra", area);

      botaoVer.addEventListener("click", () => {
        const revelada = caixa.dataset.revelada === "true";
        if (revelada) {
          caixa.dataset.revelada = "false";
          caixa.innerHTML =
            '<div class="carta-segredo__aviso"><span aria-hidden="true">🤫</span>' +
            "<p>Palavra escondida.</p></div>";
          botaoVer.innerHTML =
            '<span class="botao__emoji" aria-hidden="true">👁️</span> Ver a palavra secreta';
          return;
        }
        caixa.dataset.revelada = "true";
        caixa.innerHTML =
          '<div class="carta-desafio" style="background:none;border:0;padding:0">' +
          '<span class="carta-desafio__rotulo">Represente</span>' +
          '<strong class="carta-desafio__valor">' + esc(palavra) + "</strong>" +
          '<p class="carta-desafio__nota">Sem falar, sem escrever, sem apontar letras.</p>' +
          "</div>";
        botaoVer.innerHTML = '<span class="botao__emoji" aria-hidden="true">🙈</span> Esconder palavra';
      });

      prepararCronometro(jogo);
    },

    /* Verdade ou Desafio — o jogador escolhe o lado e o app sorteia */
    escolha(area, jogo, dados) {
      const modo = dados.modo;

      if (!modo) {
        area.innerHTML =
          '<div class="carta-desafio">' +
          '<span class="carta-desafio__rotulo">Sua vez</span>' +
          '<strong class="carta-desafio__valor">Verdade ou desafio?</strong>' +
          '<p class="carta-desafio__nota">Escolha um lado — o app sorteia o resto.</p>' +
          "</div>" +
          '<div class="escolha-dupla">' +
          '<button class="botao botao--principal" type="button" data-modo="verdade">' +
          "Verdade<small>Responda com honestidade</small></button>" +
          '<button class="botao botao--rosa" type="button" data-modo="desafio">' +
          "Desafio<small>Cumpra a missão</small></button>" +
          "</div>";

        $$("[data-modo]", area).forEach((botao) => {
          botao.addEventListener("click", () => {
            dados.modo = botao.dataset.modo;
            dados.passo += 1;
            salvarEstado();
            desenharPainel(jogo, true);
            vibrar(12);
          });
        });
        return;
      }

      const lista = modo === "verdade" ? jogo.baralho.verdade : jogo.baralho.desafio;
      const carta = cartaDoBaralho(lista, jogo.id + ":" + modo, dados.passo);
      const rotulo = modo === "verdade" ? "Verdade" : "Desafio";
      const emoji = modo === "verdade" ? "💬" : "🔥";

      area.innerHTML =
        '<div class="carta-desafio">' +
        '<span class="carta-desafio__rotulo">' + emoji + " " + rotulo + "</span>" +
        '<strong class="carta-desafio__valor carta-desafio__valor--frase">' + esc(carta) + "</strong>" +
        '<p class="carta-desafio__nota">Não curtiu? Qualquer pessoa pode pedir para trocar, sem ' +
        "precisar explicar.</p>" +
        "</div>" +
        '<button class="botao botao--secundario botao--largo" type="button" id="trocar-lado">' +
        "<span class=\"botao__emoji\" aria-hidden=\"true\">🔀</span> Escolher o outro lado" +
        "</button>";

      $("#trocar-lado", area).addEventListener("click", () => {
        dados.modo = modo === "verdade" ? "desafio" : "verdade";
        dados.passo += 1;
        salvarEstado();
        desenharPainel(jogo, true);
      });
    },

    /* Duas Verdades e Uma Mentira — sorteia quem fala e sugere um tema */
    jogador(area, jogo, dados) {
      const tema = cartaDoBaralho(jogo.baralho, jogo.id, dados.passo);
      const pessoas = estado.participantes;
      const daVez = pessoas.length
        ? cartaDoBaralho(pessoas, jogo.id + ":pessoas:" + pessoas.length, dados.passo)
        : null;

      area.innerHTML =
        '<div class="carta-desafio">' +
        '<span class="carta-desafio__rotulo">Quem fala agora</span>' +
        '<strong class="carta-desafio__valor">' +
        (daVez ? esc(daVez) : "Sorteie um jogador") +
        "</strong>" +
        '<p class="carta-desafio__nota">Tema sugerido: <strong>' + esc(tema) + "</strong></p>" +
        "</div>" +
        (pessoas.length
          ? ""
          : '<p class="aviso-vazio">Adicione a galera abaixo para o app sortear de quem é a vez. ' +
            "Sem pressa: dá para jogar só com o tema.</p>") +
        '<div class="participantes">' +
        '<h3 class="cartao__titulo" style="font-size:1rem">' +
        '<span aria-hidden="true">👥</span> Quem está jogando</h3>' +
        '<form class="participantes__campo" id="form-participante">' +
        '<label class="apenas-leitor" for="campo-participante">Nome de quem está jogando</label>' +
        '<input class="campo-texto" id="campo-participante" name="nome" type="text" ' +
        'placeholder="Nome da pessoa" maxlength="24" autocomplete="off" />' +
        '<button class="botao botao--principal" type="submit">Adicionar</button>' +
        "</form>" +
        '<ul class="participantes__lista">' +
        pessoas
          .map(
            (nome) =>
              '<li class="participante" data-sorteado="' + (nome === daVez ? "true" : "false") + '">' +
              esc(nome) +
              '<button class="participante__remover" type="button" data-remover="' + esc(nome) +
              '" aria-label="Tirar ' + esc(nome) + ' da lista">×</button></li>'
          )
          .join("") +
        "</ul>" +
        "</div>";

      $("#form-participante", area).addEventListener("submit", (evento) => {
        evento.preventDefault();
        const campo = $("#campo-participante", area);
        const nome = campo.value.trim().slice(0, 24);

        if (!nome) return;
        if (estado.participantes.some((p) => p.toLowerCase() === nome.toLowerCase())) {
          avisar("Essa pessoa já está na lista 🙂");
          campo.value = "";
          return;
        }

        estado.participantes.push(nome);
        armazem.gravar(CHAVE_PARTICIPANTES, estado.participantes);
        desenharPainel(jogo, false);
        $("#campo-participante", $("#area-jogo")).focus();
      });

      $$("[data-remover]", area).forEach((botao) => {
        botao.addEventListener("click", () => {
          estado.participantes = estado.participantes.filter((n) => n !== botao.dataset.remover);
          armazem.gravar(CHAVE_PARTICIPANTES, estado.participantes);
          desenharPainel(jogo, false);
        });
      });
    }
  };

  /* ------------------------------------------------ Cronômetro da mímica */

  const DURACAO = 60;
  const CIRCUNFERENCIA = 339.292; // 2 * π * 54

  function pararCronometro() {
    if (cronometro && cronometro.intervalo) clearInterval(cronometro.intervalo);
    cronometro = null;
  }

  function prepararCronometro(jogo) {
    const caixa = $("#cronometro");
    if (!caixa) return;

    const numero = $("#cronometro-numero");
    const anel = $("#anel-progresso");
    const acao = $("#cronometro-acao");
    const zerar = $("#cronometro-zerar");
    const dados = estadoDoJogo(jogo.id);

    cronometro = { intervalo: null, restante: DURACAO, situacao: "parado" };

    function pintar() {
      numero.textContent = cronometro.restante;
      const fracao = 1 - cronometro.restante / DURACAO;
      anel.style.strokeDashoffset = String(-CIRCUNFERENCIA * fracao);
      caixa.dataset.estado = cronometro.situacao;
    }

    function rotularAcao(texto) {
      acao.textContent = texto;
    }

    function tocarFim() {
      vibrar([200, 100, 200]);
      try {
        const Contexto = window.AudioContext || window.webkitAudioContext;
        if (!Contexto) return;
        const contexto = new Contexto();
        const oscilador = contexto.createOscillator();
        const ganho = contexto.createGain();
        oscilador.type = "triangle";
        oscilador.frequency.value = 660;
        ganho.gain.setValueAtTime(0.001, contexto.currentTime);
        ganho.gain.exponentialRampToValueAtTime(0.25, contexto.currentTime + 0.02);
        ganho.gain.exponentialRampToValueAtTime(0.001, contexto.currentTime + 0.9);
        oscilador.connect(ganho).connect(contexto.destination);
        oscilador.start();
        oscilador.stop(contexto.currentTime + 0.95);
      } catch (erro) {
        /* som é bônus: se o navegador bloquear, o jogo segue */
      }
    }

    function tique() {
      cronometro.restante -= 1;

      if (cronometro.restante <= 0) {
        cronometro.restante = 0;
        clearInterval(cronometro.intervalo);
        cronometro.intervalo = null;
        cronometro.situacao = "acabou";
        pintar();
        rotularAcao("Começar de novo");
        numero.setAttribute("aria-live", "polite");
        avisar("Tempo esgotado! ⏰");
        tocarFim();
        return;
      }

      pintar();
    }

    function comecar() {
      if (cronometro.situacao === "acabou") cronometro.restante = DURACAO;
      cronometro.situacao = "correndo";
      pintar();
      rotularAcao("Pausar");
      cronometro.intervalo = setInterval(tique, 1000);
    }

    function pausar() {
      clearInterval(cronometro.intervalo);
      cronometro.intervalo = null;
      cronometro.situacao = "pausado";
      pintar();
      rotularAcao("Continuar");
    }

    acao.addEventListener("click", () => {
      if (cronometro.situacao === "correndo") pausar();
      else comecar();
      vibrar(12);
    });

    zerar.addEventListener("click", () => {
      clearInterval(cronometro.intervalo);
      cronometro.intervalo = null;
      cronometro.restante = DURACAO;
      cronometro.situacao = "parado";
      pintar();
      rotularAcao("Começar 60s");
    });

    // Placar de acertos
    const valor = $("#placar-valor");
    $("#ponto-mais").addEventListener("click", () => {
      dados.pontos = (dados.pontos || 0) + 1;
      valor.textContent = dados.pontos;
      salvarEstado();
      vibrar(12);
    });
    $("#ponto-menos").addEventListener("click", () => {
      dados.pontos = Math.max(0, (dados.pontos || 0) - 1);
      valor.textContent = dados.pontos;
      salvarEstado();
    });

    pintar();
  }

  /* ==================================================== 8. Sorteio geral */

  let sorteioEmAndamento = null;
  let jogoSorteado = null;
  let focoAnterior = null;

  function abrirSorteio() {
    const caixa = $("#sorteio");
    const frase = $("#sorteio-frase");
    const resultado = $("#sorteio-resultado");
    const acoes = $("#sorteio-acoes");

    focoAnterior = document.activeElement;
    caixa.hidden = false;
    caixa.dataset.fase = "rolando";
    resultado.hidden = true;
    acoes.hidden = true;
    vibrar(20);

    let passo = 0;
    frase.textContent = FRASES_SORTEIO[0];

    clearInterval(sorteioEmAndamento);
    sorteioEmAndamento = setInterval(() => {
      passo += 1;
      frase.textContent = FRASES_SORTEIO[passo % FRASES_SORTEIO.length];
    }, 420);

    setTimeout(() => {
      clearInterval(sorteioEmAndamento);
      jogoSorteado = JOGOS[Math.floor(Math.random() * JOGOS.length)];

      caixa.dataset.fase = "resultado";
      $("#sorteio-dado").textContent = jogoSorteado.emoji;
      frase.textContent = "O jogo da vez é…";
      $("#sorteio-nome").textContent = jogoSorteado.nome;
      $("#sorteio-resumo").textContent = jogoSorteado.resumo;
      resultado.hidden = false;
      acoes.hidden = false;
      $("#sorteio-jogar").focus();
      soltarConfete();
      vibrar([30, 60, 30]);
    }, 1500);
  }

  function fecharSorteio() {
    const caixa = $("#sorteio");
    clearInterval(sorteioEmAndamento);
    caixa.hidden = true;
    $("#sorteio-dado").textContent = "🎲";
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  }

  function soltarConfete() {
    const caixaSorteio = $(".sorteio__caixa");
    const menosMovimento =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (menosMovimento) return;

    const cores = ["#8b5cf6", "#ec4899", "#facc15", "#14b8a6", "#fb7185"];
    for (let i = 0; i < 26; i += 1) {
      const pedaco = document.createElement("span");
      pedaco.className = "confete";
      pedaco.style.left = Math.random() * 100 + "%";
      pedaco.style.background = cores[i % cores.length];
      pedaco.style.animationDelay = Math.random() * 0.4 + "s";
      pedaco.style.animationDuration = 1.2 + Math.random() * 0.9 + "s";
      caixaSorteio.appendChild(pedaco);
      setTimeout(() => pedaco.remove(), 2600);
    }
  }

  /* ================================================= 9. PWA e instalação */

  function registrarServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol === "file:") return; // precisa de http(s)

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* sem service worker o app continua funcionando, só não fica offline */
      });
    });
  }

  function prepararInstalacao() {
    let evento = null;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      evento = e;

      const acoes = $(".heroi__acoes");
      if (!acoes || $("#instalar-app")) return;

      const botao = document.createElement("button");
      botao.id = "instalar-app";
      botao.type = "button";
      botao.className = "botao botao--secundario botao--grande";
      botao.textContent = "Instalar app";
      botao.addEventListener("click", async () => {
        botao.disabled = true;
        evento.prompt();
        const escolha = await evento.userChoice;
        if (escolha.outcome === "accepted") {
          botao.remove();
          avisar("App instalado! 🎉");
        } else {
          botao.disabled = false;
        }
      });

      acoes.appendChild(botao);
    });

    window.addEventListener("appinstalled", () => {
      const botao = $("#instalar-app");
      if (botao) botao.remove();
    });
  }

  /* ========================================================= 10. Início */

  function ligarEventosGlobais() {
    // Navegação (topo, barra inferior e botões espalhados pelas telas)
    document.addEventListener("click", (evento) => {
      const irBotao = evento.target.closest("[data-ir]");
      if (irBotao) {
        irPara(irBotao.dataset.ir);
        return;
      }

      const sortearBotao = evento.target.closest("[data-sortear]");
      if (sortearBotao) abrirSorteio();
    });

    $("#sorteio-jogar").addEventListener("click", () => {
      const escolhido = jogoSorteado;
      fecharSorteio();
      if (escolhido) irPara("jogo", escolhido.id);
    });

    $("#sorteio-de-novo").addEventListener("click", abrirSorteio);

    // Clicar fora ou apertar Esc fecha o sorteio
    $("#sorteio").addEventListener("click", (evento) => {
      if (evento.target === $("#sorteio")) fecharSorteio();
    });

    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape" && !$("#sorteio").hidden) fecharSorteio();
    });

    window.addEventListener("hashchange", aplicarRota);

    // Sombra no cabeçalho depois que a página rola
    const cabecalho = $("#cabecalho");
    window.addEventListener(
      "scroll",
      () => cabecalho.classList.toggle("rolou", window.scrollY > 8),
      { passive: true }
    );
  }

  function iniciar() {
    iniciarSala();
    montarListaDeJogos();
    ligarEventosGlobais();
    aplicarRota();
    registrarServiceWorker();
    prepararInstalacao();

    // Atalho do sistema operacional (manifest): abre já sorteando
    if (new URLSearchParams(location.search).get("acao") === "sortear") {
      setTimeout(abrirSorteio, 350);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
