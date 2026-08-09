import type { MetadataRoute } from "next";

/**
 * Manifest do PWA. O Next serve isto em /manifest.webmanifest e injeta o
 * <link rel="manifest"> sozinho — o proxy ja deixa essa rota passar sem
 * sessao, porque o navegador busca o manifest sem enviar cookie.
 *
 * Sem service worker de proposito: o app depende do servidor para consultar
 * e gravar, entao "funcionar offline" seria uma promessa falsa. O que isto
 * entrega e o icone na tela inicial e a abertura em tela cheia.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // fixo: e a identidade do app para o sistema, mesmo que start_url mude
    id: "/",
    name: "Innecco Representações",
    short_name: "Innecco",
    description: "Consulta de preços e orçamentos — soluções em iluminação.",
    lang: "pt-BR",
    dir: "ltr",
    // a raiz decide entre /home e /login conforme a sessao
    start_url: "/",
    scope: "/",
    display: "standalone",
    // igual ao fundo do icone: a tela de abertura nao mostra emenda
    background_color: "#00112A",
    theme_color: "#00112A",
    categories: ["business", "productivity"],
    // Os dois arquivos servem aos dois propositos: sao full bleed (sem canto
    // transparente) e a marca cabe na area segura central, entao o recorte
    // redondo do Android nao corta nada. Vao repetidos porque o tipo do Next
    // nao aceita o "any maskable" numa linha so.
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icone-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icone-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
