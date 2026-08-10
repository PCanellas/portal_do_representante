export type Fabricante = {
  id: string;
  nome: string;
  tipo_imposto: "ST" | "IPI";
};

export type Produto = {
  id: string;
  id_fabricante: string;
  referencia: string;
  variante: string;
  descricao: string;
  /** Ficha do fabricante (medida, lâmpada, material, cores), uma por linha. */
  detalhes: string;
  preco_unitario: number;
  porcentagem_imposto: number;
  situacao: number; // 1 = ativo, 0 = inativo (sem preco ou fora de linha)
};

export type Catalogo = {
  versao: string;
  fabricantes: Fabricante[];
  produtos: Produto[];
};

// Marcas de acentuacao combinantes (U+0300 a U+036F). Escrito com escapes
// em vez dos caracteres literais para nao depender do encoding do arquivo.
const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");

/** Remove acentos e caixa: "Lampada" e "lampada" viram a mesma coisa. */
export function normalizar(texto: string) {
  return texto.normalize("NFD").replace(ACENTOS, "").toLowerCase();
}

/**
 * Texto que entra na busca de cada produto.
 *
 * `detalhes` fica de fora de propósito: toda peça da Metal Domado lista
 * "Cores: Sólidas e Automotivas", e com a ficha indexada procurar
 * "automotiva" traria o catálogo inteiro. Busca é por nome e código.
 */
export function textoBusca(p: Produto) {
  return normalizar(`${p.referencia} ${p.descricao} ${p.variante}`);
}

/**
 * Reordena o que o fuzzy encontrou usando regra do ramo.
 *
 * Sem isso, buscar "fita led" traz antes "SENSOR PARA FITAS LED" e
 * "PERFIL PARA FITAS LED" — que contem os termos, mas nao sao o que ele
 * procura. Quem comeca com o termo vem primeiro; sem preco vai para o fim.
 */
export function pontuarRelevancia(p: Produto, termos: string[]) {
  const desc = normalizar(p.descricao);
  let pontos = 0;

  if (p.preco_unitario === 0) pontos -= 500;
  if (normalizar(p.referencia) === termos.join("")) pontos += 10000;

  termos.forEach((termo, i) => {
    if (desc.startsWith(termo)) pontos += i === 0 ? 400 : 120;
    const pos = desc.indexOf(termo);
    if (pos >= 0) {
      pontos += 60;
      if (pos === 0 || desc[pos - 1] === " ") pontos += 40; // inicio de palavra
      pontos -= Math.min(pos, 60) / 3; // quanto mais cedo aparece, melhor
    }
  });

  return pontos;
}

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarPreco(valor: number) {
  return MOEDA.format(valor);
}
