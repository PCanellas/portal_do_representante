"use client";

import { useEffect } from "react";

/**
 * Liga o service worker e pede que o navegador nao descarte o que guardamos.
 *
 * O pedido de armazenamento durável importa mais do que parece: sem ele o
 * navegador pode apagar o catalogo e o rascunho quando o aparelho ficar sem
 * espaco, e o momento em que isso doeria e exatamente o que este trabalho
 * todo existe para cobrir — dentro da loja, sem sinal. Instalado na tela
 * inicial, o pedido costuma ser aceito sem perguntar nada.
 *
 * Nada aqui e obrigatorio para o app funcionar: navegador sem suporte, ou
 * servido sem HTTPS, simplesmente segue online como antes.
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
    // que registrar, e o app segue online, sem modo offline.
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((erro) => {
      // falhar aqui custa o modo offline, nao o app: registra e segue
      console.error("[sw] registro falhou", erro);
    });

    void navigator.storage?.persist?.();
  }, []);

  return null;
}

/**
 * Apaga a casca guardada. Chamado ao sair da conta: o HTML em cache foi
 * renderizado com a sessao dentro e traz o nome dele no cabecalho.
 */
export async function limparCascaOffline() {
  const registro = await navigator.serviceWorker?.ready?.catch(() => null);
  registro?.active?.postMessage("limpar-casca");
}
