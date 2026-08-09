/**
 * Le o numero como um brasileiro escreveria — e tambem como o teclado do
 * celular as vezes entrega.
 *
 * Havendo virgula, ela e a decimal e os pontos sao separador de milhar
 * ("1.250,5"). So com ponto, ele e a decimal ("3.5" = tres e meio, nao 35),
 * que e o erro silencioso mais provavel num campo de quantidade ou preco.
 *
 * Devolve null quando nao da para ler — cabe a quem chama decidir se volta
 * ao valor anterior ou avisa.
 */
export function interpretarNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, "");
  if (!limpo) return null;

  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

const DECIMAL = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "43,20" — para preencher campo de dinheiro sem o simbolo da moeda. */
export function formatarDecimal(valor: number) {
  return DECIMAL.format(valor);
}
