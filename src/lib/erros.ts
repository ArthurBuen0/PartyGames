/**
 * Tradução dos códigos que as funções do banco levantam.
 *
 * As RPCs falham com uma palavra em MAIÚSCULAS (03_funcoes.sql). Aqui isso
 * vira uma frase que a pessoa entende — nada de "P0001" na tela.
 */

const MENSAGENS: Record<string, string> = {
  SEM_SESSAO: "Não consegui iniciar sua sessão. Recarregue a página e tente de novo.",
  NAO_ESTA_NA_SALA: "Você não está mais nesta sala.",
  SO_O_ANFITRIAO: "Só quem criou a sala pode fazer isso.",
  SALA_NAO_ENCONTRADA: "Não achei nenhuma sala com esse código. Confira as letras.",
  SALA_ENCERRADA: "Essa sala já foi encerrada.",
  SALA_CHEIA: "Essa sala já está com 12 pessoas.",
  APELIDO_EM_USO: "Alguém na sala já está usando esse apelido. Escolha outro.",
  APELIDO_INVALIDO: "Escolha um apelido de 1 a 20 caracteres.",
  PARTICIPANTE_NAO_ENCONTRADO: "Essa pessoa não está mais na sala.",
  NAO_PODE_REMOVER_ANFITRIAO: "O anfitrião não pode ser removido.",
  POUCOS_JOGADORES: "Precisa de pelo menos 2 pessoas para começar.",
  SEM_PARTIDA: "Nenhuma partida em andamento.",
  RODADA_NAO_ENCONTRADA: "Essa rodada não existe mais.",
  RODADA_NAO_ESTA_ABERTA: "A rodada não está aceitando jogadas agora.",
  NAO_E_SUA_VEZ: "Calma, ainda não é a sua vez.",
  AINDA_TEM_TEMPO: "Ainda tem tempo no relógio.",
  TEMPO_ESGOTADO: "O tempo dessa vez já acabou.",
  SEM_ELIMINACAO_PENDENTE: "Não há ninguém para eliminar agora.",
  BARALHO_VAZIO: "Acabaram as cartas desse tipo.",
  RESPOSTA_INVALIDA: "Resposta inválida.",
  QUEM_PERGUNTA_NAO_RESPONDE: "Quem perguntou não pode responder.",
  PRECISA_TRES_FRASES: "Escreva exatamente três frases.",
  FRASE_VAZIA: "Todas as três frases precisam estar preenchidas.",
  INDICE_INVALIDO: "Escolha inválida.",
  AUTOR_NAO_VOTA: "Quem escreveu as frases não vota.",
  VOTACAO_FECHADA: "A votação já foi encerrada.",
  PALAVRA_VAZIA: "Escreva uma palavra antes de enviar.",
  VALOR_INVALIDO: "Escolha valeu, não valeu ou neutro.",
  AUTOR_NAO_AVALIA: "Quem escreveu a palavra não vota nela.",
  PALAVRA_SEM_AUTOR: "Essa palavra foi sorteada — ninguém escreveu, ninguém avalia.",
  TEMPO_INVALIDO: "Esse tempo não faz sentido.",
  SEM_ALVO: "Não encontrei o seu alvo desta rodada.",
  JA_ENVIOU: "Você já mandou a sua resposta desta vez.",
  SEM_TAREFA: "Não encontrei uma tarefa sua nesta rodada.",
  DESENHO_VAZIO: "Desenhe alguma coisa antes de enviar.",
  TIME_INVALIDO: "Escolha o Time A ou o Time B.",
  TIME_INCOMPLETO: "Cada time precisa de pelo menos 2 pessoas.",
  SEM_SPYMASTER: "Cada time precisa escolher um Spymaster antes de começar.",
  NAO_ESTA_NO_TIME: "Você não está nesse time.",
  NAO_E_O_SPYMASTER: "Só o Spymaster do time da vez dá a dica.",
  DICA_JA_DADA: "A dica dessa vez já foi dada.",
  DICA_INVALIDA: "A dica precisa ser uma palavra só, sem números, e um número de 0 a 9.",
  NAO_E_SEU_TIME: "Não é a vez do seu time.",
  SPYMASTER_NAO_CLICA: "O Spymaster só dá dicas — quem aponta a palavra é o resto do time.",
  SEM_DICA_AINDA: "Espere o Spymaster dar a dica antes de apontar uma palavra.",
  PALAVRA_JA_VIRADA: "Essa palavra já foi revelada.",
  SEM_TABULEIRO: "O tabuleiro ainda não foi montado.",
  TIPO_INVALIDO: "Escolha verdade ou desafio.",
  ACAO_INVALIDA: "Ação inválida.",
  MODO_ADULTO_DESLIGADO: "O modo +18 está desligado nesta sala.",
  CONFIRMACAO_MAIORIDADE_OBRIGATORIA:
    "Para ligar o modo +18 é preciso confirmar que todo mundo tem 18 anos ou mais.",
  DUELO_NAO_ENCONTRADO: "Essa mesa não existe.",
  NAO_E_SUA_MESA: "Você não está jogando nesta mesa.",
  DUELO_ENCERRADO: "Essa mesa já terminou.",
  PERGUNTA_CURTA: "Escreva uma pergunta um pouco maior.",
  NADA_PARA_RESPONDER: "Não há pergunta esperando resposta.",
  SEM_CODIGO_DISPONIVEL: "Não consegui gerar um código agora. Tente de novo."
};

/** Erros que não valem um aviso na tela (acontecem em corrida normal). */
const SILENCIOSOS = new Set(["AINDA_TEM_TEMPO", "RODADA_NAO_ESTA_ABERTA"]);

export function codigoDoErro(erro: unknown): string {
  const bruto =
    typeof erro === "string"
      ? erro
      : ((erro as { message?: string })?.message ?? "");

  const achado = Object.keys(MENSAGENS).find((codigo) => bruto.includes(codigo));
  return achado ?? "";
}

export function ehSilencioso(erro: unknown): boolean {
  return SILENCIOSOS.has(codigoDoErro(erro));
}

export function traduzirErro(erro: unknown): string {
  const codigo = codigoDoErro(erro);
  if (codigo) return MENSAGENS[codigo];

  const bruto = (erro as { message?: string })?.message ?? "";

  // Rede caiu, Supabase fora do ar, .env errado…
  if (/fetch|network|Failed to fetch/i.test(bruto)) {
    return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  }
  if (/JWT|token|Invalid API key/i.test(bruto)) {
    return "Sessão expirada. Recarregue a página.";
  }

  return bruto || "Algo deu errado. Tente de novo.";
}
