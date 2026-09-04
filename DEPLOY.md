# 🚀 Colocando o Party Games no ar

Supabase (banco) primeiro, Vercel (site) depois — nessa ordem, porque a Vercel precisa das
chaves do Supabase **antes** de construir o site.

Tempo: uns 15 minutos. Custo: zero, nos planos gratuitos dos dois.

---

## Parte 1 — Supabase

### 1.1 Criar o projeto

1. Entre em [supabase.com](https://supabase.com) → **New project**.
2. Nome: `party-games` (ou o que preferir).
3. **Database Password**: gere uma e guarde. Você não vai precisar dela aqui, mas o Supabase
   exige — e é chata de recuperar depois.
4. **Region**: escolha a mais perto de vocês (`South America (São Paulo)` se estiverem no
   Brasil). Isso é o que faz o tempo real parecer instantâneo em vez de "quase".
5. Espere uns 2 minutos até o projeto terminar de subir.

### 1.2 Ligar o login anônimo

**Authentication** → **Providers** (ou **Sign In / Providers**) → **Anonymous sign-ins** →
ligar → **Save**.

> ⚠️ **Sem isso ninguém entra em sala nenhuma.** O app não pede cadastro: ele cria uma sessão
> anônima para cada pessoa, e é o `auth.uid()` dessa sessão que amarra a pessoa ao assento dela.

### 1.3 Criar o banco

1. **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/tudo.sql` do projeto, copie **tudo** e cole lá.
3. **Run** (ou `Ctrl+Enter`).

Deve aparecer *Success. No rows returned*. Esse arquivo cria as tabelas, as políticas de
segurança, as ~30 funções de jogo, as 259 cartas e liga o tempo real.

> Pode rodar de novo quando quiser: o script recria o baralho e substitui as funções sem
> duplicar nada.
>
> Se preferir por partes, rode `01_schema` → `02_policies` → `03_funcoes` → `04_seed` →
> `05_realtime`, nessa ordem. O `tudo.sql` é exatamente a soma dos cinco.

### 1.4 Copiar as chaves

**Project Settings** → **API** (a URL) e **API Keys** (as chaves):

| No painel | Você vai usar como |
| --- | --- |
| **Project URL** | `VITE_SUPABASE_URL` |
| **Publishable key** (`sb_publishable_…`) | `VITE_SUPABASE_ANON_KEY` |

Em projetos mais antigos a chave pública aparece como **`anon` `public`**, no formato
`eyJhbGciOi…`. As duas funcionam igual no app.

> 🔒 **A chave pública é feita para ficar exposta no navegador** — quem protege os dados é o
> RLS, não o sigilo dela.
>
> Já a **chave secreta** (`sb_secret_…`, antes `service_role`) ignora **todas** as políticas
> de segurança. Ela nunca vai para o front, nem para o `.env` deste projeto, nem para a
> Vercel. Se ela escapar em algum lugar — print, chat, commit — revogue e gere outra em
> **Project Settings → API Keys**.

### 1.5 Testar antes de publicar

No projeto, crie o `.env`:

```bash
cp .env.example .env      # e cole as duas chaves
npm run checar
```

O `npm run checar` faz o caminho completo contra o seu Supabase: cria sessão anônima, abre uma
sala, entra com uma segunda pessoa, começa uma partida, confere se o segredo do jogo fica
escondido de quem não deve ver e testa o tempo real. Se algo estiver faltando, ele diz o que é
e onde arrumar.

```
✓ sessão anônima criada
✓ 259 cartas no baralho
✓ sala criada com o código K3PT
✓ segunda pessoa entrou pelo código
✓ RLS funcionando: a palavra secreta só chega em quem faz a mímica
✓ Realtime conectado
✅ Tudo pronto! Pode chamar a galera.
```

Rode também `npm run dev` e abra em duas abas para ver a sincronização acontecendo.

---

## Parte 2 — Vercel

### 2.1 Mandar o código para o GitHub

Se ainda não for um repositório:

```bash
git init
git add .
git commit -m "Party Games — sala multiplayer em tempo real"
```

Crie um repositório vazio no GitHub e:

```bash
git remote add origin https://github.com/SEU-USUARIO/party-games.git
git branch -M main
git push -u origin main
```

> O `.env` **não** vai junto: ele está no `.gitignore`. As chaves entram direto na Vercel.

### 2.2 Importar na Vercel

1. [vercel.com](https://vercel.com) → **Add New…** → **Project**.
2. **Import** no repositório do GitHub.
3. A Vercel detecta o Vite sozinha. Confira apenas:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`

### 2.3 As variáveis de ambiente — o passo que todo mundo erra

Ainda **na tela de import**, abra **Environment Variables** e adicione as duas:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` |

Marque as três caixas: **Production**, **Preview** e **Development**.

> ⚠️ **Por que isso importa tanto:** o Vite embute essas variáveis no código **durante o
> build**. Elas não são lidas quando alguém abre o site — já estão lá dentro. Se você adicionar
> as variáveis depois do primeiro deploy, o site continuará mostrando a tela de "falta conectar
> o Supabase" até você **fazer um novo deploy**.
>
> Se cair nessa: **Deployments** → nos três pontinhos do último deploy → **Redeploy**.

### 2.4 Deploy

**Deploy** e espere ~1 minuto. A Vercel devolve algo como
`https://party-games-xxxx.vercel.app`.

---

## Parte 3 — Conferir se funcionou

Abra a URL da Vercel e faça o teste que importa:

1. **No computador:** crie uma sala e copie o link.
2. **No celular:** abra o link (pode ser pelo WhatsApp mesmo) e entre com outro apelido.
3. **No computador:** você deve ver a pessoa aparecer na lista **na hora**, sem recarregar.
4. Escolha **Mímica** e comece: a palavra secreta aparece só na tela de quem está representando.
5. Recarregue a página no celular: tem que voltar direto para a sala, sem perguntar nada.

Se quiser conferir a instalação de produção pelo terminal:

```bash
npm run checar -- https://xxxxx.supabase.co eyJhbGciOi...
```

---

## Se algo der errado

| O que você vê | O que é | Como arrumar |
| --- | --- | --- |
| Tela "Falta conectar o Supabase" | As variáveis não estavam lá na hora do build | Adicione as duas e **Redeploy** (§2.3) |
| "Não achei nenhuma sala com esse código" logo ao criar | O SQL não foi aplicado | Cole o `supabase/tudo.sql` no SQL Editor |
| Trava ao entrar, sem mensagem | Login anônimo desligado | §1.2 |
| Link `/sala/ABCD` dá **404** | Falta o `vercel.json` no repositório | Ele já está no projeto — confirme que subiu no commit |
| Lista de jogadores não atualiza sozinha | Realtime não publicado | Rode o `supabase/05_realtime.sql` |
| "Limite de novas sessões atingido" | Muita gente na mesma rede: a Vercel vê um IP só | **Authentication → Rate Limits** → aumente o limite de sign-ups por hora |
| Depois de uns dias, tudo para | Projeto free do Supabase pausa sem uso | Abra o painel do Supabase e clique em **Restore** |

Onde olhar os erros:

- **Vercel** → Deployments → o deploy → **Building** (erro de build) ou **Functions/Logs**.
- **Supabase** → **Logs** → `Auth` (login) e `Postgres` (erros das funções de jogo).
- **Navegador** → DevTools → Console (F12).

---

## Depois que estiver no ar

**Domínio próprio:** Vercel → Settings → Domains. O link da sala fica mais bonito no grupo.

**Atualizando:** todo `git push` na `main` publica sozinho. Se mexer no SQL, rode o
`npm run sql:combinar` e cole o `tudo.sql` atualizado no SQL Editor — o banco não é atualizado
pelo deploy.

**Antes de publicar mudanças:**

```bash
npm run test:sql && npm test && npm run build
```

**Limites do plano gratuito** (folgados para jogar com amigos): o Supabase free dá 500 MB de
banco, 200 conexões simultâneas de Realtime e pausa o projeto após ~1 semana sem nenhum acesso.
A Vercel free entrega o site sem limite prático para esse tamanho de uso.
