import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MODULOS } from "../jogos";
import { ProvedorAvisos } from "../componentes/Base";
import {
  IDS, montarEstado, montarProps, painelDeTeste, privado
} from "./cenario";
import type { PropsJogo } from "../jogos/tipos";
import type { Duelo } from "../lib/tipos";

/**
 * Testes de tela dos sete jogos.
 *
 * O foco não é pixel: é comportamento e, principalmente, VISIBILIDADE. Cada
 * cenário monta o `privados` com exatamente as linhas que o RLS entregaria
 * àquela pessoa e verifica que a tela não mostra (nem esconde) o que não deve.
 */

function renderizar(props: PropsJogo, id: keyof typeof MODULOS) {
  const Jogo = MODULOS[id].Componente;
  return render(
    <ProvedorAvisos>
      <Jogo {...props} />
    </ProvedorAvisos>
  );
}

/* ===================================================== C, S, Composto */

describe("C, S, Composto", () => {
  const estadoBase = (euId: string) =>
    montarEstado("c-s-composto", {
      estado: { categoria: "Frutas", sequencia: ["C", "S", "Composto"], indice: 1, voltas: 0 },
      vez_de: IDS.ana,
      turno_fim: new Date(Date.now() + 5000).toISOString()
    }, { euId });

  it("mostra a categoria e a regra da vez para todo mundo", () => {
    renderizar(montarProps(estadoBase(IDS.bruno)), "c-s-composto");
    expect(screen.getByText("Frutas")).toBeTruthy();
    expect(screen.getByText(/É a vez de Ana/)).toBeTruthy();
  });

  it("só quem está na vez recebe o botão de avançar", () => {
    const { unmount } = renderizar(montarProps(estadoBase(IDS.ana)), "c-s-composto");
    expect(screen.getByRole("button", { name: /Próximo jogador/ })).toBeTruthy();
    unmount();

    renderizar(montarProps(estadoBase(IDS.bruno)), "c-s-composto");
    expect(screen.queryByRole("button", { name: /Próximo jogador/ })).toBeNull();
  });

  it("marca a regra atual da sequência", () => {
    renderizar(montarProps(estadoBase(IDS.ana)), "c-s-composto");
    const passoAtual = screen.getByText("S").closest("li");
    expect(passoAtual?.getAttribute("aria-current")).toBe("step");
  });

  it("avisa o servidor quando o cronômetro zera", async () => {
    const props = montarProps(estadoBase(IDS.ana), [], 0);
    vi.useFakeTimers();
    renderizar(props, "c-s-composto");
    await vi.advanceTimersByTimeAsync(600);
    vi.useRealTimers();
    expect(props.acao).toHaveBeenCalled();
  });
});

/* ==================================================== Palavra Parecida */

describe("Palavra Parecida", () => {
  const estado = (euId: string) =>
    montarEstado("palavra-parecida", {
      estado: {
        palavra_atual: "Areia",
        historico: [
          { palavra: "Praia", autor: null },
          { palavra: "Areia", autor: "Ana" }
        ]
      },
      vez_de: IDS.bruno,
      turno_fim: new Date(Date.now() + 5000).toISOString()
    }, { euId });

  it("mostra a corrente para a sala inteira", () => {
    renderizar(montarProps(estado(IDS.carla)), "palavra-parecida");
    expect(screen.getAllByText("Areia").length).toBeGreaterThan(0);
    expect(screen.getByText("Praia")).toBeTruthy();
  });

  it("dá o campo de palavra só para quem está na vez", () => {
    const { unmount } = renderizar(montarProps(estado(IDS.bruno)), "palavra-parecida");
    expect(screen.getByLabelText(/Fale em voz alta e digite/)).toBeTruthy();
    unmount();

    renderizar(montarProps(estado(IDS.carla)), "palavra-parecida");
    expect(screen.queryByLabelText(/Fale em voz alta e digite/)).toBeNull();
  });
});

/* ============================================================= Mímica */

describe("Mímica", () => {
  const estado = (euId: string) =>
    montarEstado("mimica", {
      fase: "em_andamento",
      estado: { acertos: 2, palavras_acertadas: ["Girafa", "Robô"] },
      vez_de: IDS.ana,
      turno_fim: new Date(Date.now() + 60000).toISOString()
    }, { euId });

  it("a palavra secreta não chega na tela de quem adivinha", () => {
    // Bruno não está na vez: o RLS não mandaria a linha da palavra
    renderizar(montarProps(estado(IDS.bruno), []), "mimica");

    expect(screen.getByText(/Adivinhem a mímica de Ana/)).toBeTruthy();
    expect(screen.queryByText("Girafa dançando")).toBeNull();
    expect(screen.queryByRole("button", { name: /Toque para ver a palavra/ })).toBeNull();
  });

  it("quem representa vê a palavra só depois de tocar", async () => {
    const usuario = userEvent.setup();
    renderizar(
      montarProps(estado(IDS.ana), [privado(IDS.ana, "palavra", { texto: "Girafa dançando" })]),
      "mimica"
    );

    // Escondida por padrão — protege de quem olha por cima do ombro
    expect(screen.queryByText("Girafa dançando")).toBeNull();

    await usuario.click(screen.getByRole("button", { name: /Toque para ver a palavra/ }));
    expect(screen.getByText("Girafa dançando")).toBeTruthy();
  });

  it("mostra o placar de acertos e o botão de marcar ponto", () => {
    renderizar(
      montarProps(estado(IDS.ana), [privado(IDS.ana, "palavra", { texto: "Robô" })]),
      "mimica"
    );
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Acertaram/ })).toBeTruthy();
  });

  it("lista o que não pode durante a mímica", () => {
    renderizar(montarProps(estado(IDS.bruno)), "mimica");
    for (const proibido of ["Falar", "Escrever", "Formar letras", "Apontar objetos"]) {
      expect(screen.getByText(proibido)).toBeTruthy();
    }
  });
});

/* ======================================================= Quem Sou Eu? */

describe("Quem Sou Eu?", () => {
  const estado = (euId: string) =>
    montarEstado("quem-sou-eu", {
      estado: {
        perguntas: { [IDS.ana]: 3 },
        acertaram: [],
        limite_perguntas: 10,
        ultima_resposta: { resposta: "sim", por: "Bruno" }
      },
      vez_de: IDS.ana
    }, { euId });

  it("a própria identidade nunca aparece — nem para quem está na vez", () => {
    // Ana está na vez. O RLS entrega as identidades DOS OUTROS, não a dela.
    const privados = [
      privado(IDS.bruno, "identidade", { nome: "Drácula", dica: "Prefere a madrugada" }, false),
      privado(IDS.carla, "identidade", { nome: "Cleópatra", dica: "Governou há tempo" }, false)
    ];

    renderizar(montarProps(estado(IDS.ana), privados), "quem-sou-eu");

    expect(screen.getByText("Você é: ?")).toBeTruthy();
    expect(screen.queryByText("Drácula")).toBeNull(); // Bruno não está na vez
  });

  it("os outros veem a identidade de quem está na vez", () => {
    const privados = [
      privado(IDS.ana, "identidade", { nome: "Saci-Pererê", dica: "Do folclore" }, false)
    ];

    renderizar(montarProps(estado(IDS.bruno), privados), "quem-sou-eu");

    expect(screen.getByText("Saci-Pererê")).toBeTruthy();
    expect(screen.getByText(/não conte/i)).toBeTruthy();
    expect(screen.getByText("Você é: ?")).toBeTruthy(); // Bruno também não vê a dele
  });

  it("quem está na vez chuta; os outros respondem", async () => {
    const usuario = userEvent.setup();

    const { unmount } = renderizar(montarProps(estado(IDS.ana)), "quem-sou-eu");
    expect(screen.getByRole("button", { name: /Meu palpite/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Sim$/ })).toBeNull();
    await usuario.click(screen.getByRole("button", { name: /Meu palpite/ }));
    expect(screen.getByLabelText(/Quem você acha que é/)).toBeTruthy();
    unmount();

    renderizar(montarProps(estado(IDS.bruno)), "quem-sou-eu");
    expect(screen.getByRole("button", { name: /Sim/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Não/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Talvez/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Meu palpite/ })).toBeNull();
  });

  it("mostra o contador de perguntas do limite", () => {
    renderizar(montarProps(estado(IDS.bruno)), "quem-sou-eu");
    expect(screen.getByText("3 de 10 perguntas usadas")).toBeTruthy();
  });
});

/* ================================================ Duas Verdades e Uma Mentira */

describe("Duas Verdades e Uma Mentira", () => {
  const escrevendo = (euId: string) =>
    montarEstado("duas-verdades", {
      fase: "escrevendo",
      estado: { tema: "Viagens que você já fez", frases: [], votos: 0, total_votantes: 3 },
      vez_de: IDS.ana,
      turno_fim: new Date(Date.now() + 120000).toISOString()
    }, { euId });

  const votando = (euId: string) =>
    montarEstado("duas-verdades", {
      fase: "votacao",
      estado: {
        tema: "Viagens",
        frases: ["Já morei fora", "Tenho medo de pombo", "Sei tocar sanfona"],
        votos: 1,
        total_votantes: 3
      },
      vez_de: IDS.ana,
      turno_fim: new Date(Date.now() + 60000).toISOString()
    }, { euId });

  it("a tela de escrita é privada de quem está na vez", () => {
    const { unmount } = renderizar(montarProps(escrevendo(IDS.ana)), "duas-verdades");
    expect(screen.getByLabelText("Frase 1")).toBeTruthy();
    expect(screen.getByText(/ninguém mais está vendo/i)).toBeTruthy();
    unmount();

    renderizar(montarProps(escrevendo(IDS.bruno)), "duas-verdades");
    expect(screen.queryByLabelText("Frase 1")).toBeNull();
    expect(screen.getByText(/Ana está escrevendo/)).toBeTruthy();
  });

  it("só habilita o envio com as três frases e a mentira marcada", async () => {
    const usuario = userEvent.setup();
    renderizar(montarProps(escrevendo(IDS.ana)), "duas-verdades");

    const enviar = screen.getByRole("button", { name: /Mandar para a mesa/ });
    expect((enviar as HTMLButtonElement).disabled).toBe(true);

    await usuario.type(screen.getByLabelText("Frase 1"), "Já morei fora");
    await usuario.type(screen.getByLabelText("Frase 2"), "Tenho medo de pombo");
    await usuario.type(screen.getByLabelText("Frase 3"), "Sei tocar sanfona");
    expect((enviar as HTMLButtonElement).disabled).toBe(true); // falta marcar a mentira

    await usuario.click(screen.getAllByRole("radio")[1]);
    expect((enviar as HTMLButtonElement).disabled).toBe(false);
  });

  it("o autor não vota nas próprias frases", () => {
    renderizar(montarProps(votando(IDS.ana)), "duas-verdades");

    expect(screen.getByText(/não vota nas próprias frases/i)).toBeTruthy();
    const botoesFrase = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("Tenho medo de pombo"));
    expect((botoesFrase[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("a mesa vê só a contagem de votos", () => {
    renderizar(montarProps(votando(IDS.bruno)), "duas-verdades");
    expect(screen.getByText("1/3")).toBeTruthy();
    expect(screen.getByText("votaram")).toBeTruthy();
  });
});

/* ================================================== Verdade ou Desafio */

describe("Verdade ou Desafio", () => {
  const semCarta = (euId: string, modoAdulto = false) =>
    montarEstado("verdade-ou-desafio", {
      estado: { escolha: null, carta: null, historico: [] },
      vez_de: IDS.ana
    }, { euId, modoAdulto });

  const comCarta = (euId: string) =>
    montarEstado("verdade-ou-desafio", {
      estado: {
        escolha: "verdade",
        adulto: false,
        carta: { id: "c1", texto: "Qual foi o maior mico que você pagou?" },
        historico: []
      },
      vez_de: IDS.ana
    }, { euId });

  it("o botão +18 só existe com o modo ligado na sala", () => {
    const { unmount } = renderizar(montarProps(semCarta(IDS.ana, false)), "verdade-ou-desafio");
    expect(screen.getByRole("button", { name: "Verdade" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /🔞/ })).toBeNull();
    unmount();

    renderizar(montarProps(semCarta(IDS.ana, true)), "verdade-ou-desafio");
    expect(screen.getAllByRole("button", { name: /🔞/ }).length).toBe(2);
  });

  it("a carta aparece para todo mundo, mas as ações são de quem está na vez", () => {
    const { unmount } = renderizar(montarProps(comCarta(IDS.bruno)), "verdade-ou-desafio");
    expect(screen.getByText(/Qual foi o maior mico/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Não me sinto confortável/ })).toBeNull();
    unmount();

    renderizar(montarProps(comCarta(IDS.ana)), "verdade-ou-desafio");
    expect(screen.getByRole("button", { name: /Não me sinto confortável/ })).toBeTruthy();
  });

  it("a saída sem constrangimento fica sempre visível para quem joga", () => {
    renderizar(montarProps(comCarta(IDS.ana)), "verdade-ou-desafio");
    const botao = screen.getByRole("button", { name: /Não me sinto confortável/ });
    expect((botao as HTMLButtonElement).disabled).toBe(false);
  });
});

/* ========================================================= Cara a Cara */

describe("Cara a Cara", () => {
  const painel = painelDeTeste();

  const duelo: Duelo = {
    id: "duelo-1",
    mesa: 1,
    jogador_a: IDS.ana,
    jogador_b: IDS.bruno,
    vez_de: IDS.ana,
    fase: "perguntando",
    pergunta_atual: null,
    historico: [],
    vencedor_id: null,
    motivo_fim: null
  };

  const estado = (euId: string, d: Partial<Duelo> = {}) =>
    montarEstado("cara-a-cara", { estado: { mesas: 1 }, vez_de: null }, {
      euId,
      duelos: [{ ...duelo, ...d }],
      config: { painel }
    });

  it("mostra o painel inteiro e o personagem secreto só do dono", () => {
    const privados = [privado(IDS.ana, "personagem", { ...painel[3].p, carta_id: painel[3].id })];
    renderizar(montarProps(estado(IDS.ana), privados), "cara-a-cara");

    // O painel é compartilhado: 24 personagens para todo mundo
    expect(screen.getAllByRole("img", { name: /Ilustração de/ }).length).toBe(25); // 24 + o meu
    expect(screen.getByText(/Seu personagem/)).toBeTruthy();
  });

  it("quem está na vez pergunta; o adversário responde", async () => {
    const usuario = userEvent.setup();

    const { unmount } = renderizar(montarProps(estado(IDS.ana)), "cara-a-cara");
    expect(screen.getByLabelText(/Sua pergunta de sim ou não/)).toBeTruthy();
    unmount();

    // Fase de resposta: os botões aparecem só para quem NÃO perguntou
    const respondendo = { fase: "respondendo" as const, pergunta_atual: "Usa óculos?" };

    const r2 = renderizar(montarProps(estado(IDS.bruno, respondendo)), "cara-a-cara");
    expect(screen.getByRole("button", { name: /Sim/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Não/ })).toBeTruthy();
    r2.unmount();

    renderizar(montarProps(estado(IDS.ana, respondendo)), "cara-a-cara");
    expect(screen.getByText(/Esperando Bruno responder/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Sim$/ })).toBeNull();

    void usuario;
  });

  it("marcar personagem como descartado é anotação particular", async () => {
    const usuario = userEvent.setup();
    const props = montarProps(estado(IDS.ana));
    renderizar(props, "cara-a-cara");

    await usuario.click(screen.getByRole("button", { name: /Descartar Alma/ }));
    expect(props.acao).toHaveBeenCalled();
  });

  it("o palpite pede confirmação, avisando o risco", async () => {
    const usuario = userEvent.setup();
    renderizar(montarProps(estado(IDS.ana)), "cara-a-cara");

    await usuario.click(within(screen.getByText("Alma").closest("div")!).getByText("É esse!"));

    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText(/vence a mesa na hora/)).toBeTruthy();
  });

  it("quem sobrou de fora acompanha as mesas", () => {
    const semMinhaMesa = montarEstado("cara-a-cara", { vez_de: null }, {
      euId: IDS.carla,
      duelos: [duelo],
      config: { painel }
    });

    renderizar(montarProps(semMinhaMesa), "cara-a-cara");
    expect(screen.getByText(/Você está de fora nesta rodada/)).toBeTruthy();
    expect(screen.getByText("Mesa 1")).toBeTruthy();
  });
});
