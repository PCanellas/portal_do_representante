import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ListaOrcamentos, type OrcamentoLista } from "./lista-orcamentos";

export const metadata: Metadata = { title: "Orçamentos" };

/**
 * Sem os tipos gerados do banco, o supabase-js supoe que todo embed e uma
 * lista. Aqui as duas relacoes sao chave estrangeira obrigatoria, entao o
 * PostgREST devolve um objeto — e e assim que a linha e lida abaixo.
 */
type LinhaOrcamento = {
  id: string;
  numero: number;
  valor_total: string;
  criado_em: string;
  id_fabricante: string;
  clientes: { nome: string } | null;
  fabricantes: { nome: string } | null;
};

export default async function OrcamentosPage() {
  const supabase = await createClient();

  // o RLS ja limita aos orcamentos deste representante
  const { data } = await supabase
    .from("orcamentos")
    .select(
      "id, numero, valor_total, criado_em, id_fabricante, clientes(nome), fabricantes(nome)",
    )
    .neq("situacao", 2)
    .order("numero", { ascending: false });

  const linhas = (data ?? []) as unknown as LinhaOrcamento[];

  const orcamentos: OrcamentoLista[] = linhas.map((o) => ({
    id: o.id,
    numero: o.numero,
    valor_total: Number(o.valor_total),
    criado_em: o.criado_em,
    cliente: o.clientes?.nome ?? "—",
    id_fabricante: o.id_fabricante,
    fabricante: o.fabricantes?.nome ?? "",
  }));

  return <ListaOrcamentos orcamentos={orcamentos} />;
}
