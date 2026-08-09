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

  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecalho nome={representante?.nome ?? "Representante"} aoSair={sair} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-7">
        {children}
      </main>

      <BarraInferior />
    </div>
  );
}
