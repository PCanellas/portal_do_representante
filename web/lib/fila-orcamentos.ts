"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  salvarOrcamento,
  type EntradaOrcamento,
} from "@/app/(interno)/orcamentos/actions";

/**
 * Orcamentos fechados sem sinal, esperando a vez de subir.
 *
 * O aparelho e um so e quem usa e uma pessoa so, entao nao existe conflito
 * para resolver aqui: a fila e uma lista, quase sempre com um item, e sobe
 * na ordem em que foi fechada.
 *
 * O preco continua sendo decidido pelo banco — a action nao confia no que o
 * aparelho manda, e isso nao muda. O que muda e o momento: offline a conta
 * sai com o preco guardado no aparelho e so e conferida na hora de subir.
 * Se o total divergir, a tela avisa; o que fica gravado e o do banco, e ele
 * decide o que fazer com o papel que ja mostrou ao cliente.
 *
 * A janela para isso acontecer e estreita: exige uma carga de tabela nova
 * entre fechar o orcamento e a fila esvaziar. Estreita nao e nenhuma, e um
 * aviso custa menos do que descobrir pela reclamacao do cliente.
 */

export type OrcamentoPendente = {
  /** id do orcamento, escolhido aqui. Vai junto e torna o reenvio seguro. */
  id: string;
  entrada: EntradaOrcamento;
  /** copia do que a lista precisa mostrar antes de existir no servidor */
  cliente: string;
  fabricante: string;
  valor_total: number;
  criado_em: string;
};

export type ResultadoSincronizacao = {
  enviados: number;
  /** subiu, mas o total do banco nao bateu com o calculado no aparelho */
  divergentes: { numero: number; local: number; servidor: number }[];
  /** o servidor recusou; tentar de novo daria no mesmo */
  recusados: { cliente: string; erro: string }[];
};

const NADA_A_FAZER: ResultadoSincronizacao = {
  enviados: 0,
  divergentes: [],
  recusados: [],
};

type EstadoFila = {
  pendentes: OrcamentoPendente[];
  /** true enquanto uma tentativa de envio esta em andamento */
  enviando: boolean;
};

type AcoesFila = {
  enfileirar: (pendente: OrcamentoPendente) => void;
  descartar: (id: string) => void;
  sincronizar: () => Promise<ResultadoSincronizacao>;
};

export const useFilaOrcamentos = create<EstadoFila & AcoesFila>()(
  persist(
    (set, get) => ({
      pendentes: [],
      enviando: false,

      enfileirar: (pendente) =>
        set({ pendentes: [...get().pendentes, pendente] }),

      descartar: (id) =>
        set({ pendentes: get().pendentes.filter((p) => p.id !== id) }),

      sincronizar: async () => {
        const { pendentes, enviando } = get();
        if (enviando || pendentes.length === 0) return NADA_A_FAZER;

        set({ enviando: true });
        const resultado: ResultadoSincronizacao = {
          enviados: 0,
          divergentes: [],
          recusados: [],
        };

        try {
          for (const pendente of pendentes) {
            let r;
            try {
              r = await salvarOrcamento(pendente.entrada);
            } catch {
              // nao chegou ao servidor: para por aqui e tenta na proxima vez,
              // preservando a ordem de quem ainda nao subiu
              break;
            }

            if (!r.ok) {
              // Recusa nao se resolve insistindo — produto que ficou inativo,
              // cliente apagado. Sai da fila para nao travar quem esta atras,
              // e a tela conta o que houve.
              resultado.recusados.push({
                cliente: pendente.cliente,
                erro: r.erro,
              });
              get().descartar(pendente.id);
              continue;
            }

            if (Math.abs(r.valor_total - pendente.valor_total) >= 0.01) {
              resultado.divergentes.push({
                numero: r.numero,
                local: pendente.valor_total,
                servidor: r.valor_total,
              });
            }

            get().descartar(pendente.id);
            resultado.enviados += 1;
          }
        } finally {
          set({ enviando: false });
        }

        return resultado;
      },
    }),
    {
      name: "innecco-fila",
      storage: createJSONStorage(() => localStorage),
      // `enviando` e estado do instante; gravado, um app fechado no meio do
      // envio voltaria com a fila travada para sempre
      partialize: ({ pendentes }) => ({ pendentes }),
      // mesmo motivo do carrinho: o servidor renderiza a fila vazia, e trocar
      // o conteudo antes do React comparar as arvores acusaria divergencia
      skipHydration: true,
      version: 1,
    },
  ),
);

const assinarHidratacao = (aoTerminar: () => void) =>
  useFilaOrcamentos.persist.onFinishHydration(aoTerminar);

/** Le a fila do disco e diz quando terminou. Ver useRascunho, em carrinho.ts. */
export function useFilaHidratada() {
  const hidratada = useSyncExternalStore(
    assinarHidratacao,
    () => useFilaOrcamentos.persist.hasHydrated(),
    () => false,
  );

  useEffect(() => {
    if (!useFilaOrcamentos.persist.hasHydrated()) {
      void useFilaOrcamentos.persist.rehydrate();
    }
  }, []);

  return hidratada;
}
