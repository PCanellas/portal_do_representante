"use client";

import { useEffect } from "react";

/**
 * Liga o service worker e pede que o navegador nao descarte o que guardamos.
 *
 * O service worker existe para uma coisa so: abrir o app sem sinal na tela
 * /offline, em vez da pagina de erro do navegador. O que ele nao faz esta
 * anotado no proprio public/sw.js.
 *
 * O armazenamento duravel vale por si, com ou sem service worker: sem o
 * pedido, o navegador pode apagar o catalogo e o rascunho quando o aparelho
 * ficar sem espaco — e o momento em que isso doeria e exatamente o que este
 * trabalho existe para cobrir.
 *
 * Nada aqui e obrigatorio: navegador sem suporte segue como antes.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    // Em desenvolvimento nao: o HMR reescreve os pedacos do build a cada
    // salvamento, e um service worker guardando isso serve arquivo de uma
    // versao que ja nao existe. O sintoma e mudanca que nao aparece na tela,
    // e a causa nao e obvia.
    if (process.env.NODE_ENV !== "production") return;

    // navigator.serviceWorker so existe em contexto seguro: HTTPS ou
    // localhost. Aberto pelo IP da rede local (http://192.168.x.x) nao ha o
    // que registrar, e o app segue online, sem a tela de sem-sinal.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((erro) => {
        // falhar aqui custa a tela offline, nao o app: registra e segue
        console.error("[sw] registro falhou", erro);
      });
    }

    // Independente do service worker: pede ao navegador que nao descarte o
    // catalogo e o rascunho quando o aparelho ficar sem espaco. Instalado na
    // tela inicial, costuma ser aceito sem perguntar nada.
    void navigator.storage?.persist?.();
  }, []);

  return null;
}
