"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Produto } from "@/lib/catalogo";

/**
 * Edicao de produto.
 *
 * Existe para tres coisas: corrigir erro de extracao, ajustar um preco
 * pontualmente e marcar produto em falta. Nao cria produto — produto entra
 * pela carga da tabela do fabricante.
 *
 * A carga sempre vence: a proxima tabela daquele fabricante sobrescreve o
 * que for ajustado aqui. A tela avisa disso; nao e efeito colateral, e a
 * regra combinada.
 */

const schema = z.object({
  id: z.string().uuid(),
  referencia: z
    .string()
    .trim()
    .min(1, "Informe a referência")
    .max(60, "Referência muito longa"),
  variante: z.string().trim().max(80, "Variante muito longa"),
  descricao: z
    .string()
    .trim()
    .min(2, "Informe a descrição")
    .max(300, "Descrição muito longa"),
  preco_unitario: z
    .number()
    .min(0, "Preço não pode ser negativo")
    .max(9999999.99, "Preço fora da faixa"),
  porcentagem_imposto: z
    .number()
    .min(0, "Imposto não pode ser negativo")
    .max(100, "Imposto não pode passar de 100%"),
  // 2 e exclusao, que nao se faz por aqui
  situacao: z.union([z.literal(0), z.literal(1)]),
});

export type CamposProduto = z.infer<typeof schema>;

export type ResultadoProduto =
  { ok: true; produto: Produto } | { ok: false; erro: string };

export async function salvarProduto(
  entrada: CamposProduto,
): Promise<ResultadoProduto> {
  const dados = schema.safeParse(entrada);
  if (!dados.success) {
    return {
      ok: false,
      erro: dados.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const { id, ...campos } = dados.data;

  const { data, error } = await supabase
    .from("produtos")
    .update(campos)
    .eq("id", id)
    .select(
      "id, id_fabricante, referencia, variante, descricao, preco_unitario, porcentagem_imposto, situacao",
    )
    .single();

  if (error) {
    // (id_fabricante, referencia, variante) e unico: mudar a referencia
    // para uma que ja existe naquele fabricante bate aqui
    if (error.code === "23505") {
      return {
        ok: false,
        erro: "Já existe outro produto com essa referência e variante.",
      };
    }

    // PGRST116 = o update nao encontrou linha para devolver. Como o id vem
    // do proprio catalogo, o produto existe: quem barrou foi o RLS.
    if (error.code === "PGRST116") {
      console.error("[salvarProduto] update sem linha — checar RLS", { id });
      return { ok: false, erro: "Sem permissão para editar este produto." };
    }

    // o detalhe fica no log do servidor; a tela recebe algo que da para agir
    console.error("[salvarProduto]", error);
    return {
      ok: false,
      erro: "Não foi possível salvar. Tente de novo em instantes.",
    };
  }

  // devolve o que ficou gravado, nao o que foi enviado: e isso que entra
  // no catalogo do aparelho
  return {
    ok: true,
    produto: {
      id: data.id,
      id_fabricante: data.id_fabricante,
      referencia: data.referencia,
      variante: data.variante ?? "",
      descricao: data.descricao,
      // numeric chega como string pelo PostgREST
      preco_unitario: Number(data.preco_unitario),
      porcentagem_imposto: Number(data.porcentagem_imposto),
      situacao: data.situacao,
    },
  };
}
