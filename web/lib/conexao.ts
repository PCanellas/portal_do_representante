"use client";

import { useSyncExternalStore } from "react";

function assinar(aoMudar: () => void) {
  window.addEventListener("online", aoMudar);
  window.addEventListener("offline", aoMudar);
  return () => {
    window.removeEventListener("online", aoMudar);
    window.removeEventListener("offline", aoMudar);
  };
}

/**
 * Diz se o aparelho enxerga rede, e reage quando isso muda.
 *
 * `navigator.onLine` e otimista: responde true para celular conectado ao wifi
 * da loja que nao tem internet do outro lado. Serve para explicar o que
 * aconteceu, nao para decidir se vale tentar — por isso quem chama sempre
 * oferece o botao de tentar de novo, mesmo quando isto diz que esta online.
 *
 * No servidor responde online: e o que o HTML entregue afirma, e o React
 * precisa que a primeira leitura no navegador diga o mesmo.
 */
export function useConexao() {
  return useSyncExternalStore(
    assinar,
    () => navigator.onLine,
    () => true,
  );
}
