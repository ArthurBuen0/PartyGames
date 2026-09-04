# 🎲 Sorteia Aí

PWA mobile-first para grupos de amigos decidirem, em segundos, qual brincadeira jogar.
Cria a sala, manda o link no grupo, todo mundo entra com um apelido e o sorteio resolve a discussão.

Sem cadastro, sem senha, sem banco de dados: só apelido e um código de 4 letras.

## Como está montado

```
.
├── client/          PWA em React + Vite (instalável, funciona offline no que dá)
├── server/          API + Socket.IO em Node/Express (salas vivem em memória)
├── scripts/
│   ├── generate-icons.mjs   gera os PNGs do PWA sem depender de lib de imagem
│   └── smoke-test.mjs       teste de ponta a ponta do fluxo de sala
└── package.json     workspaces + scripts de conveniência
```

A **fonte da verdade do catálogo de jogos é o servidor** (`server/src/games.ts`). O cliente só
desenha o que recebe pelo socket — então dá para adicionar, editar ou remover brincadeiras sem
encostar no front.

## Rodando

```bash
npm install          # instala client e server de uma vez (workspaces)
npm run dev          # server em :3001 e o PWA em :5173 (com proxy do socket)
```

Abra <http://localhost:5173>.

### Versão de produção (um processo só)

```bash
npm run build        # builda o PWA e compila o servidor
npm start            # sobe tudo em http://localhost:3001
```

Em produção o próprio Express entrega o `client/dist`, então basta uma porta e um processo.

### Testando com o celular na mesma rede

```bash
npm run dev          # o Vite já escuta em 0.0.0.0
```

Descubra o IP da máquina (`ipconfig`) e abra `http://SEU_IP:5173` no celular.
Vale lembrar: fora de `localhost` e sem HTTPS, o navegador bloqueia a instalação do PWA e a
área de transferência — o app tem plano B pra copiar o link, mas para testar a instalação de
verdade use HTTPS (um túnel tipo `ngrok`/`cloudflared` resolve).

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe server + client em modo desenvolvimento |
| `npm run build` | Build do PWA + compilação do servidor |
| `npm start` | Sobe a versão de produção (uma porta só) |
| `npm run typecheck` | TypeScript estrito nos dois pacotes |
| `npm run icons` | Regera os ícones PNG do PWA |
| `npm run smoke` | Teste de ponta a ponta (precisa do servidor rodando) |

O `npm run smoke` simula dois celulares na mesma sala e confere o que importa: criar sala, entrar
pelo código, lista de participantes em tempo real, ligar/desligar jogos, sorteio idêntico nos dois
aparelhos, queda de conexão e volta pela reconexão.

## Como funciona a sala

- **Código de 4 letras** sem `0/O` e `1/I`, para ninguém errar ao digitar.
- **Link de convite**: `/entrar?sala=CODIGO` já chega com o código preenchido.
- **Tempo real**: cada mudança (alguém entra, sai, liga um jogo, sorteia) reemite o estado da sala
  inteira pelo Socket.IO. É simples e cabe folgado no tamanho de um grupo de amigos.
- **Sorteio sincronizado**: quem sorteia é o servidor. Ele manda o resultado *e a sequência da
  roleta*, então todo mundo vê a mesma animação parar no mesmo jogo, ao mesmo tempo.
- **Nunca repete o jogo anterior** quando há mais de um ligado.
- **Sempre sobra pelo menos um jogo ligado** — não dá para desligar o último.
- **Caiu a internet?** O jogador fica cinza na lista por 2 minutos e volta no mesmo lugar
  (a sessão fica no `localStorage`). Depois disso, some.
- **Faxina automática**: sala sem ninguém online some em 15 minutos; sala parada, em 6 horas.

Como tudo vive em memória, reiniciar o servidor derruba as salas abertas. Para um MVP de festa
isso é aceitável — se um dia precisar sobreviver a deploys, troque o `Map` de `server/src/rooms.ts`
por Redis e o resto do código continua igual.

## Catálogo inicial

C, S, Composto · Palavra Parecida · Quem Sou Eu? · Verdade ou Desafio (leve) · Mímica · Eu Nunca ·
Duas Verdades e Uma Mentira.

Cada jogo tem resumo, regras numeradas, uma dica e as marcações de nº de jogadores e duração.
Para incluir mais um, adicione um objeto em `server/src/games.ts` — o front se vira sozinho.

## PWA

- `manifest.webmanifest` com ícones 192, 512 e maskable, atalhos para "Criar sala" e
  "Entrar em uma sala", e `display: standalone`.
- Service worker com `autoUpdate` (Workbox): o app abre instantâneo e se atualiza sozinho.
- Ícones gerados por script próprio (`npm run icons`), sem dependência de biblioteca de imagem.
- Tema claro e escuro, respeitando o sistema, e `prefers-reduced-motion` para quem prefere menos
  animação.

Offline você consegue abrir o app e ver a tela inicial, mas sala é coisa de gente conectada:
sem rede não dá para entrar nem sortear.

## Publicando

O jeito mais simples é subir **um serviço só** (Render, Railway, Fly, uma VM qualquer):

```bash
npm install && npm run build
npm start        # respeita a variável PORT
```

Se preferir separar front e back (front na Vercel/Netlify, socket em outro lugar), builde o
cliente com `VITE_SERVER_URL=https://sua-api` para ele apontar para o servidor certo.
