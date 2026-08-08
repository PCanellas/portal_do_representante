"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Plus, Search, TriangleAlert, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarPreco, type Produto } from "@/lib/catalogo";
import { formatarQuantidade } from "@/lib/orcamento";
import { useBuscaProdutos } from "@/lib/use-busca-produtos";
import { SessaoExpirada, useCatalogo } from "@/lib/use-catalogo";
import { useCarrinho } from "@/lib/carrinho";
import { cn } from "@/lib/utils";

const MAX_VISIVEL = 50;

/**
 * Controlado de fora de proposito: os botoes que abrem isto vivem em partes
 * da tela que aparecem e somem conforme o orcamento tem itens. Com o sheet
 * montado junto do gatilho, adicionar o primeiro produto desmontava o
 * gatilho — e o painel fechava sozinho.
 */
type Props = {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
};

export function SeletorProdutos({ aberto, aoMudarAberto }: Props) {
  const [termo, setTermo] = useState("");
  const router = useRouter();

  const { data, isLoading, isError, error } = useCatalogo();
  const idFabricante = useCarrinho((s) => s.id_fabricante);
  const itens = useCarrinho((s) => s.itens);
  const adicionar = useCarrinho((s) => s.adicionar);

  useEffect(() => {
    if (error instanceof SessaoExpirada)
      router.push("/login?proximo=/orcamentos");
  }, [error, router]);

  const quantidadePorProduto = useMemo(
    () => new Map(itens.map((i) => [i.id_produto, i.quantidade])),
    [itens],
  );

  // A empresa ja foi escolhida na tela do orcamento: aqui a lista mostra
  // so o que pode de fato entrar neste orcamento.
  const disponiveis = useMemo(() => {
    const todos = data?.produtos ?? [];
    return todos.filter(
      (p) =>
        // inativo nao entra em orcamento — e a regra combinada para "sem
        // estoque" ou "fora de linha"
        p.situacao === 1 && p.id_fabricante === idFabricante,
    );
  }, [data, idFabricante]);

  const resultados = useBuscaProdutos(disponiveis, termo);

  const nomeFabricante =
    data?.fabricantes.find((f) => f.id === idFabricante)?.nome ?? null;

  return (
    <Sheet open={aberto} onOpenChange={aoMudarAberto}>
      {/* `!` na altura: a classe base do Sheet traz data-[side=bottom]:h-auto,
          que tem especificidade maior e faria o painel crescer com a lista,
          empurrando o cabecalho e a busca para fora da tela. */}
      <SheetContent
        side="bottom"
        className="flex h-[90dvh]! gap-3 rounded-t-2xl sm:max-w-none"
      >
        <SheetHeader className="pb-0">
          <SheetTitle>Adicionar produto</SheetTitle>
          <SheetDescription>{nomeFabricante ?? "Catálogo"}</SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar por nome ou código…"
              aria-label="Buscar produtos"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-12 pr-11 pl-11 text-base"
            />
            {termo ? (
              <button
                type="button"
                onClick={() => setTermo("")}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-0 grid h-12 w-11 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {isLoading ? (
            <ul className="space-y-2" aria-label="Carregando produtos">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="rounded-xl border bg-card p-3.5">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="mt-2 h-3 w-1/3" />
                </li>
              ))}
            </ul>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CloudOff className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar o catálogo.
              </p>
            </div>
          ) : resultados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Search className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {termo
                  ? `Nada corresponde a "${termo}".`
                  : "Nenhum produto disponível."}
              </p>
            </div>
          ) : (
            <>
              <p className="pb-2 text-xs text-muted-foreground">
                {resultados.length.toLocaleString("pt-BR")}{" "}
                {resultados.length === 1 ? "produto" : "produtos"}
                {resultados.length > MAX_VISIVEL
                  ? ` · mostrando os ${MAX_VISIVEL} mais relevantes`
                  : ""}
              </p>
              <ul className="space-y-2">
                {resultados.slice(0, MAX_VISIVEL).map((p) => (
                  <LinhaProduto
                    key={p.id}
                    produto={p}
                    noOrcamento={quantidadePorProduto.get(p.id)}
                    aoAdicionar={() => adicionar(p)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LinhaProduto({
  produto,
  noOrcamento,
  aoAdicionar,
}: {
  produto: Produto;
  noOrcamento?: number;
  aoAdicionar: () => void;
}) {
  const semPreco = produto.preco_unitario === 0;

  return (
    <li>
      <button
        type="button"
        onClick={aoAdicionar}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
          noOrcamento
            ? "border-marca-dourado/60 bg-marca-dourado/5"
            : "bg-card hover:bg-accent/40",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-medium">
            {produto.descricao}
          </p>
          {produto.variante ? (
            <p className="mt-0.5 text-xs text-marca-azul dark:text-marca-dourado">
              {produto.variante}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-xs text-muted-foreground">
              {produto.referencia}
            </span>
            {semPreco ? (
              <Badge variant="destructive" className="gap-1 text-[11px]">
                <TriangleAlert aria-hidden />
                Sem preço
              </Badge>
            ) : (
              <span className="text-xs font-semibold tabular-nums">
                {formatarPreco(produto.preco_unitario)}
              </span>
            )}
            {produto.porcentagem_imposto > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                +{produto.porcentagem_imposto.toLocaleString("pt-BR")}% imp.
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0">
          {noOrcamento ? (
            <span className="grid size-9 place-items-center rounded-lg bg-marca-dourado text-sm font-semibold text-marca-navy tabular-nums">
              {formatarQuantidade(noOrcamento)}
            </span>
          ) : (
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"
            >
              <Plus className="size-5" />
            </span>
          )}
          <span className="sr-only">
            Adicionar {produto.descricao}
            {noOrcamento
              ? ` (${formatarQuantidade(noOrcamento)} no orçamento)`
              : ""}
          </span>
        </div>
      </button>
    </li>
  );
}
