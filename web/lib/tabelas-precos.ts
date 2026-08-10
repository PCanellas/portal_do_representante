import { createClient } from "@/lib/supabase/server";

/**
 * Só servidor. `@/lib/supabase/server` lê cookies, então importar isto de um
 * componente cliente quebra o build — mas o erro aponta para o cookie, não
 * para o import errado. A nota fica aqui para encurtar a caçada.
 *
 * Quando entrou a tabela mais recente de cada fabricante.
 *
 * Serve para saber se um orçamento é anterior à tabela vigente — ver
 * `orcamentoDesatualizado` em lib/orcamento.ts. Uma consulta só, ordenada,
 * ficando com a primeira de cada fabricante: são poucas linhas por empresa,
 * e um `max` por grupo custaria uma view ou uma RPC para o mesmo resultado.
 */
export async function tabelasVigentes(): Promise<Map<string, string>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tabelas_precos")
    .select("id_fabricante, criado_em")
    .neq("situacao", 2)
    .order("criado_em", { ascending: false });

  const porFabricante = new Map<string, string>();
  for (const t of data ?? []) {
    if (!porFabricante.has(t.id_fabricante)) {
      porFabricante.set(t.id_fabricante, t.criado_em);
    }
  }
  return porFabricante;
}
