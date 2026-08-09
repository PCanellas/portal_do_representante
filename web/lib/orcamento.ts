/**
 * Regra de calculo do orcamento — um lugar so, usado pelo navegador e pelo
 * servidor. Se as duas pontas calculassem por conta propria, uma hora
 * divergiriam e o cliente receberia um numero diferente do que foi salvo.
 *
 * Os dois descontos sao diferentes de proposito:
 *   no item      o desconto entra ANTES do imposto (imposto sobre o liquido);
 *   no orcamento o desconto entra DEPOIS (sobre o total, ja com imposto).
 */

/**
 * Status nao e escolha do usuario: salvar e o que define. A coluna do banco
 * aceita outros valores por historico, mas o app so grava 'enviado'. Se um
 * dia houver acompanhamento de aprovado/recusado, o lugar ja esta reservado.
 */
export const STATUS_ENVIADO = "enviado";

/**
 * Prazos de pagamento aceitos, em dias: 30 a 150, de 15 em 15.
 *
 * O banco tem o mesmo check — aqui e para a tela oferecer as opcoes e para
 * o servidor recusar antes de chegar la, com mensagem em portugues em vez
 * de erro de constraint.
 */
export const PRAZOS_PAGAMENTO = [30, 45, 60, 75, 90, 105, 120, 135, 150];

/** O mais comum — orcamento novo ja nasce com ele. */
export const PRAZO_PADRAO = 30;

export function prazoValido(dias: number) {
  return PRAZOS_PAGAMENTO.includes(dias);
}

export function formatarPrazo(dias: number) {
  return `${dias} dias`;
}

/**
 * Arredonda em 2 casas.
 *
 * O fator (1 + EPSILON) corrige o caso classico do ponto flutuante: 2.675
 * e guardado como 2.67499999..., entao `2.675 * 100` da 267.49999999999994
 * e arredondaria para baixo. O empurrao e relativo ao valor, nao absoluto,
 * para funcionar tanto em centavos quanto em dezenas de milhares.
 */
export function arredondar(valor: number) {
  return Math.round(valor * 100 * (1 + Number.EPSILON)) / 100;
}

export type ItemCalculavel = {
  preco_unitario: number;
  porcentagem_imposto: number;
  quantidade: number;
  percentual_desconto: number;
};

export type TotaisItem = {
  bruto: number;
  desconto: number;
  base: number;
  imposto: number;
  total: number;
};

export function calcularItem(item: ItemCalculavel): TotaisItem {
  const bruto = arredondar(item.preco_unitario * item.quantidade);
  const desconto = arredondar((bruto * item.percentual_desconto) / 100);
  const base = arredondar(bruto - desconto);
  const imposto = arredondar((base * item.porcentagem_imposto) / 100);
  const total = arredondar(base + imposto);
  return { bruto, desconto, base, imposto, total };
}

export type TotaisOrcamento = {
  quantidadeTotal: number;
  subTotal: number; // soma dos brutos, antes de qualquer desconto
  descontoItens: number;
  descontoGlobal: number;
  valorDesconto: number; // itens + global, o que vai para o banco
  imposto: number;
  totalComImposto: number; // antes do desconto global
  total: number;
};

/**
 * Soma os itens ja arredondados — nao os valores cheios. E o mesmo criterio
 * de uma nota fiscal: o que aparece linha a linha tem que fechar com o
 * rodape, sem centavo sobrando.
 */
export function calcularOrcamento(
  itens: ItemCalculavel[],
  percentualDescontoGlobal: number,
): TotaisOrcamento {
  let quantidadeTotal = 0;
  let subTotal = 0;
  let descontoItens = 0;
  let imposto = 0;
  let totalComImposto = 0;

  for (const item of itens) {
    const t = calcularItem(item);
    quantidadeTotal = arredondar(quantidadeTotal + item.quantidade);
    subTotal = arredondar(subTotal + t.bruto);
    descontoItens = arredondar(descontoItens + t.desconto);
    imposto = arredondar(imposto + t.imposto);
    totalComImposto = arredondar(totalComImposto + t.total);
  }

  const descontoGlobal = arredondar(
    (totalComImposto * percentualDescontoGlobal) / 100,
  );

  return {
    quantidadeTotal,
    subTotal,
    descontoItens,
    descontoGlobal,
    valorDesconto: arredondar(descontoItens + descontoGlobal),
    imposto,
    totalComImposto,
    total: arredondar(totalComImposto - descontoGlobal),
  };
}

const QUANTIDADE = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

/** Quantidade sem casas decimais quando e inteira: "3", nao "3,00". */
export function formatarQuantidade(valor: number) {
  return QUANTIDADE.format(valor);
}

const PERCENTUAL = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

export function formatarPercentual(valor: number) {
  return `${PERCENTUAL.format(valor)}%`;
}

const DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

export function formatarData(iso: string) {
  return DATA.format(new Date(iso));
}
