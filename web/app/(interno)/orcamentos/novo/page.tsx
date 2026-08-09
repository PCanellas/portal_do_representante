import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EditorOrcamento } from "../editor-orcamento";
import type { ClienteOpcao } from "../seletor-cliente";
import type { FabricanteOpcao } from "../seletor-fabricante";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NovoOrcamentoPage() {
  const supabase = await createClient();

  // so clientes e fabricantes vem do servidor; os produtos saem do catalogo
  // ja baixado no aparelho
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
    />
  );
}
