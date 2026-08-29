import type { Produto } from "@/lib/catalogo";

/**
 * Achar produto pela referencia dita em voz alta.
 *
 * Produto so se busca por referencia — descricao e variante nao entram. Uma
 * referencia identifica um item; "arandela dourada" identifica dezenas, e
 * cotar o errado e pior do que nao achar.
 *
 * Duas regras, e a segunda e a que evita cotar peca errada:
 *
 * 1. Pedir a base traz a FAMILIA. "11304" devolve 11304 e 11304.C10 — mesma
 *    peca, acabamentos diferentes, e ele quer ver as opcoes.
 * 2. O acrescimo so conta como acabamento quando NAO comeca com digito.
 *    Conferido no catalogo: 235 pares continuam com letra e sao variante
 *    (510 -> 510.C20/C40/C60); 272 continuam com digito e sao outra peca
 *    (512 -> 5126, 532 -> 5320/5321/5322). Sem essa distincao, pedir 512
 *    devolveria o 5126 junto — outro produto, outro preco, e nada na tela
 *    dizendo que houve troca.
 *
 * De quebra, procurar a referencia DENTRO da frase resolve a frase falada
 * inteira: "ei jarvis, qual o preco da LM3654?" vira uma lista de pedacos, e
 * so os que forem referencia de verdade casam. Saudacao, "qual o preco", "por
 * favor" — nada disso bate com nada, entao nao ha lista de palavras a ignorar
 * para manter.
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
 * A menor referencia do catalogo tem tres caracteres (510, 511, 580). Pedaco
 * menor que isso nao e referencia, e como agora o casamento pega familia por
 * prefixo, deixar passar "A" ou "DE" varreria o catalogo inteiro.
 */
const MIN_CANDIDATO = 3;

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
      if (juntos.length < MIN_CANDIDATO || vistos.has(juntos)) continue;
      vistos.add(juntos);
      candidatos.push(juntos);
    }
  }

  return candidatos;
}

/**
 * A referencia e o candidato, ou um acabamento dele?
 *
 * O digito depois do prefixo e o que separa os dois casos: 512 -> 5126 e
 * outro numero de peca; 512 -> 512C20 e a mesma peca noutro acabamento.
 */
function mesmaFamilia(referencia: string, candidato: string) {
  if (referencia === candidato) return true;
  if (!referencia.startsWith(candidato)) return false;
  return !/[0-9]/.test(referencia.charAt(candidato.length));
}

export type IndiceReferencias = {
  porReferencia: ReadonlyMap<string, Produto[]>;
  /** As mesmas chaves em lista, para o casamento por familia percorrer. */
  chaves: readonly string[];
};

/**
 * Referencia normalizada para os produtos que a usam.
 *
 * E uma lista porque a mesma referencia pode existir em fabricantes
 * diferentes — o catalogo garante unicidade por (fabricante, referencia,
 * variante), nao por referencia sozinha.
 */
export function indexarPorReferencia(produtos: Produto[]): IndiceReferencias {
  const porReferencia = new Map<string, Produto[]>();
  for (const p of produtos) {
    const chave = normalizarReferencia(p.referencia);
    if (!chave) continue;
    const atual = porReferencia.get(chave);
    if (atual) atual.push(p);
    else porReferencia.set(chave, [p]);
  }
  return { porReferencia, chaves: [...porReferencia.keys()].sort() };
}

export type AchadoReferencia = {
  /** A referencia normalizada do produto. */
  referencia: string;
  /** O pedaco da frase que levou ate ela. */
  candidato: string;
  produtos: Produto[];
  /** Casou inteira, ou e um acabamento da familia. */
  exata: boolean;
};

/**
 * Os produtos cuja referencia aparece na frase, com a familia junto.
 *
 * Sem casamento aproximado, de proposito. Errar um digito de referencia nao
 * devolve "quase o produto" — devolve OUTRO produto existente, com outro
 * preco, sem nada na tela sugerindo que houve engano. Melhor nao achar.
 */
export function acharPorReferencia(
  indice: IndiceReferencias,
  frase: string,
): AchadoReferencia[] {
  // do mais longo para o mais curto: dito "50105 G", tanto 50105G quanto
  // 50105 podem existir, e o mais especifico e o que ele quis dizer
  const candidatos = candidatosReferencia(frase).sort(
    (a, b) => b.length - a.length,
  );

  const achados: AchadoReferencia[] = [];
  const jaAchadas = new Set<string>();

  for (const candidato of candidatos) {
    for (const chave of indice.chaves) {
      if (jaAchadas.has(chave) || !mesmaFamilia(chave, candidato)) continue;
      jaAchadas.add(chave);
      achados.push({
        referencia: chave,
        candidato,
        produtos: indice.porReferencia.get(chave) ?? [],
        exata: chave === candidato,
      });
    }
  }

  // a exata e a resposta; o resto da familia vem depois, em ordem
  return achados.sort(
    (a, b) =>
      Number(b.exata) - Number(a.exata) ||
      a.referencia.localeCompare(b.referencia),
  );
}
