"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  calcularItem,
  calcularOrcamento,
  orcamentoDesatualizado,
  prazoValido,
  STATUS_ENVIADO,
} from "@/lib/orcamento";
import { tabelasVigentes } from "@/lib/tabelas-precos";

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
  // mesmo dominio do check no banco; aqui a mensagem sai em portugues
  prazo_pagamento: z
    .number()
    .int()
    .refine(prazoValido, "Escolha o prazo de pagamento"),
  // texto livre, sem regra do banco a espelhar aqui alem do tamanho
  obs: z.string().max(2000, "Observação muito longa").default(""),
  itens: z.array(item).min(1, "Adicione ao menos um produto"),
  /**
   * Id escolhido no aparelho, para orçamento que ficou na fila sem sinal.
   *
   * É o que torna o reenvio seguro: se a resposta se perdeu no caminho mas o
   * banco gravou, a segunda tentativa esbarra na chave primária e atualiza a
   * mesma linha em vez de criar um segundo orçamento. Sem isso, cada retentativa
   * da fila viraria um orçamento novo — e ele mandaria dois ao cliente.
   */
  id_novo: z.string().uuid().optional(),
});

export type EntradaOrcamento = z.input<typeof schema>;

export type ResultadoOrcamento =
  | { ok: true; id: string; numero: number; valor_total: number }
  | { ok: false; erro: string };

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

  // Orcamento anterior a tabela vigente nao se regrava: os precos abaixo sao
  // relidos do banco, e salvar recalcularia o documento inteiro pela tabela
  // nova. A tela ja esconde os controles; aqui e onde a regra vale de fato.
  if (dados.data.id) {
    const { data: existente } = await supabase
      .from("orcamentos")
      .select("criado_em, id_fabricante")
      .eq("id", dados.data.id)
      .maybeSingle();

    if (existente) {
      const vigentes = await tabelasVigentes();
      if (
        orcamentoDesatualizado(
          existente.criado_em,
          vigentes.get(existente.id_fabricante),
        )
      ) {
        return {
          ok: false,
          erro: "Este orçamento é de antes da tabela de preços atual e não pode mais ser alterado.",
        };
      }
    }
  }

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
    prazo_pagamento: dados.data.prazo_pagamento,
    obs: dados.data.obs.trim(),
    quantidade_total: totais.quantidadeTotal,
    valor_sub_total: totais.subTotal,
    percentual_desconto: dados.data.percentual_desconto,
    valor_desconto: totais.valorDesconto,
    valor_imposto: totais.imposto,
    valor_total: totais.total,
  };

  const gravarCabecalho = async () => {
    if (dados.data.id) {
      const r = await supabase
        .from("orcamentos")
        .update(cabecalho)
        .eq("id", dados.data.id)
        .select("id, numero")
        .single();
      return { ...r, regravado: true };
    }

    if (dados.data.id_novo) {
      const r = await supabase
        .from("orcamentos")
        .insert({ ...cabecalho, id: dados.data.id_novo })
        .select("id, numero")
        .single();

      // 23505 = chave duplicada: a tentativa anterior chegou a gravar e so a
      // resposta se perdeu. Atualiza a linha que ja existe.
      if (r.error?.code !== "23505") return { ...r, regravado: false };

      const reenvio = await supabase
        .from("orcamentos")
        .update(cabecalho)
        .eq("id", dados.data.id_novo)
        .select("id, numero")
        .single();
      return { ...reenvio, regravado: true };
    }

    const r = await supabase
      .from("orcamentos")
      .insert(cabecalho)
      .select("id, numero")
      .single();
    return { ...r, regravado: false };
  };

  const {
    data: orcamento,
    error: erroCabecalho,
    regravado,
  } = await gravarCabecalho();

  if (erroCabecalho || !orcamento) {
    return { ok: false, erro: "Não foi possível salvar o orçamento." };
  }

  // Regravar troca as linhas inteiras. Aqui a exclusao e definitiva mesmo:
  // linha de orcamento nao tem historico proprio, ela e o orcamento.
  if (regravado) {
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
    if (!regravado) {
      await supabase.from("orcamentos").delete().eq("id", orcamento.id);
    }
    return { ok: false, erro: "Não foi possível salvar os itens." };
  }

  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${orcamento.id}`);
  return {
    ok: true,
    id: orcamento.id,
    numero: orcamento.numero,
    // devolvido para a fila conferir contra o total calculado no aparelho:
    // offline quem calcula e o celular, com o preco que ele tinha guardado
    valor_total: totais.total,
  };
}

export type DadosPdf = {
  numero: number;
  criado_em: string;
  percentual_desconto: number;
  prazo_pagamento: number;
  obs: string;
  cliente: string;
  fabricante: string;
  representante: { nome: string; whatsapp: string | null; email: string };
  itens: {
    referencia: string;
    variante: string;
    descricao: string;
    preco_unitario: number;
    porcentagem_imposto: number;
    quantidade: number;
    percentual_desconto: number;
  }[];
};

/**
 * Tudo que o PDF precisa, numa ida so.
 *
 * O documento sai do banco, nao da tela: a lista de orcamentos so carrega o
 * resumo, e o papel que vai para o cliente tem que bater com o que ficou
 * gravado.
 */
export async function dadosParaPdf(
  id: string,
): Promise<{ ok: true; dados: DadosPdf } | { ok: false; erro: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const [{ data: orcamento }, { data: itens }, { data: representante }] =
    await Promise.all([
      supabase
        .from("orcamentos")
        .select(
          "numero, criado_em, percentual_desconto, prazo_pagamento, obs, clientes(nome), fabricantes(nome)",
        )
        .eq("id", id)
        .neq("situacao", 2)
        .maybeSingle(),
      supabase
        .from("orcamentos_itens")
        .select(
          "referencia, variante, descricao, preco_unitario, porcentagem_imposto, quantidade, percentual_desconto",
        )
        .eq("id_orcamento", id)
        .order("criado_em"),
      supabase
        .from("representantes")
        .select("nome, whatsapp, email")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  if (!orcamento) return { ok: false, erro: "Orçamento não encontrado." };

  // sem os tipos gerados do banco, o supabase-js supoe lista no embed;
  // as duas relacoes sao chave estrangeira obrigatoria e vem como objeto
  const cabecalho = orcamento as unknown as {
    numero: number;
    criado_em: string;
    percentual_desconto: string;
    prazo_pagamento: number;
    obs: string;
    clientes: { nome: string } | null;
    fabricantes: { nome: string } | null;
  };

  return {
    ok: true,
    dados: {
      numero: cabecalho.numero,
      criado_em: cabecalho.criado_em,
      percentual_desconto: Number(cabecalho.percentual_desconto),
      prazo_pagamento: cabecalho.prazo_pagamento,
      obs: cabecalho.obs,
      cliente: cabecalho.clientes?.nome ?? "—",
      fabricante: cabecalho.fabricantes?.nome ?? "",
      representante: {
        nome: representante?.nome ?? "",
        whatsapp: representante?.whatsapp ?? null,
        email: representante?.email ?? "",
      },
      // numeric chega como string pelo PostgREST
      itens: (itens ?? []).map((i) => ({
        referencia: i.referencia,
        variante: i.variante ?? "",
        descricao: i.descricao,
        preco_unitario: Number(i.preco_unitario),
        porcentagem_imposto: Number(i.porcentagem_imposto),
        quantidade: Number(i.quantidade),
        percentual_desconto: Number(i.percentual_desconto),
      })),
    },
  };
}

/**
 * Nao apaga: marca como excluido, preservando o historico do cliente.
 *
 * Devolve se deu certo — ver o mesmo cuidado em excluirCliente: update em
 * linha que o RLS esconde nao da erro, so nao acha nada.
 */
export async function excluirOrcamento(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orcamentos")
    .update({ situacao: 2 })
    .eq("id", id)
    .select("id");

  if (error || !data?.length) {
    console.error("[excluirOrcamento]", { id, error });
    return { ok: false };
  }

  revalidatePath("/orcamentos");
  return { ok: true };
}
