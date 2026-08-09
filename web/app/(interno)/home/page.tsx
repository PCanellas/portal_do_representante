import Link from "next/link";
import { ArrowRight, FileText, Package, Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

function saudacao() {
  // horario de Brasilia, independente do fuso do servidor
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export const metadata = { title: "Início" };

export default async function Home() {
  const supabase = await createClient();

  const [{ count: totalProdutos }, { data: fabricantes }] = await Promise.all([
    supabase
      .from("produtos")
      .select("id", { count: "exact", head: true })
      .eq("situacao", 1),
    supabase
      .from("fabricantes")
      .select("id, nome")
      .eq("situacao", 1)
      .order("nome"),
  ]);

  const { data: representante } = await supabase
    .from("representantes")
    .select("nome")
    .single();

  const primeiroNome = representante?.nome?.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">{saudacao()},</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {primeiroNome || "bem-vindo"}
        </h1>
      </header>

      {/* Atalho principal: buscar preco e o que ele faz o dia inteiro */}
      <Link href="/produtos" className="block">
        <Card className="group flex-row items-center gap-4 border-marca-azul/20 bg-gradient-to-br from-marca-azul to-marca-navy p-5 text-white transition-transform active:scale-[0.99]">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15">
            <Search className="size-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Consultar preço</p>
            <p className="text-sm text-white/70">
              {totalProdutos?.toLocaleString("pt-BR") ?? "—"} produtos
              disponíveis
            </p>
          </div>
          <ArrowRight
            className="size-5 shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Card>
      </Link>

      <div className="grid gap-3 sm:grid-cols-2">
        <AtalhoCard
          href="/orcamentos/novo"
          icone={FileText}
          titulo="Novo orçamento"
          descricao="Montar proposta para um cliente"
        />
        <AtalhoCard
          href="/clientes"
          icone={Users}
          titulo="Clientes"
          descricao="Cadastro e histórico"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Fabricantes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {fabricantes?.map((f) => (
            <Card key={f.id} className="flex-row items-center gap-3 p-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
                <Package className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <span className="font-medium">{f.nome}</span>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function AtalhoCard({
  href,
  icone: Icone,
  titulo,
  descricao,
}: {
  href: string;
  icone: React.ElementType;
  titulo: string;
  descricao: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full flex-row items-center gap-3 p-4 transition-colors hover:border-marca-dourado/40 hover:bg-accent/40">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-marca-dourado/15">
          <Icone
            className="size-5 text-marca-azul dark:text-marca-dourado"
            aria-hidden
          />
        </div>
        <div className="min-w-0">
          <p className="font-medium">{titulo}</p>
          <p className="truncate text-xs text-muted-foreground">{descricao}</p>
        </div>
      </Card>
    </Link>
  );
}
