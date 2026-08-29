import type { Produto } from "@/lib/catalogo";

/**
 * Achar produto pela referencia dita em voz alta.
 *
 * Produto so se busca por referencia — descricao e variante nao entram. Uma
 * referencia identifica um item; "arandela dourada" identifica dezenas, e
 * cotar o errado e pior do que nao achar.
 *
 * O casamento e por TOKEN INTEIRO, nunca por "contem". O catalogo da Metal
 * Domado tem referencias de tres digitos (510, 511, 580) que aparecem dentro
 * de outras maiores (11510, 51012, 5800) — buscar por substring acharia a
 * peca errada com preco errado, e em silencio.
 *
 * De quebra, isto resolve a frase falada inteira: "ei jarvis, qual o preco da
 * LM3654?" vira uma lista de pedacos, e so os que forem uma referencia de
 * verdade casam. Saudacao, "qual o preco", "por favor" — nada disso bate com
 * nada, entao nao ha lista de palavras a ignorar para manter.
 */

// Mesmas marcas de acentuacao que o normalizar do catalogo.ts remove, escritas
// com escape para nao depender do encoding do arquivo.
const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");

/** Maiuscula, sem acento, so letra e numero: "11304.C10" vira "11304C10". */
export function normalizarReferencia(texto: string) {
  return texto
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Quantos pedacos vizinhos podem ser grudados na tentativa de remontar uma
 * referencia. Quatro cobre o pior caso plausivel: "eme dê vinte e dois onze"
 * chega como "M D 22 11" e so junta em LM2211 com os quatro.
 */
const MAX_JUNCAO = 4;

/**
 * Todos os pedacos da frase que PODERIAM ser uma referencia, incluindo os
 * vizinhos grudados.
 *
 * O transcritor separa a referencia de maneiras que ninguem controla: "LM3654"
 * pode chegar "LM 3654", "L M 3654" ou "LM 36 54". Grudar vizinhos cobre as
 * tres sem precisar adivinhar qual veio.
 */
export function candidatosReferencia(frase: string): string[] {
  const pedacos = frase
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

  const vistos = new Set<string>();
  const candidatos: string[] = [];

  for (let i = 0; i < pedacos.length; i++) {
    let juntos = "";
    for (let n = 0; n < MAX_JUNCAO && i + n < pedacos.length; n++) {
      juntos += pedacos[i + n];
      if (vistos.has(juntos)) continue;
      vistos.add(juntos);
      candidatos.push(juntos);
    }
  }

  return candidatos;
}

/**
 * Referencia normalizada para os produtos que a usam.
 *
 * E uma lista porque a mesma referencia pode existir em fabricantes
 * diferentes — o catalogo garante unicidade por (fabricante, referencia,
 * variante), nao por referencia sozinha.
 */
export function indexarPorReferencia(produtos: Produto[]) {
  const indice = new Map<string, Produto[]>();
  for (const p of produtos) {
    const chave = normalizarReferencia(p.referencia);
    if (!chave) continue;
    const atual = indice.get(chave);
    if (atual) atual.push(p);
    else indice.set(chave, [p]);
  }
  return indice;
}

export type AchadoReferencia = {
  /** A referencia normalizada que casou. */
  referencia: string;
  produtos: Produto[];
};

/**
 * Os produtos cuja referencia aparece na frase.
 *
 * Do candidato mais longo para o mais curto: dito "50105 G", tanto "50105G"
 * quanto "50105" podem existir, e o mais especifico e o que ele quis dizer.
 *
 * Sem casamento aproximado, de proposito. Errar um digito de referencia nao
 * devolve "quase o produto" — devolve OUTRO produto existente, com outro
 * preco, sem nada na tela sugerindo que houve engano. Melhor nao achar.
 */
export function acharPorReferencia(
  indice: Map<string, Produto[]>,
  frase: string,
): AchadoReferencia[] {
  const candidatos = candidatosReferencia(frase).sort(
    (a, b) => b.length - a.length,
  );

  const achados: AchadoReferencia[] = [];
  for (const candidato of candidatos) {
    const produtos = indice.get(candidato);
    if (produtos) achados.push({ referencia: candidato, produtos });
  }
  return achados;
}
