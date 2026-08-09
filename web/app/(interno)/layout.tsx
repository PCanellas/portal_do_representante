import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Cabecalho } from "@/components/layout/cabecalho";
import { BarraInferior } from "@/components/layout/barra-inferior";
import { sair } from "./actions";

export default async function LayoutInterno({ children }: LayoutProps<"/">) {
  const supabase = await createClient();

  // O proxy ja barrou quem nao tem sessao, mas confirmamos aqui tambem:
  // proxy e checagem otimista, nao autorizacao.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: representante } = await supabase
    .from("representantes")
    .select("nome")
    .eq("id", user.id)
    .single();

  // Casca fixa: a pagina inteira nunca rola, quem rola e so o miolo. Assim o
  // cabecalho e a barra de baixo ficam parados de verdade — com a pagina
  // rolando, o Android mostra e esconde as barras do sistema no meio do
  // gesto e os dois pareciam mudar de altura.
  //
  // `fixed inset-0` em vez de `h-dvh` porque as duas medidas discordam no app
  // instalado: com viewport-fit=cover a pagina pinta de borda a borda, mas
  // 100dvh volta descontando as barras do sistema — e a barra de baixo
  // parava antes do fim da tela, com a diferenca sobrando embaixo. `inset-0`
  // nao pergunta altura nenhuma: manda ocupar da borda de cima a de baixo.
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <Cabecalho nome={representante?.nome ?? "Representante"} aoSair={sair} />

      {/* min-h-0 e o que autoriza o item flex a encolher: sem isso ele adota
          a altura do conteudo e a rolagem volta para a pagina */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:py-7">
          {children}
        </div>
      </main>

      <BarraInferior />
    </div>
  );
}
