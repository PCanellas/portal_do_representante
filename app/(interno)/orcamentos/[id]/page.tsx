import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EstadoCarrinho } from "@/lib/carrinho";
import { EditorOrcamento } from "../editor-orcamento";
import type { ClienteOpcao } from "../seletor-cliente";
import type { FabricanteOpcao } from "../seletor-fabricante";

export const metadata: Metadata = { title: "Orçamento" };

export default async function OrcamentoPage({
  params,
}: PageProps<"/orcamentos/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  // o RLS ja limita aos orcamentos deste representante
  const [
    { data: orcamento },
    { data: itens },
    { data: clientes },
    { data: fabricantes },
  ] = await Promise.all([
    supabase
      .from("orcamentos")
      .select("id, numero, id_cliente, id_fabricante, percentual_desconto")
      .eq("id", id)
      .neq("situacao", 2)
      .maybeSingle(),
    supabase
      .from("orcamentos_itens")
      .select(
        "id_produto, referencia, variante, descricao, preco_unitario, porcentagem_imposto, quantidade, percentual_desconto",
      )
      .eq("id_orcamento", id)
      .order("criado_em"),
    supabase
      .from("clientes")
      .select("id, nome, whatsapp")
      .neq("situacao", 2)
      .order("nome"),
    supabase
      .from("fabricantes")
      .select("id, nome, tipo_imposto")
      .eq("situacao", 1)
      .order("nome"),
  ]);

  if (!orcamento) notFound();

  // numeric chega como string pelo PostgREST
  const estado: EstadoCarrinho = {
    id: orcamento.id,
    numero: orcamento.numero,
    id_rascunho: null,
    id_cliente: orcamento.id_cliente,
    id_fabricante: orcamento.id_fabricante,
    percentual_desconto: Number(orcamento.percentual_desconto),
    itens: (itens ?? []).map((i) => ({
      id_produto: i.id_produto,
      referencia: i.referencia,
      variante: i.variante ?? "",
      descricao: i.descricao,
      preco_unitario: Number(i.preco_unitario),
      porcentagem_imposto: Number(i.porcentagem_imposto),
      quantidade: Number(i.quantidade),
      percentual_desconto: Number(i.percentual_desconto),
    })),
  };

  return (
    <EditorOrcamento
      clientes={(clientes ?? []) as ClienteOpcao[]}
      fabricantes={(fabricantes ?? []) as FabricanteOpcao[]}
      orcamento={estado}
    />
  );
}
