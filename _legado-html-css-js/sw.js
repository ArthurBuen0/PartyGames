/**
 * Sorteia Aí — service worker.
 *
 * Estratégias:
 *   • navegação (abrir o app)  → rede primeiro, cai para o cache se estiver offline
 *   • arquivos do próprio app  → cache primeiro, com atualização em segundo plano
 *   • fontes do Google         → cache primeiro, em um cache separado e duradouro
 *
 * Ao mexer nos arquivos da casca, troque a VERSAO: isso invalida o cache antigo.
 */

const VERSAO = "sorteia-ai-v1";
const CACHE_CASCA = VERSAO + "-casca";
const CACHE_FONTES = "sorteia-ai-fontes";

/** Arquivos que o app precisa para abrir offline. */
const CASCA = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/estilos.css",
  "./assets/js/dados.js",
  "./assets/js/app.js",
  "./assets/icons/favicon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png",
  "./assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_CASCA)
      // addAll é tudo-ou-nada; um arquivo opcional que falhe derrubaria a instalação
      .then((cache) => Promise.allSettled(CASCA.map((arquivo) => cache.add(arquivo))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes
            .filter((nome) => nome !== CACHE_CASCA && nome !== CACHE_FONTES)
            .map((nome) => caches.delete(nome))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;

  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);
  const ehFonte =
    url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

  // Fontes: cache primeiro, guardadas para sempre (o nome do arquivo muda a cada versão)
  if (ehFonte) {
    evento.respondWith(
      caches.open(CACHE_FONTES).then(async (cache) => {
        const guardada = await cache.match(requisicao);
        if (guardada) return guardada;
        try {
          const resposta = await fetch(requisicao);
          if (resposta && (resposta.ok || resposta.type === "opaque")) {
            cache.put(requisicao, resposta.clone());
          }
          return resposta;
        } catch (erro) {
          // Sem rede e sem cache: a tipografia cai no stack do sistema
          return Response.error();
        }
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegação: tenta a rede para pegar novidades, mas nunca deixa na mão
  if (requisicao.mode === "navigate") {
    evento.respondWith(
      fetch(requisicao)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE_CASCA).then((cache) => cache.put("./index.html", copia));
          return resposta;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_CASCA);
          return (await cache.match("./index.html")) || (await cache.match("./"));
        })
    );
    return;
  }

  // Demais arquivos do app: responde do cache e atualiza por baixo dos panos
  evento.respondWith(
    caches.open(CACHE_CASCA).then(async (cache) => {
      const guardada = await cache.match(requisicao);

      const daRede = fetch(requisicao)
        .then((resposta) => {
          if (resposta && resposta.ok) cache.put(requisicao, resposta.clone());
          return resposta;
        })
        .catch(() => null);

      return guardada || (await daRede) || Response.error();
    })
  );
});
