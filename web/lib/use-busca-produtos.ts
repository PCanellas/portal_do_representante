"use client";

import { useDeferredValue, useMemo } from "react";
import uFuzzy from "@leeoniya/ufuzzy";
import {
  normalizar,
  pontuarRelevancia,
  textoBusca,
  type Produto,
} from "@/lib/catalogo";

// tolera um erro de digitacao por termo — ele digita com pressa, em pe
const uf = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1,
});

/**
 * Busca no catalogo baixado. Usada na tela de produtos e na de orcamento —
 * a ordem dos resultados precisa ser a mesma nas duas, senao ele encontra o
 * produto num lugar e nao encontra no outro.
 */
export function useBuscaProdutos(produtos: Produto[], termo: string) {
  // mantem a digitacao fluida: a lista pesada renderiza com prioridade baixa
  const termoAdiado = useDeferredValue(termo);

  // o indice so e refeito quando o conjunto muda, nao a cada tecla
  const indice = useMemo(() => produtos.map(textoBusca), [produtos]);

  return useMemo(() => {
    const busca = normalizar(termoAdiado.trim());
    if (!busca) return produtos;

    // outOfOrder: "spot 7w" acha "... 7W ... SPOT ..."
    const [idxs, info, ordem] = uf.search(indice, busca, 1);
    const achados =
      ordem && info
        ? ordem.map((o) => produtos[info.idx[o]])
        : (idxs ?? []).map((i) => produtos[i]);

    // o fuzzy diz o que casa; a pontuacao diz o que interessa primeiro
    const termos = busca.split(/\s+/).filter(Boolean);
    return achados
      .map((p) => ({ p, pontos: pontuarRelevancia(p, termos) }))
      .sort((a, b) => b.pontos - a.pontos)
      .map((x) => x.p);
  }, [indice, produtos, termoAdiado]);
}
