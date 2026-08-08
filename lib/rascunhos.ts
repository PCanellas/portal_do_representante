"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ItemCarrinho } from "@/lib/carrinho";

/**
 * Orcamentos guardados no aparelho, ainda nao enviados.
 *
 * "Rascunho" aqui quer dizer exatamente isto: existe so neste celular. O
 * que chega ao banco ja nasce como enviado — nao ha status de rascunho do
 * lado do servidor.
 *
 * Nome do cliente e da empresa ficam copiados junto de proposito: a lista
 * precisa mostra-los sem depender do servidor, que e justamente o que
 * pode estar fora do ar quando ele volta para o rascunho.
 */
export type Rascunho = {
  id: string; // uuid gerado aqui, nunca vai para o banco
  id_cliente: string | null;
  cliente: string;
  id_fabricante: string | null;
  fabricante: string;
  itens: ItemCarrinho[];
  percentual_desconto: number;
  total: number;
  atualizado_em: string; // ISO
};

type EstadoRascunhos = {
  rascunhos: Rascunho[];
  guardar: (rascunho: Rascunho) => void;
  remover: (id: string) => void;
};

export const useRascunhos = create<EstadoRascunhos>()(
  persist(
    (set, get) => ({
      rascunhos: [],

      guardar: (rascunho) => {
        const outros = get().rascunhos.filter((r) => r.id !== rascunho.id);
        // mais recente primeiro: e o que ele vai querer retomar
        set({ rascunhos: [rascunho, ...outros] });
      },

      remover: (id) =>
        set({ rascunhos: get().rascunhos.filter((r) => r.id !== id) }),
    }),
    {
      name: "innecco-rascunhos",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ rascunhos }) => ({ rascunhos }),
      // sem isto o servidor renderiza sem rascunhos, o cliente renderiza com
      // eles, e o React reclama de hidratacao divergente
      skipHydration: true,
    },
  ),
);

// alguem precisa pedir a leitura; no navegador, ao carregar o modulo
if (typeof window !== "undefined") {
  void useRascunhos.persist.rehydrate();
}

/**
 * Diz quando os rascunhos ja vieram do localStorage.
 *
 * useSyncExternalStore em vez de efeito com setState: o localStorage e uma
 * fonte externa, e e ele quem resolve a diferenca entre o HTML do servidor
 * (sempre sem rascunhos) e o estado do navegador.
 */
export function useRascunhosProntos() {
  return useSyncExternalStore(
    (aoMudar) => useRascunhos.persist.onFinishHydration(aoMudar),
    () => useRascunhos.persist.hasHydrated(),
    () => false,
  );
}

/** uuid do proprio navegador — o mesmo formato que o banco usa. */
export function novoIdRascunho() {
  return crypto.randomUUID();
}
