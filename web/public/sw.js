/**
 * Service worker do app.
 *
 * Faz uma coisa so: quando o app e aberto sem sinal, entrega a tela /offline
 * em vez da pagina de erro do navegador. Sem ele o navegador precisa da rede
 * para receber o HTML, e nao ha app nenhum para mostrar.
 *
 * A versao anterior tentava mais e quebrou o app em producao. Dois erros,
 * anotados para nao se repetirem:
 *
 * 1. Ela guardava as paginas internas e, quando a rede falhava, devolvia o
 *    HTML de /offline mantendo a URL pedida. O navegador recebia o conteudo
 *    de uma pagina com o endereco de outra, o Next hidratava com a arvore
 *    errada e o roteador estourava. Agora e um REDIRECIONAMENTO: o endereco
 *    passa a ser /offline de verdade, e conteudo e URL voltam a bater.
 *
 * 2. Ela cacheava HTML de pagina autenticada, o que trazia junto a pergunta
 *    de quando invalidar e o risco de servir a tela de um usuario que ja
 *    saiu. Aqui nao se guarda pagina interna nenhuma — offline o app leva
 *    para /offline, que e a unica tela que funciona sem servidor mesmo.
 *
 * Trocar de tela com o app aberto continua precisando de rede: `<Link>` pede
 * o payload RSC ao servidor. Quem trata esse caso e o error.tsx de (interno),
 * nao daqui — service worker nao tem como responder um payload RSC que ele
 * nunca viu.
 */

const VERSAO = "v3";
const CASCA = `innecco-casca-${VERSAO}`;
const ESTATICO = `innecco-estatico-${VERSAO}`;
const OFFLINE = "/offline";

const ESSENCIAIS = [OFFLINE, "/logo-marca.png", "/logo-simbolo.png"];

/**
 * Os arquivos de JS e CSS que uma pagina precisa, lidos do HTML dela.
 *
 * O flight do React vem dentro de <script> com as barras escapadas, e parte
 * dos pedacos so aparece la — por isso desescapa antes e varre o documento
 * inteiro, em vez de olhar so os atributos src e href.
 */
function estaticosDe(html) {
  const texto = html.replace(/\\\//g, "/");
  const achados =
    texto.match(/\/_next\/static\/[A-Za-z0-9._/-]+\.(?:js|css)/g) || [];
  return [...new Set(achados)];
}

/**
 * Guarda a /offline e tudo que ela precisa para renderizar.
 *
 * Guardar so o HTML nao basta, e foi o que quebrou em producao: a pagina
 * aparecia e a hidratacao morria num pedaco de JS que nunca tinha sido
 * pedido com internet, entao o erro do Next cobria a tela. Sem sinal nao ha
 * segunda chance de buscar o que falta — ou esta tudo aqui agora, ou a tela
 * nao existe.
 *
 * Cada arquivo entra por conta propria: com addAll, um 404 num pedaco
 * derrubaria a instalacao inteira e o app ficaria sem service worker nenhum.
 */
async function precachear() {
  const casca = await caches.open(CASCA);
  await casca.addAll(ESSENCIAIS);

  const html = await (await casca.match(OFFLINE)).text();
  const estatico = await caches.open(ESTATICO);
  await Promise.all(
    estaticosDe(html).map((url) => estatico.add(url).catch(() => {})),
  );
}

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    // nao espera a aba antiga fechar: no celular ele raramente fecha o app,
    // e a correcao ficaria semanas sem chegar
    precachear().then(() => self.skipWaiting()),
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

// O JS e o CSS carregam o hash do conteudo no nome: mudou o conteudo, mudou a
// URL. Nao ha o que invalidar, e sem eles em cache a /offline nao renderiza.
const ehEstatico = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/fontes/");

async function paginaOuOffline(requisicao) {
  try {
    return await fetch(requisicao);
  } catch {
    const guardada = await caches.match(OFFLINE);
    if (!guardada) throw new Error("sem /offline em cache");
    // redireciona em vez de devolver a /offline no lugar da URL pedida: e a
    // diferenca entre o app abrir e o roteador estourar
    return Response.redirect(new URL(OFFLINE, self.location.origin).href, 302);
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

  // POST e server action nao se guardam nem se repetem: reenviar o que ja
  // foi enviado gravaria orcamento em dobro
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // a propria /offline vem do cache quando a rede falha; sem esta excecao o
  // redirecionamento acima cairia nela mesma, em laco
  if (request.mode === "navigate" && url.pathname === OFFLINE) {
    evento.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE)),
    );
    return;
  }

  if (request.mode === "navigate") {
    evento.respondWith(paginaOuOffline(request));
    return;
  }

  // Guardar no precache nao adianta se o fetch nunca olhar la. O logo estava
  // guardado desde o inicio e mesmo assim aparecia quebrado sem sinal: ele
  // nao e navegacao nem /_next/static, entao caia na rede como qualquer
  // outra coisa e falhava.
  if (ESSENCIAIS.includes(url.pathname)) {
    evento.respondWith(
      caches.match(request).then((guardada) => guardada || fetch(request)),
    );
    return;
  }

  if (ehEstatico(url)) {
    evento.respondWith(cachePrimeiro(request));
  }
});
