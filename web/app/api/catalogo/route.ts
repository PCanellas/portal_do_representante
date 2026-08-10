import { createClient } from "@/lib/supabase/server";
import type { Catalogo, Produto } from "@/lib/catalogo";

/**
 * Devolve o catalogo inteiro de uma vez.
 *
 * O app baixa isso uma vez e busca no proprio aparelho: resultado
 * instantaneo a cada tecla e funciona sem sinal, que e a situacao real
 * dentro da loja do cliente. Sao poucas centenas de KB.
 *
 * O PostgREST devolve no maximo 1000 linhas por requisicao, entao
 * paginamos ate o fim.
 */

const PAGINA = 1000;

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ erro: "nao autenticado" }, { status: 401 });
  }

  const { data: fabricantes, error: erroFab } = await supabase
    .from("fabricantes")
    .select("id, nome, tipo_imposto")
    .eq("situacao", 1)
    .order("nome");

  if (erroFab) {
    return Response.json({ erro: erroFab.message }, { status: 500 });
  }

  const produtos: Produto[] = [];
  for (let pagina = 0; ; pagina++) {
    const { data, error } = await supabase
      .from("produtos")
      .select(
        "id, id_fabricante, referencia, variante, descricao, detalhes, preco_unitario, porcentagem_imposto, situacao, atualizado_em",
      )
      .neq("situacao", 2)
      .order("referencia")
      .range(pagina * PAGINA, (pagina + 1) * PAGINA - 1);

    if (error) {
      return Response.json({ erro: error.message }, { status: 500 });
    }
    if (!data?.length) break;

    for (const p of data) {
      produtos.push({
        id: p.id,
        id_fabricante: p.id_fabricante,
        referencia: p.referencia,
        variante: p.variante ?? "",
        descricao: p.descricao,
        detalhes: p.detalhes ?? "",
        // numeric chega como string pelo PostgREST
        preco_unitario: Number(p.preco_unitario),
        porcentagem_imposto: Number(p.porcentagem_imposto),
        situacao: p.situacao,
      });
    }

    if (data.length < PAGINA) break;
  }

  // a alteracao mais recente serve de versao: muda quando entra tabela nova
  const { data: recente } = await supabase
    .from("produtos")
    .select("atualizado_em")
    .neq("situacao", 2)
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const catalogo: Catalogo = {
    versao: recente?.atualizado_em ?? new Date().toISOString(),
    fabricantes: fabricantes ?? [],
    produtos,
  };

  return Response.json(catalogo, {
    headers: {
      // privado: o conteudo depende da sessao e nao pode ficar em CDN
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
