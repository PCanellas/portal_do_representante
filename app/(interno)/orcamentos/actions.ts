"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  calcularItem,
  calcularOrcamento,
  STATUS_ENVIADO,
} from "@/lib/orcamento";

/**
 * Gravacao do orcamento.
 *
 * O navegador manda o que ele escolheu — produto, quantidade e desconto —
 * e nada mais. Preco e imposto sao lidos do banco aqui e o total e
 * recalculado do zero.
 *
 * O motivo e simples: o catalogo do aparelho e uma copia, pode estar
 * desatualizada ou ter sido adulterada. Preco quem decide e o banco.
 */

const item = z.object({
  id_produto: z.string().uuid(),
  quantidade: z
    .number()
    .positive("Quantidade deve ser maior que zero")
    .max(999999),
  percentual_desconto: z.number().min(0).max(100),
});

const schema = z.object({
  id: z.string().uuid().nullable(),
  id_cliente: z.string().uuid("Selecione o cliente"),
  percentual_desconto: z.number().min(0).max(100),
  itens: z.array(item).min(1, "Adicione ao menos um produto"),
});

export type EntradaOrcamento = z.input<typeof schema>;

export type ResultadoOrcamento =
  { ok: true; id: string; numero: number } | { ok: false; erro: string };

export async function salvarOrcamento(
  entrada: EntradaOrcamento,
): Promise<ResultadoOrcamento> {
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

  // o RLS ja restringe aos clientes deste representante; isto aqui e para
  // devolver uma mensagem util em vez de um erro de chave estrangeira
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", dados.data.id_cliente)
    .neq("situacao", 2)
    .maybeSingle();
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };

  const ids = [...new Set(dados.data.itens.map((i) => i.id_produto))];
  const { data: produtos, error: erroProdutos } = await supabase
    .from("produtos")
    .select(
      "id, id_fabricante, referencia, variante, descricao, preco_unitario, porcentagem_imposto, situacao",
    )
    .in("id", ids);

  if (erroProdutos)
    return { ok: false, erro: "Falha ao consultar os produtos." };

  const porId = new Map(produtos?.map((p) => [p.id, p]));
  if (porId.size !== ids.length) {
    return { ok: false, erro: "Algum produto do orçamento não existe mais." };
  }

  const inativo = produtos?.find((p) => p.situacao !== 1);
  if (inativo) {
    return {
      ok: false,
      erro: `${inativo.referencia} está inativo e não pode entrar em orçamento.`,
    };
  }

  // um orcamento, um fabricante — restricao do proprio negocio
  const fabricantes = new Set(produtos?.map((p) => p.id_fabricante));
  if (fabricantes.size > 1) {
    return {
      ok: false,
      erro: "O orçamento só pode ter produtos de um fabricante.",
    };
  }
  const id_fabricante = [...fabricantes][0];

  // valores congelados: sao os do banco agora, nao os que o aparelho mandou
  const linhas = dados.data.itens.map((i) => {
    const p = porId.get(i.id_produto)!;
    const congelado = {
      id_produto: p.id,
      referencia: p.referencia,
      variante: p.variante ?? "",
      descricao: p.descricao,
      preco_unitario: Number(p.preco_unitario),
      porcentagem_imposto: Number(p.porcentagem_imposto),
      quantidade: i.quantidade,
      percentual_desconto: i.percentual_desconto,
    };
    const t = calcularItem(congelado);
    return {
      ...congelado,
      valor_desconto: t.desconto,
      valor_imposto: t.imposto,
      total: t.total,
    };
  });

  const totais = calcularOrcamento(linhas, dados.data.percentual_desconto);

  const cabecalho = {
    id_representante: user.id,
    id_cliente: dados.data.id_cliente,
    id_fabricante,
    // chegar aqui e ser enviado; nao ha status escolhido a mao
    status: STATUS_ENVIADO,
    quantidade_total: totais.quantidadeTotal,
    valor_sub_total: totais.subTotal,
    percentual_desconto: dados.data.percentual_desconto,
    valor_desconto: totais.valorDesconto,
    valor_imposto: totais.imposto,
    valor_total: totais.total,
  };

  const { data: orcamento, error: erroCabecalho } = dados.data.id
    ? await supabase
        .from("orcamentos")
        .update(cabecalho)
        .eq("id", dados.data.id)
        .select("id, numero")
        .single()
    : await supabase
        .from("orcamentos")
        .insert(cabecalho)
        .select("id, numero")
        .single();

  if (erroCabecalho || !orcamento) {
    return { ok: false, erro: "Não foi possível salvar o orçamento." };
  }

  // Regravar troca as linhas inteiras. Aqui a exclusao e definitiva mesmo:
  // linha de orcamento nao tem historico proprio, ela e o orcamento.
  if (dados.data.id) {
    await supabase
      .from("orcamentos_itens")
      .delete()
      .eq("id_orcamento", orcamento.id);
  }

  const { error: erroItens } = await supabase
    .from("orcamentos_itens")
    .insert(linhas.map((l) => ({ ...l, id_orcamento: orcamento.id })));

  if (erroItens) {
    // cabecalho sem item e um orcamento quebrado; desfaz o insert novo
    if (!dados.data.id) {
      await supabase.from("orcamentos").delete().eq("id", orcamento.id);
    }
    return { ok: false, erro: "Não foi possível salvar os itens." };
  }

  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${orcamento.id}`);
  return { ok: true, id: orcamento.id, numero: orcamento.numero };
}

/** Nao apaga: marca como excluido, preservando o historico do cliente. */
export async function excluirOrcamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orcamentos")
    .update({ situacao: 2 })
    .eq("id", id);

  if (!error) revalidatePath("/orcamentos");
}
