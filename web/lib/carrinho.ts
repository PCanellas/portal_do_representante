"use client";

import { create } from "zustand";
import type { Produto } from "@/lib/catalogo";
import { PRAZO_PADRAO } from "@/lib/orcamento";

/**
 * O orcamento em edicao.
 *
 * Estado de tela, e so isso: entrar em /orcamentos/novo comeca do zero,
 * sempre. O que precisa sobreviver ao fechar a tela tem que estar salvo
 * no banco.
 *
 * Um orcamento por vez: ele atende um cliente de cada vez.
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
};

const limitarPercentual = (v: number) =>
  Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;

export const useCarrinho = create<EstadoCarrinho & AcoesCarrinho>()(
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
  }),
);
