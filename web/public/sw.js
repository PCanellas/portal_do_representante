/**
 * Service worker do app.
 *
 * Existe por um motivo so: sem ele, abrir o app sem sinal nao abre nada. O
 * navegador pede o HTML ao servidor, nao recebe, e mostra a tela de erro —
 * mesmo com os 2.693 produtos ja gravados no aparelho, atras de uma porta
 * trancada. Aqui a porta passa a abrir com o que ja esta guardado.
 *
 * Escrito a mao, sem Workbox: sao tres regras de cache, e uma dependencia de
 * build para gerar isto custaria mais para entender do que o arquivo inteiro.
 *
 * As regras:
 *   navegacao      rede primeiro, cache depois, /offline como ultimo recurso.
 *                  Rede primeiro porque preco desatualizado e pior do que
 *                  esperar meio segundo.
 *   /_next/static  cache primeiro. O nome do arquivo carrega o hash do
 *                  conteudo: mudou o conteudo, mudou a URL, nao ha o que
 *                  invalidar.
 *   fontes         cache primeiro, mesmo motivo.
 *
 * O resto passa direto. A API do catalogo em especial: quem guarda aquilo e
 * o React Query, no localStorage, e duas copias do mesmo dado divergiriam.
 */

const VERSAO = "v1";
const CASCA = `innecco-casca-${VERSAO}`;
const ESTATICO = `innecco-estatico-${VERSAO}`;
const OFFLINE = "/offline";

// O minimo para a tela de consulta existir sem rede. O JS e o CSS entram
// sozinhos, pela regra de /_next/static, na primeira visita com sinal.
const ESSENCIAIS = [OFFLINE, "/logo-marca.png", "/logo-simbolo.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CASCA)
      .then((cache) => cache.addAll(ESSENCIAIS))
      // uma versao nova nao espera a aba antiga fechar: no celular ele
      // raramente fecha o app, e a correcao ficaria semanas sem chegar
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes
            .filter((n) => n.startsWith("innecco-") && !n.endsWith(VERSAO))
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Sair da conta apaga a casca gravada.
 *
 * O HTML guardado foi renderizado no servidor com a sessao dele dentro —
 * tem o nome no cabecalho. Sem isto, sair e reabrir sem rede mostraria a
 * tela de quem saiu.
 */
self.addEventListener("message", (evento) => {
  if (evento.data === "limpar-casca") {
    evento.waitUntil(
      caches
        .delete(CASCA)
        .then(() => caches.open(CASCA))
        .then((cache) => cache.addAll(ESSENCIAIS)),
    );
  }
});

const ehEstatico = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fontes/");

async function redePrimeiro(requisicao) {
  try {
    const resposta = await fetch(requisicao);

    // `redirected` e o que separa a pagina pedida da que o servidor entregou
    // no lugar dela. Com a sessao vencida, /produtos responde 200 — mas o
    // corpo e o do /login, porque o fetch seguiu o redirecionamento do proxy.
    // Guardar isso gravaria a tela de login sob a chave de /produtos, e o app
    // sem sinal abriria num login que nao tem como funcionar, com o catalogo
    // do aparelho inalcancavel atras dele.
    if (resposta.ok && resposta.type === "basic" && !resposta.redirected) {
      const cache = await caches.open(CASCA);
      cache.put(requisicao, resposta.clone());
    }
    return resposta;
  } catch {
    const guardada = await caches.match(requisicao, { ignoreSearch: true });
    return guardada ?? (await caches.match(OFFLINE)) ?? Response.error();
  }
}

async function cachePrimeiro(requisicao) {
  const guardada = await caches.match(requisicao);
  if (guardada) return guardada;

  const resposta = await fetch(requisicao);
  if (resposta.ok) {
    const cache = await caches.open(ESTATICO);
    cache.put(requisicao, resposta.clone());
  }
  return resposta;
}

self.addEventListener("fetch", (evento) => {
  const { request } = evento;

  // POST e server action nao se guardam: mandar de novo o que ja foi
  // enviado gravaria orcamento em dobro
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    evento.respondWith(redePrimeiro(request));
    return;
  }

  if (ehEstatico(url)) {
    evento.respondWith(cachePrimeiro(request));
  }
});
