import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EditorOrcamento } from "../../editor-orcamento";
import type { ClienteOpcao } from "../../seletor-cliente";
import type { FabricanteOpcao } from "../../seletor-fabricante";

export const metadata: Metadata = { title: "Rascunho" };

/**
 * Rascunho guardado no aparelho. O conteudo do orcamento vem do
 * localStorage, no cliente — daqui saem so as listas de apoio.
 */
export default async function RascunhoPage({
  params,
}: PageProps<"/orcamentos/rascunho/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clientes }, { data: fabricantes }] = await Promise.all([
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

  return (
    <EditorOrcamento
      clientes={(clientes ?? []) as ClienteOpcao[]}
      fabricantes={(fabricantes ?? []) as FabricanteOpcao[]}
      idRascunho={id}
    />
  );
}
