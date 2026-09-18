# 🎲 Party Games

Sala multiplayer em tempo real para grupos de amigos jogarem brincadeiras rápidas — cada
pessoa no próprio celular, todo mundo na mesma mesa.

Uma pessoa cria a sala, manda o link no grupo, os amigos entram só com um apelido e o jogo
acontece sincronizado: entrada e saída de gente, jogador da vez, cronômetro, votos, placar e
troca de jogo aparecem na hora em todas as telas.

**React + TypeScript + Vite + Tailwind CSS + Supabase** (auth anônima, Postgres e Realtime).

---

## Índice

1. [Rodando em 5 minutos](#rodando-em-5-minutos)
2. [Configurando o Supabase](#configurando-o-supabase)
3. [Os sete jogos](#os-sete-jogos)
4. [Como a visibilidade funciona](#como-a-visibilidade-funciona)
5. [Arquitetura](#arquitetura)
6. [Testes](#testes)
7. [Modo +18](#modo-18)
8. [Estrutura de pastas](#estrutura-de-pastas)

---

> **Já quer publicar?** O passo a passo completo de Supabase + Vercel está em [DEPLOY.md](DEPLOY.md).

## Rodando em 5 minutos

```bash
npm install
cp .env.example .env      # e preencha com as chaves do seu projeto Supabase
npm run dev               # http://localhost:5173
```

Sem o `.env` preenchido o app abre numa tela explicando o que falta — não quebra em branco.

> **Só quer ver as telas, sem backend?** `npm run vitrine` abre uma página com todas as telas
> montadas com dados fabricados. Serve para revisar layout e responsividade sem criar sala.

---

## Configurando o Supabase

### 1. Crie o projeto

Em [supabase.com](https://supabase.com) → **New project**. Anote a senha do banco (você não vai
precisar dela aqui, mas o Supabase pede).

### 2. Pegue as chaves

**Project Settings → API**:

| Campo no painel | Vai para o `.env` |
| --- | --- |
| Project URL | `VITE_SUPABASE_URL` |
| Project API keys → `anon` `public` | `VITE_SUPABASE_ANON_KEY` |

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

A chave `anon` é pública por natureza — quem protege os dados é o RLS, não o segredo da chave.
**Nunca** coloque a `service_role` aqui.

### 3. Ligue o login anônimo

**Authentication → Providers → Anonymous sign-ins → habilitar.**

Sem isso ninguém entra: o app não pede cadastro, ele cria uma sessão anônima para cada pessoa.

### 4. Aplique o schema

O caminho rápido: copie o `supabase/tudo.sql` inteiro e cole no **SQL Editor** → **Run**.
É a soma dos cinco arquivos abaixo, e os testes garantem que ele nunca sai de sincronia.

Preferindo por partes, rode **nesta ordem**, um de cada vez:

| Arquivo | O que faz |
| --- | --- |
| `01_schema.sql` | Tabelas, tipos e índices |
| `02_policies.sql` | RLS — quem pode ler o quê |
| `03_funcoes.sql` | As funções RPC (toda a lógica de jogo) |
| `04_seed.sql` | Baralho de cartas dos 7 jogos |
| `05_realtime.sql` | Publica as tabelas no canal de tempo real |

Cada arquivo pode ser rodado de novo sem estragar nada. O `04_seed.sql` recria o baralho do
zero — é onde você mexe para adicionar ou trocar cartas.

### 5. Suba o app

```bash
npm run dev
```

Abra em duas abas (ou no celular, pelo IP da rede) para ver a sincronização acontecendo.

> **Testar no celular:** `npm run dev` já expõe na rede local. Use o endereço "Network" que o
> Vite mostra. O código da sala é o mesmo em qualquer aparelho.

---

## Os dez jogos

| Jogo | Cronômetro | O que é privado |
| --- | --- | --- |
| 🔤 **C, S, Composto** | 10s por vez, 120s na votação | o voto de cada palavra, até a revelação final |
| 🔗 **Palavra Parecida** | 5s por vez | nada |
| 🕵️ **Quem Sou Eu?** | — | sua identidade some **para você** e aparece para os outros |
| 🎭 **Mímica** | 60s sincronizados | a palavra secreta, só para quem representa |
| 🧩 **Cara a Cara** | — | seu personagem e suas marcas de descarte |
| 🤥 **Duas Verdades e Uma Mentira** | 120s escrita, 60s votação | as frases enquanto escreve, e cada voto até a revelação |
| 🎲 **Verdade ou Desafio** | — | nada (o baralho +18 é liberado por RPC, nunca por leitura direta) |
| ⏱️ **Cronômetro** | 60s por rodada (a contagem em si roda no aparelho, sem servidor) | o alvo em milissegundos de cada um |
| 🎨 **Desenho Telefone** | 45s por frase, 90s por desenho | cada etapa, até a revelação final do caderno inteiro |
| 🎯 **Code Names** | — | o mapa de cores verdadeiras, só para os dois Spymasters |

Com mais de duas pessoas, o **Cara a Cara** monta mesas em duplas e a sala acompanha o
andamento de todas. No **Desenho Telefone**, todo mundo trabalha ao mesmo tempo em cadernos
diferentes — ninguém fica esperando a vez de ninguém. No **Code Names**, dois times jogam em
paralelo — cada um só espera a própria vez, nunca a do outro time.

---

## Como a visibilidade funciona

Esta é a decisão central do projeto: **segredo de jogo não é escondido no CSS, ele não sai do
banco**.

Tudo que é secreto mora na tabela `estados_privados`, com uma coluna que inverte a regra:

```sql
visivel_para_dono = true   →  SÓ o dono lê
                              palavra da mímica, personagem do Cara a Cara, suas frases

visivel_para_dono = false  →  todos leem MENOS o dono
                              "Quem Sou Eu?": sua identidade é o que você não pode ver
```

E a política de RLS é literalmente isso:

```sql
create policy "segredo vai só para quem tem direito"
  on estados_privados for select using (
    app_esta_na_sala(sala_id)
    and (
      (visivel_para_dono and dono_id = app_participante_id(sala_id))
      or
      (not visivel_para_dono and dono_id <> app_participante_id(sala_id))
    )
  );
```

Como o Realtime do Supabase respeita RLS, o segredo também não vaza pelo canal de tempo real:
o cliente errado simplesmente **não recebe a linha**. Abrir o DevTools não adianta.

O mesmo vale para os votos de Duas Verdades: enquanto a votação corre, cada pessoa lê apenas o
próprio voto; a mesa vê só o **contador**. A política libera os demais quando a rodada revela.

---

## Arquitetura

### O cliente nunca escreve no banco

As políticas de RLS liberam apenas **SELECT**. Toda mudança de estado passa por uma função RPC
`SECURITY DEFINER` que valida quem está chamando:

```
o cliente pede  →  RPC valida (está na sala? é o anfitrião? é a sua vez?)
                →  sorteia a carta no servidor
                →  grava o estado
                →  Realtime avisa todo mundo
                →  cada cliente relê o estado que tem direito de ver
```

Três coisas caem de graça nesse desenho:

- **a carta secreta é sorteada no servidor** — o cliente não escolhe nem enxerga antes da hora;
- **o cronômetro usa `now()` do Postgres** (`turno_inicio` / `turno_fim` são timestamps
  absolutos) — adiantar o relógio do celular não dá vantagem, porque quem valida o fim do tempo
  é o banco;
- **o cliente pode ser burro**: chama a ação e redesenha o que voltar.

### Sincronização

`useSala` assina as mudanças das tabelas da sala e, a qualquer evento, refaz a leitura completa
com `estado_da_sala()`. É uma consulta a mais em vez de costurar deltas na mão — o estado nunca
fica pela metade, que é o que importa numa mesa com gente mexendo ao mesmo tempo. Rajadas de
eventos viram uma releitura só.

### Reconexão e desconexão

- O apelido e o código da sala ficam no `localStorage`: recarregar a página volta direto ao
  assento, sem perguntar nada.
- `entrar_sala()` reaproveita o participante existente em vez de criar outro.
- Um batimento a cada 12s mantém a presença; quem some por mais de 30s aparece como
  **desconectado** para a sala inteira.
- O anfitrião pode **pular a vez** de quem caiu, para a mesa não travar.
- Se o anfitrião sai, a faixa passa sozinha para a próxima pessoa da fila.

---

## Testes

```bash
npm run test:sql     # o banco inteiro, num Postgres real (WASM)
npm test             # as telas dos 7 jogos
npm run typecheck    # TypeScript
npm run checar       # confere seu Supabase de ponta a ponta
```

### `npm run test:sql` — 121 verificações

Sobe um Postgres de verdade em WASM ([PGlite](https://pglite.dev)), cria os stubs que o Supabase
fornece (schema `auth`, papéis `anon`/`authenticated`), aplica os cinco arquivos SQL e joga
partidas inteiras trocando de usuário a cada chamada — **com RLS valendo**, porque cada consulta
roda com `set role authenticated`.

É assim que dá para afirmar, e não só supor, que:

- quem não está na sala não lê nada dela;
- em "Quem Sou Eu?" cada pessoa recebe as identidades dos outros e nunca a sua;
- a palavra da mímica não chega no cliente de quem adivinha;
- o voto de Duas Verdades é invisível até a revelação;
- ninguém força o fim do tempo antes da hora;
- o baralho +18 não é legível por consulta direta, mesmo com o modo ligado.

### `npm test` — 26 testes de tela

Renderiza os sete jogos com o `privados` contendo **exatamente** as linhas que o RLS entregaria
àquela pessoa, e verifica o comportamento: quem vê o botão de avançar, quem consegue votar, o
que aparece e o que não aparece em cada tela.

---

## Modo +18

Desligado por padrão. Para ligar, o anfitrião passa por uma confirmação explícita de que todo
mundo na sala tem 18 anos ou mais e concorda com o conteúdo — o banco recusa a ativação sem essa
confirmação (`CONFIRMACAO_MAIORIDADE_OBRIGATORIA`).

As cartas são picantes e divertidas, **não explícitas**: nada degradante, coercitivo, envolvendo
quem não está na roda ou ilegal.

Salvaguardas:

- botão **“Não me sinto confortável”** sempre visível, que troca a carta sem cobrança nenhuma;
- pular fica no histórico, mas **nunca** vira punição;
- o anfitrião desliga o modo a qualquer instante, e o efeito é imediato;
- as cartas adultas não são legíveis por consulta direta — só circulam pela RPC, em salas que
  confirmaram a maioridade.

---

## Estrutura de pastas

```
.
├── supabase/
│   ├── 01_schema.sql       tabelas, tipos, índices
│   ├── 02_policies.sql     RLS (a regra de visibilidade mora aqui)
│   ├── 03_funcoes.sql      ~30 RPCs: sala, partida, turnos e cada jogo
│   ├── 04_seed.sql         baralho dos 7 jogos, incluindo o pacote +18
│   ├── 05_realtime.sql     publicação do canal de tempo real
│   └── testes/rodar.mjs    partidas completas contra Postgres em WASM
│
├── src/
│   ├── lib/                cliente Supabase, tipos, erros, catálogo de jogos
│   ├── hooks/              useSala (estado + realtime), useCronometro
│   ├── componentes/        botões, avatares, placar, cronômetro, modais, rostos SVG
│   ├── paginas/            Início, Sala (porta de entrada), Lobby, Mesa
│   ├── jogos/              um módulo por jogo + o registro
│   ├── testes/             testes de tela e o cenário fabricado
│   └── vitrine.tsx         QA visual sem backend
│
└── _legado-*/              versões anteriores, guardadas
```

### Adicionando um jogo novo

1. Um valor no enum `jogo_id` (`01_schema.sql`) e as cartas dele no `04_seed.sql`.
2. As RPCs da mecânica no `03_funcoes.sql` (e o caso dentro de `_preparar_rodada`).
3. A entrada em `src/lib/jogos.ts` (nome, emoji, cor, regras).
4. O módulo em `src/jogos/` e o registro em `src/jogos/index.ts`.

A `Mesa` cuida de cabeçalho, placar, regras, cronômetro e fim de rodada — o módulo só desenha o
miolo.

---

## PWA

O app é instalável e a casca funciona offline (`vite-plugin-pwa`). O estado da sala é ao vivo,
então **não** é servido do cache: sem internet dá para abrir o app, mas não para jogar.

```bash
npm run build && npm run preview   # para testar o service worker
```

---

## Versões anteriores

- `_legado-html-css-js/` — a versão em HTML/CSS/JS puro, sem backend, com sorteio local.
- `_legado-react-node/` — a primeira versão, com React + Vite + Node/Socket.IO.

Nenhuma das duas interfere neste projeto; podem ser apagadas quando não fizerem mais falta.
