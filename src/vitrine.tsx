/**
 * Vitrine — conferência visual sem backend.
 *
 *   npm run vitrine   →   http://localhost:5173/vitrine.html
 *
 * Monta as telas com estado fabricado para revisar layout, contraste e
 * responsividade sem precisar subir uma sala de verdade. Os botões não chamam o
 * servidor (não há sessão): eles caem no tratamento de erro e mostram um aviso.
 *
 * Isto NÃO entra no app: é uma página separada, útil para QA de design.
 */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "./estilos.css";

import { ProvedorAvisos } from "./componentes/Base";
import { Lobby } from "./paginas/Lobby";
import { Mesa } from "./paginas/Mesa";
import { Inicio } from "./paginas/Inicio";
import type { SalaAoVivo } from "./hooks/useSala";
import type { Duelo, EstadoPrivado, EstadoSala, JogoId, Participante } from "./lib/tipos";
import { JOGOS } from "./lib/jogos";

const IDS = { ana: "p-ana", bruno: "p-bruno", carla: "p-carla", davi: "p-davi" };

const PESSOAS: Participante[] = [
  { id: IDS.ana, apelido: "Ana", cor: "roxo", e_anfitriao: true, conectado: true, pontos: 4, eliminado: false, ordem: 0 },
  { id: IDS.bruno, apelido: "Bruno", cor: "rosa", e_anfitriao: false, conectado: true, pontos: 2, eliminado: false, ordem: 1 },
  { id: IDS.carla, apelido: "Carla", cor: "amarelo", e_anfitriao: false, conectado: false, pontos: 3, eliminado: false, ordem: 2 },
  { id: IDS.davi, apelido: "Davi", cor: "azul", e_anfitriao: false, conectado: true, pontos: 1, eliminado: true, ordem: 3 }
];

const PAINEL = [
  "Alma", "Bento", "Célia", "Dário", "Elis", "Fábio", "Gina", "Hugo",
  "Íris", "Jonas", "Kátia", "Lucas", "Malu", "Nico", "Olga", "Paulo",
  "Quenia", "Rui", "Sara", "Tiago", "Ubi", "Vera", "Wilson", "Zuma"
].map((nome, i) => ({
  id: `carta-${i}`,
  p: {
    nome,
    cabelo: (["preto", "castanho", "loiro", "ruivo", "grisalho", "careca"] as const)[i % 6],
    estilo_cabelo: (["curto", "longo", "cacheado", "careca"] as const)[i % 4],
    oculos: i % 2 === 0,
    chapeu: i % 3 === 0,
    barba: i % 4 === 0,
    camiseta: (["roxo", "rosa", "amarelo", "azul", "verde", "cinza"] as const)[i % 6],
    acessorio: (["nenhum", "brinco", "colar", "cachecol"] as const)[i % 4],
    pele: (["clara", "morena", "negra"] as const)[i % 3]
  }
}));

const DUELOS: Duelo[] = [
  {
    id: "d1", mesa: 1, jogador_a: IDS.ana, jogador_b: IDS.bruno, vez_de: IDS.ana,
    fase: "perguntando", pergunta_atual: null,
    historico: [{ pergunta: "Seu personagem usa óculos?", resposta: "sim", de: "Bruno" }],
    vencedor_id: null, motivo_fim: null
  },
  {
    id: "d2", mesa: 2, jogador_a: IDS.carla, jogador_b: IDS.davi, vez_de: IDS.davi,
    fase: "respondendo", pergunta_atual: "Tem barba?", historico: [],
    vencedor_id: null, motivo_fim: null
  }
];

function base(jogo: JogoId, rodada: Partial<EstadoSala["rodada"]>, modoAdulto = false): EstadoSala {
  return {
    servidor_agora: new Date().toISOString(),
    eu: { id: IDS.ana, apelido: "Ana", cor: "roxo", e_anfitriao: true, pontos: 4, eliminado: false },
    sala: {
      id: "s1", codigo: "K3PT", nome: "Sala da galera", status: "jogando",
      jogo_atual: jogo, modo_adulto: modoAdulto,
      adulto_confirmado_em: modoAdulto ? new Date().toISOString() : null,
      anfitriao_id: IDS.ana
    },
    participantes: PESSOAS,
    partida: { id: "pt1", jogo, status: "ativa", config: { painel: PAINEL } as never },
    rodada: {
      id: "r1", numero: 3, fase: "em_andamento", vez_de: IDS.ana,
      estado: {}, turno_inicio: null, turno_fim: null, resultado: null,
      ...rodada
    } as EstadoSala["rodada"],
    duelos: jogo === "cara-a-cara" ? DUELOS : []
  };
}

const daquiA = (s: number) => new Date(Date.now() + s * 1000).toISOString();

function priv(dono: string, tipo: EstadoPrivado["tipo"], conteudo: Record<string, unknown>, visivel = true): EstadoPrivado {
  return { id: `${dono}-${tipo}`, rodada_id: "r1", partida_id: "pt1", dono_id: dono, tipo, conteudo, visivel_para_dono: visivel };
}

interface Cena {
  nome: string;
  render: () => React.ReactNode;
}

function comoSala(estado: EstadoSala, privados: EstadoPrivado[] = []): SalaAoVivo {
  return {
    estado, privados, carregando: false, erro: null, codigoErro: "",
    desvioRelogio: 0, conectado: true, recarregar: async () => {}
  };
}

const CENAS: Cena[] = [
  { nome: "Início", render: () => <Inicio /> },
  {
    nome: "Lobby",
    render: () => (
      <Lobby
        sala={comoSala({ ...base("mimica", {}), sala: { ...base("mimica", {}).sala, status: "lobby" } })}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "C, S, Composto",
    render: () => (
      <Mesa
        sala={comoSala(
          base("c-s-composto", {
            vez_de: IDS.bruno,
            estado: {
              palavra_atual: "Onda",
              historico: [
                { palavra: "Praia", autor: null, autor_id: null },
                { palavra: "Onda", autor: "Ana", autor_id: IDS.ana }
              ],
              meta_rodadas: 10,
              rodada_atual: 1
            },
            turno_fim: daquiA(8)
          })
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "C, S, Composto (votação)",
    render: () => (
      <Mesa
        sala={comoSala(
          base("c-s-composto", {
            fase: "votacao",
            vez_de: null,
            estado: {
              historico: [
                { palavra: "Praia", autor: null, autor_id: null },
                { palavra: "Onda", autor: "Ana", autor_id: IDS.ana },
                { palavra: "Vento", autor: "Bruno", autor_id: IDS.bruno }
              ],
              avaliacoes_feitas: 2,
              avaliacoes_esperadas: 6
            },
            turno_fim: daquiA(90)
          })
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "Palavra Parecida",
    render: () => (
      <Mesa
        sala={comoSala(
          base("palavra-parecida", {
            estado: {
              palavra_atual: "Areia",
              historico: [
                { palavra: "Praia", autor: null },
                { palavra: "Areia", autor: "Bruno" },
                { palavra: "Castelo", autor: "Carla" }
              ]
            },
            turno_fim: daquiA(3)
          })
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "Mímica",
    render: () => (
      <Mesa
        sala={comoSala(
          base("mimica", {
            estado: { acertos: 3, palavras_acertadas: ["Girafa", "Robô", "Pescar"] },
            turno_fim: daquiA(38)
          }),
          [priv(IDS.ana, "palavra", { texto: "Andar de skate" })]
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "Quem Sou Eu?",
    render: () => (
      <Mesa
        sala={comoSala(
          base("quem-sou-eu", {
            vez_de: IDS.bruno,
            estado: {
              perguntas: { [IDS.bruno]: 4 },
              limite_perguntas: 10,
              acertaram: [{ id: IDS.carla, apelido: "Carla", identidade: "Saci-Pererê" }],
              ultima_resposta: { resposta: "sim", por: "Ana" }
            }
          }),
          [priv(IDS.bruno, "identidade", { nome: "Drácula", dica: "Prefere a madrugada" }, false)]
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "Cara a Cara",
    render: () => (
      <Mesa
        sala={comoSala(
          base("cara-a-cara", { vez_de: null, estado: { mesas: 2 } }),
          [
            priv(IDS.ana, "personagem", { ...PAINEL[4].p, carta_id: PAINEL[4].id }),
            priv(IDS.ana, "eliminados", { ids: [PAINEL[0].id, PAINEL[2].id, PAINEL[7].id] })
          ]
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "Cronômetro",
    render: () => (
      <Mesa
        sala={comoSala(
          base("cronometro", {
            vez_de: null,
            estado: {
              total_jogadores: 4,
              resultados: [
                { participante_id: IDS.bruno, apelido: "Bruno", alvo_ms: 6120, tempo_ms: 6340, erro_ms: 220 }
              ]
            },
            turno_fim: daquiA(52)
          }),
          [priv(IDS.ana, "alvo_tempo", { alvo_ms: 7482 })]
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "Desenho Telefone (desenhar)",
    render: () => (
      <Mesa
        sala={comoSala(
          base("desenho-telefone", {
            vez_de: null,
            estado: {
              passo_atual: 1, total_passos: 4, total_jogadores: 4, tipo_passo: "desenho",
              enviaram: [IDS.carla]
            },
            turno_fim: daquiA(70)
          }),
          [
            priv(IDS.ana, "tarefa_desenho", {
              caderno: 3, passo: 1, tipo: "desenho", anterior: { texto: "um gato surfando" }
            })
          ]
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "Desenho Telefone (legendar + revelação)",
    render: () => (
      <Mesa
        sala={comoSala(
          base("desenho-telefone", {
            fase: "resultado",
            vez_de: null,
            estado: {
              passo_atual: 3, total_passos: 4, total_jogadores: 4, tipo_passo: "frase", enviaram: []
            },
            resultado: {
              tipo: "desenho_telefone",
              cadernos: [
                {
                  caderno: 0,
                  autor_original: "Ana",
                  passos: [
                    { passo: 0, tipo: "frase", autor: "Ana", conteudo: { texto: "um gato surfando" } },
                    {
                      passo: 1, tipo: "desenho", autor: "Bruno",
                      conteudo: { tracos: [{ cor: "#1a1a1a", pontos: [[10, 80], [50, 20], [90, 80]] }] }
                    },
                    { passo: 2, tipo: "frase", autor: "Carla", conteudo: { texto: "uma tenda de circo" } },
                    { passo: 3, tipo: "desenho", autor: null, conteudo: null }
                  ]
                }
              ]
            }
          }),
          [
            priv(IDS.ana, "tarefa_desenho", {
              caderno: 2, passo: 3, tipo: "frase",
              anterior: { tracos: [{ cor: "#dc2626", pontos: [[20, 20], [80, 80]] }] }
            })
          ]
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "Code Names (times)",
    render: () => (
      <Mesa
        sala={comoSala(
          base("code-names", {
            fase: "preparando",
            vez_de: null,
            estado: {
              time_de: { [IDS.ana]: "A", [IDS.bruno]: "A", [IDS.carla]: "B" },
              spymaster_a: IDS.ana,
              spymaster_b: null
            }
          })
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "Code Names (tabuleiro)",
    render: () => (
      <Mesa
        sala={comoSala(
          base("code-names", {
            vez_de: null,
            estado: {
              time_de: { [IDS.ana]: "A", [IDS.bruno]: "A", [IDS.carla]: "B", [IDS.davi]: "B" },
              spymaster_a: IDS.ana,
              spymaster_b: IDS.carla,
              time_da_vez: "A",
              dica_atual: { palavra: "PRAIA", numero: 3, por: "Ana" },
              palpites_restantes: 3,
              restantes: { A: 7, B: 8 },
              palavras: [
                { indice: 0, texto: "Sol", revelada: true, cor: "A" },
                { indice: 1, texto: "Areia", revelada: false, cor: null },
                { indice: 2, texto: "Concha", revelada: false, cor: null },
                { indice: 3, texto: "Foguete", revelada: false, cor: null },
                { indice: 4, texto: "Vulcão", revelada: false, cor: null },
                { indice: 5, texto: "Gato", revelada: false, cor: null },
                { indice: 6, texto: "Piano", revelada: false, cor: null },
                { indice: 7, texto: "Escola", revelada: false, cor: null },
                { indice: 8, texto: "Ponte", revelada: false, cor: null },
                { indice: 9, texto: "Robô", revelada: false, cor: null }
              ]
            }
          }),
          [priv(IDS.ana, "mapa_secreto", {
            cores: ["A", "A", "A", "B", "bomba", "B", "neutro", "neutro", "B", "A"]
          })]
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "Duas Verdades (votação)",
    render: () => (
      <Mesa
        sala={comoSala(
          base("duas-verdades", {
            fase: "votacao",
            vez_de: IDS.bruno,
            estado: {
              tema: "Viagens que você já fez",
              frases: ["Já morei na Irlanda", "Tenho medo de pombo", "Sei tocar sanfona"],
              votos: 1,
              total_votantes: 3
            },
            turno_fim: daquiA(42)
          })
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "Verdade ou Desafio (+18)",
    render: () => (
      <Mesa
        sala={comoSala(
          base(
            "verdade-ou-desafio",
            {
              estado: {
                escolha: "desafio",
                adulto: true,
                carta: { id: "c1", texto: "Faça um elogio sincero e respeitoso para uma pessoa da roda." },
                historico: [
                  { apelido: "Carla", escolha: "verdade", texto: "Qual foi seu maior mico?", acao: "concluir" }
                ]
              }
            },
            true
          )
        )}
        aoSair={() => {}}
      />
    )
  },
  {
    nome: "Fim de rodada",
    render: () => (
      <Mesa
        sala={comoSala(
          base("duas-verdades", {
            fase: "resultado",
            vez_de: IDS.bruno,
            estado: {
              frases: ["Já morei na Irlanda", "Tenho medo de pombo", "Sei tocar sanfona"]
            },
            resultado: {
              tipo: "duas_verdades",
              mentira: 1,
              autor: "Bruno",
              autor_id: IDS.bruno,
              acertos: 1,
              enganados: 2,
              votos: [
                { apelido: "Ana", voto: 1, acertou: true },
                { apelido: "Carla", voto: 0, acertou: false },
                { apelido: "Davi", voto: 2, acertou: false }
              ]
            }
          })
        )}
        aoSair={() => {}}
      />
    )
  }
];

function Vitrine() {
  const inicial = Number(new URLSearchParams(location.search).get("cena") ?? 0);
  const [atual, setAtual] = useState(Number.isFinite(inicial) ? inicial : 0);

  return (
    <MemoryRouter>
      <ProvedorAvisos>
        <div className="border-b-2 border-roxo-200 bg-white p-2 print:hidden">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <strong className="fonte-titulo text-roxo-900">Vitrine</strong>
            {CENAS.map((cena, i) => (
              <button
                key={cena.nome}
                onClick={() => setAtual(i)}
                className={[
                  "rounded-full px-3 py-1.5 text-sm font-bold transition-colors",
                  i === atual ? "bg-roxo-600 text-white" : "bg-roxo-50 text-roxo-700"
                ].join(" ")}
              >
                {cena.nome}
              </button>
            ))}
            <span className="ml-auto text-xs text-texto-fraco">
              {JOGOS.length} jogos · estado fabricado, sem servidor
            </span>
          </div>
        </div>

        <div key={atual}>{CENAS[atual].render()}</div>
      </ProvedorAvisos>
    </MemoryRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Vitrine />
  </StrictMode>
);
