import { arredondar } from "@/lib/orcamento";
import type { AchadoReferencia } from "@/lib/referencia";

/**
 * O texto que o app fala de volta.
 *
 * Nao passa por modelo nenhum, e nao e economia — e correcao. A resposta da
 * consulta e inteiramente determinada: achou a referencia X, que custa Y.
 * Um modelo poderia arredondar, reformular ou trocar um digito do preco; um
 * gabarito nao pode. Preco lido para cliente e o ultimo lugar onde se quer
 * variedade de frase.
 */

/**
 * "43,20" vira "43 reais e 20 centavos".
 *
 * O motor de voz ja le numero em portugues sem ajuda — o que ele nao le e
 * "R$", que sai como "erre cifrao". Entao basta dar a unidade por extenso e
 * deixar o numero com ele.
 */
export function precoFalado(valor: number) {
  // o mesmo arredondamento da tela e do PDF: falar um centavo diferente do
  // que esta escrito seria pior do que nao falar
  const exato = arredondar(valor);
  const reais = Math.floor(exato);
  // *100 antes de arredondar: 43.20 - 43 da 0.20000000000000284 em ponto
  // flutuante, e truncar sem arredondar comeria o centavo
  const centavos = Math.round((exato - reais) * 100);

  const parteReais = reais === 1 ? "1 real" : `${reais} reais`;
  const parteCentavos = centavos === 1 ? "1 centavo" : `${centavos} centavos`;

  if (centavos === 0) return parteReais;
  if (reais === 0) return parteCentavos;
  return `${parteReais} e ${parteCentavos}`;
}

/**
 * Referencia digito a digito: "1 1 3 0 4 C 1 0".
 *
 * Lida como numero, 11304 sai "onze mil trezentos e quatro" — que ele nao tem
 * como conferir de ouvido contra o que pediu. Separada, ele confere um a um,
 * que e o motivo de o app repetir a referencia.
 */
export function referenciaFalada(referencia: string) {
  return referencia
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .split("")
    .join(" ");
}

/** O que dizer depois de uma consulta. Vazio quando nao ha o que falar. */
export function respostaFalada(achados: AchadoReferencia[]) {
  if (achados.length === 0) return "Não achei essa referência.";

  const principal = achados[0];
  const produto = principal?.produtos[0];
  if (!principal || !produto) return "";

  const partes = [
    `Referência ${referenciaFalada(produto.referencia)}.`,
    `${produto.descricao}.`,
    `${precoFalado(produto.preco_unitario)}.`,
  ];

  // nao cotar peca fora de linha sem avisar
  if (produto.situacao !== 1) partes.push("Atenção: produto inativo.");

  const outras = achados.length - 1;
  if (outras > 0) {
    partes.push(
      outras === 1
        ? "Mais um acabamento na tela."
        : `Mais ${outras} acabamentos na tela.`,
    );
  }

  return partes.join(" ");
}
