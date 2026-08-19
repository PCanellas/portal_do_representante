"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Produto } from "@/lib/catalogo";
import { PRAZO_PADRAO } from "@/lib/orcamento";

/**
 * O orcamento em edicao.
 *
 * Um orcamento por vez: ele atende um cliente de cada vez.
 *
 * O rascunho fica gravado no aparelho. Antes era estado de memoria pura, e
 * bastava o iOS reciclar a memoria do app em segundo plano — trocar para o
 * WhatsApp e responder o cliente ja e suficiente — para os itens sumirem
 * sem aviso. Ele so descobriria na volta, com a tela em branco.
 *
 * O rascunho e apagado quando termina de verdade: ao salvar e ao recomecar
 * do zero. Nao e apagado por entrar na tela, que era o que fazia antes.
 */

export type ItemCarrinho = {
  // os campos abaixo sao congelados no item: a tabela do fabricante muda,
  // o orcamento ja emitido nao
  id_produto: string;
  referencia: string;
  variante: string;
  descricao: string;
  preco_unitario: number;
  porcentagem_imposto: number;
  quantidade: number;
  percentual_desconto: number;
};

export type EstadoCarrinho = {
  /** id no banco; null enquanto o orcamento nao foi salvo */
  id: string | null;
  numero: number | null;
  id_cliente: string | null;
  id_fabricante: string | null;
  itens: ItemCarrinho[];
  percentual_desconto: number;
  /** Prazo de pagamento em dias. Sempre preenchido; 30 e o padrao. */
  prazo_pagamento: number;
  /** Observacao livre do representante. Vazia quando nao informada. */
  obs: string;
  /** Transportadora combinada, texto livre. Vazia quando nao informada. */
  transportadora: string;
};

type AcoesCarrinho = {
  abrir: (dados: EstadoCarrinho) => void;
  novo: () => void;
  definirCliente: (id: string | null) => void;
  definirFabricante: (id: string) => void;
  adicionar: (produto: Produto, quantidade?: number) => void;
  definirQuantidade: (idProduto: string, quantidade: number) => void;
  definirDescontoItem: (idProduto: string, percentual: number) => void;
  remover: (idProduto: string) => void;
  definirDescontoGlobal: (percentual: number) => void;
  definirPrazoPagamento: (dias: number) => void;
  definirObs: (obs: string) => void;
  definirTransportadora: (transportadora: string) => void;
  sincronizarComCatalogo: (produtos: Produto[]) => void;
};

const VAZIO: EstadoCarrinho = {
  id: null,
  numero: null,
  id_cliente: null,
  id_fabricante: null,
  itens: [],
  percentual_desconto: 0,
  // 30 dias e o prazo mais comum: ja vem escolhido, ele troca se precisar
  prazo_pagamento: PRAZO_PADRAO,
  obs: "",
  transportadora: "",
};

const limitarPercentual = (v: number) =>
  Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;

export const useCarrinho = create<EstadoCarrinho & AcoesCarrinho>()(
  persist(
    (set, get) => ({
      ...VAZIO,

      abrir: (dados) => set({ ...dados }),
      novo: () => set({ ...VAZIO }),

      definirCliente: (id_cliente) => set({ id_cliente }),

      // Trocar de empresa zera os itens: um orcamento e de um fabricante so,
      // e produto de outra empresa nao tem como continuar na lista. Quem
      // chama avisa antes — aqui a regra so e cumprida.
      definirFabricante: (id_fabricante) =>
        set(
          get().id_fabricante === id_fabricante
            ? { id_fabricante }
            : { id_fabricante, itens: [] },
        ),

      adicionar: (produto, quantidade = 1) => {
        const { itens } = get();
        const existente = itens.find((i) => i.id_produto === produto.id);

        // repetir o produto soma na linha que ja existe: duas linhas do
        // mesmo item so confundem na hora de conferir
        if (existente) {
          set({
            itens: itens.map((i) =>
              i.id_produto === produto.id
                ? { ...i, quantidade: i.quantidade + quantidade }
                : i,
            ),
          });
          return;
        }

        set({
          itens: [
            ...itens,
            {
              id_produto: produto.id,
              referencia: produto.referencia,
              variante: produto.variante,
              descricao: produto.descricao,
              preco_unitario: produto.preco_unitario,
              porcentagem_imposto: produto.porcentagem_imposto,
              quantidade,
              percentual_desconto: 0,
            },
          ],
        });
      },

      definirQuantidade: (id_produto, quantidade) =>
        set({
          itens: get().itens.map((i) =>
            i.id_produto === id_produto
              ? {
                  ...i,
                  quantidade: Number.isFinite(quantidade)
                    ? Math.max(0, quantidade)
                    : i.quantidade,
                }
              : i,
          ),
        }),

      definirDescontoItem: (id_produto, percentual) =>
        set({
          itens: get().itens.map((i) =>
            i.id_produto === id_produto
              ? { ...i, percentual_desconto: limitarPercentual(percentual) }
              : i,
          ),
        }),

      remover: (id_produto) =>
        set({
          itens: get().itens.filter((i) => i.id_produto !== id_produto),
        }),

      definirDescontoGlobal: (percentual) =>
        set({ percentual_desconto: limitarPercentual(percentual) }),

      definirPrazoPagamento: (prazo_pagamento) => set({ prazo_pagamento }),

      definirObs: (obs) => set({ obs }),

      definirTransportadora: (transportadora) => set({ transportadora }),

      /**
       * Traz preco, imposto e nome das linhas para o que o catalogo diz agora.
       *
       * Ele corrige o preco de um produto na tela de Produtos e volta para o
       * orcamento que ja tem esse produto: sem isto, a lista do seletor mostra
       * o preco novo e a linha do orcamento continua com o velho, os dois na
       * mesma tela. Pior, ao salvar o servidor releria o preco do banco, e o
       * orcamento gravado sairia diferente do que ele mostrou ao cliente.
       *
       * Rascunho so. Orcamento ja salvo e documento: as linhas dele sao a
       * copia congelada do que foi cotado e nao mudam por baixo.
       *
       * Quantidade e desconto sao dele e nao se tocam. Produto que sumiu do
       * catalogo fica como esta — a tela marca, e o salvamento recusa.
       */
      sincronizarComCatalogo: (produtos) => {
        const { id, itens } = get();
        if (id !== null || itens.length === 0) return;

        const porId = new Map(produtos.map((p) => [p.id, p]));
        let mudou = false;

        const atualizados = itens.map((i) => {
          const p = porId.get(i.id_produto);
          if (
            !p ||
            (p.referencia === i.referencia &&
              p.variante === i.variante &&
              p.descricao === i.descricao &&
              p.preco_unitario === i.preco_unitario &&
              p.porcentagem_imposto === i.porcentagem_imposto)
          ) {
            return i;
          }
          mudou = true;
          return {
            ...i,
            referencia: p.referencia,
            variante: p.variante,
            descricao: p.descricao,
            preco_unitario: p.preco_unitario,
            porcentagem_imposto: p.porcentagem_imposto,
          };
        });

        // sem esta guarda, gravar identico a cada render viraria um laco
        if (mudou) set({ itens: atualizados });
      },
    }),
    {
      name: "innecco-rascunho",
      storage: createJSONStorage(() => localStorage),
      // grava so o orcamento; as acoes sao funcoes e nao vao para o disco
      partialize: ({
        id,
        numero,
        id_cliente,
        id_fabricante,
        itens,
        percentual_desconto,
        prazo_pagamento,
        obs,
        transportadora,
      }) => ({
        id,
        numero,
        id_cliente,
        id_fabricante,
        itens,
        percentual_desconto,
        prazo_pagamento,
        obs,
        transportadora,
      }),
      // O servidor nao tem localStorage e renderiza o carrinho vazio. Deixar
      // o rehydrate automatico rodar na criacao da store trocaria o conteudo
      // antes do React comparar as duas arvores, e a hidratacao acusaria
      // divergencia. Quem chama e o useRascunho, depois da tela montar.
      skipHydration: true,
      version: 1,
    },
  ),
);

/**
 * Recupera o rascunho gravado e diz quando terminou.
 *
 * A tela precisa desse "quando": enquanto nao voltou do disco o carrinho
 * esta vazio, e mostrar "nenhum produto" nesse instante faria parecer que o
 * trabalho se perdeu — justamente o que isto existe para evitar.
 */
export function useRascunho() {
  // No servidor a resposta e sempre "ainda nao": e o que o HTML entregue
  // afirma, e o React precisa que a primeira leitura no navegador diga o
  // mesmo para as duas arvores baterem. So depois disso o valor real entra.
  const hidratado = useSyncExternalStore(
    assinarHidratacao,
    () => useCarrinho.persist.hasHydrated(),
    () => false,
  );

  useEffect(() => {
    if (!useCarrinho.persist.hasHydrated()) {
      void useCarrinho.persist.rehydrate();
    }
  }, []);

  return hidratado;
}

const assinarHidratacao = (aoTerminar: () => void) =>
  useCarrinho.persist.onFinishHydration(aoTerminar);
