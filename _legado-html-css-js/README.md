# 🎲 Sorteia Aí

PWA mobile-first que acaba com o **“o que vamos jogar?”**: sorteia a brincadeira, mostra as
regras e conduz cada rodada. Seis jogos rápidos para a turma jogar junto, na mesma mesa ou
pelo link da sala.

HTML, CSS e JavaScript puro. **Sem build, sem dependências, sem backend.**

## Como rodar

**Jeito mais rápido (Windows):** dê dois cliques em **`abrir-app.bat`**. Ele entra na pasta
certa sozinho, procura Python ou Node, sobe o servidor e já abre o navegador. Para parar,
aperte `Ctrl+C` na janela preta.

O app precisa de um servidor HTTP para o service worker e o manifest funcionarem
(abrir o `index.html` com duplo clique carrega a interface, mas sem instalação nem offline).
Se preferir digitar, escolha um dos comandos abaixo **dentro da pasta do projeto**:

```bash
# Python (já vem no Windows/macOS/Linux)
python -m http.server 8080

# Node, sem instalar nada
npx serve .          # ou: npx http-server -p 8080
```

Depois abra <http://localhost:8080>.

No VS Code, a extensão **Live Server** também serve: botão direito no `index.html` →
*Open with Live Server*.

> **Deu erro no terminal?** O caminho desta pasta tem espaços e acentos
> (`Área de Trabalho`, `Projetos - Claude VSCode`), então o `cd` precisa de aspas:
>
> ```bash
> cd "C:\Users\arthu\OneDrive\Área de Trabalho\Projetos - Claude VSCode\Nova pasta"
> ```
>
> Se aparecer *"python não é reconhecido"*, tente `py -m http.server 8080` ou use o
> `abrir-app.bat`, que já testa as duas formas. E se a porta 8080 estiver ocupada, troque o
> número: `python -m http.server 3000`.

### Testando como PWA

1. Abra no Chrome ou Edge e vá em **DevTools → Application**.
2. Em *Manifest* aparecem nome, ícones e atalhos; em *Service Workers*, o `sw.js` ativo.
3. Marque **Offline** em *Service Workers* e recarregue: o app abre normalmente.
4. Para instalar, use o ícone na barra de endereço ou o botão **Instalar app** da tela inicial.

> Em celular, a instalação só aparece em **HTTPS** (ou `localhost`). Para testar no celular da
> mesma rede, use algo como `npx localtunnel --port 8080` ou publique numa hospedagem estática
> (GitHub Pages, Netlify, Vercel) — como não há backend, basta subir os arquivos.

## Estrutura

```
.
├── index.html                 as três telas (início, lista e jogo) em um arquivo só
├── manifest.webmanifest       nome, ícones, cores e atalhos do PWA
├── sw.js                      service worker: cache da casca + offline
├── assets/
│   ├── css/estilos.css        design system inteiro (tokens, telas, componentes)
│   ├── js/dados.js            catálogo de jogos, regras e baralhos de desafios
│   ├── js/app.js              rotas, painéis de cada jogo, sorteio, cronômetro
│   └── icons/                 ícones do PWA (PNG + favicon SVG)
├── ferramentas/
│   └── gerar-icones.mjs       regera os PNGs sem lib de imagem: node ferramentas/gerar-icones.mjs
└── _legado-react-node/        versão anterior (React + Vite + Socket.IO), guardada
```

## Os seis jogos

| Jogo | O que o app faz na rodada |
| --- | --- |
| 🔤 **C, S, Composto** | Sorteia a categoria e lembra a ordem: com C → com S → composta |
| 🔗 **Palavra Parecida** | Sorteia a palavra que abre a corrente de associações |
| 🕵️ **Quem Sou Eu?** | Sorteia um personagem com a carta virada, com dica para o grupo |
| 🎭 **Mímica** | Palavra secreta escondida + cronômetro de 60s e placar de acertos |
| 🎲 **Verdade ou Desafio** | Você escolhe o lado e ele sorteia a pergunta ou o desafio leve |
| 🤥 **Duas Verdades e Uma Mentira** | Sorteia quem fala e sugere um tema; a lista de jogadores fica salva |

Todo o conteúdo mora em [`assets/js/dados.js`](assets/js/dados.js): dá para adicionar jogos,
trocar regras ou aumentar os baralhos sem tocar no resto do código.

## Como funciona a “sala” sem backend

Cada pessoa que abre o app ganha um código de 4 letras na URL (`?sala=ABCD`). Esse código é a
**semente do sorteio**: o baralho é embaralhado de forma determinística a partir dele, então
duas pessoas na mesma sala, na mesma rodada, veem exatamente a mesma carta — cada uma no seu
celular, sem servidor nenhum no meio.

O botão **Compartilhar link da sala** usa a API nativa de compartilhamento (ou copia o link).
Basta o grupo avançar as rodadas junto.

Como o embaralhamento percorre o baralho inteiro antes de repetir, nenhuma carta sai duas vezes
enquanto houver conteúdo novo.

## Detalhes de implementação

- **Navegação por hash** (`#/inicio`, `#/jogos`, `#/jogo/mimica`): recarregar a página mantém a
  tela, e o link de um jogo específico pode ser compartilhado.
- **Estado salvo no `localStorage`**: rodada atual, placar da mímica, lista de participantes e o
  código da sala sobrevivem ao fechar o app.
- **Acessibilidade**: navegação por teclado com foco visível, `aria-live` na área de jogo e no
  sorteio, foco movido para o título a cada troca de tela, link de pular para o conteúdo, alvos
  de toque com no mínimo 44px e contraste alto no texto.
- **Movimento reduzido**: quem liga *prefers-reduced-motion* no sistema não vê animações.
- **Offline**: a casca do app é pré-cacheada na instalação; navegação usa rede primeiro com
  fallback para o cache. Ao mudar arquivos, troque a constante `VERSAO` no `sw.js`.

## Versão anterior

A implementação em React + Vite + Node/Socket.IO ficou preservada em `_legado-react-node/`
(inclusive o `node_modules`). Ela não interfere neste projeto e pode ser apagada quando não
fizer mais falta.
