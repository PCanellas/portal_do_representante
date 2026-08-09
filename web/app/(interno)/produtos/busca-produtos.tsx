"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, Pencil, RefreshCw, Search, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  CHAVE_CATALOGO,
  SessaoExpirada,
  useCatalogo,
} from "@/lib/use-catalogo";
import { useBuscaProdutos } from "@/lib/use-busca-produtos";
import { formatarPreco, type Catalogo, type Produto } from "@/lib/catalogo";
import { cn } from "@/lib/utils";
import { FormularioProduto } from "./formulario-produto";

const MAX_VISIVEL = 60;

export function BuscaProdutos() {
  const { data, isLoading, isError, isFetching, error, refetch } =
    useCatalogo();
  const [termo, setTermo] = useState("");
  const [fabricante, setFabricante] = useState<string | null>(null);
  const [emEdicao, setEmEdicao] = useState<Produto | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  /**
   * Troca so o produto editado no catalogo guardado no aparelho.
   *
   * Rebaixar o catalogo inteiro a cada correcao seriam 1.704 produtos pela
   * rede para mudar uma linha. O que a action devolve ja veio do banco,
   * entao e a mesma verdade, sem a viagem.
   */
  function atualizarCache(atualizado: Produto) {
    queryClient.setQueryData<Catalogo>(CHAVE_CATALOGO, (atual) =>
      atual
        ? {
            ...atual,
            produtos: atual.produtos.map((p) =>
              p.id === atualizado.id ? atualizado : p,
            ),
          }
        : atual,
    );
    setEmEdicao(null);
  }

  // sessao caiu com o app aberto: volta para o login preservando o destino
  useEffect(() => {
    if (error instanceof SessaoExpirada) {
      router.push("/login?proximo=/produtos");
    }
  }, [error, router]);

  const produtos = useMemo(
    () =>
      (data?.produtos ?? []).filter(
        (p) => !fabricante || p.id_fabricante === fabricante,
      ),
    [data, fabricante],
  );

  const resultados = useBuscaProdutos(produtos, termo);

  const nomeFabricante = (id: string) =>
    data?.fabricantes.find((f) => f.id === id)?.nome ?? "";

  return (
    <div className="space-y-4">
      {/* a barra acompanha a rolagem: ele refina a busca olhando o resultado */}
      <div className="sticky top-[var(--altura-cabecalho)] z-30 -mx-4 space-y-3 border-b bg-background/95 px-4 pt-1 pb-3 backdrop-blur">
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

        {data && data.fabricantes.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <Chip ativo={!fabricante} onClick={() => setFabricante(null)}>
              Todos
            </Chip>
            {data.fabricantes.map((f) => (
              <Chip
                key={f.id}
                ativo={fabricante === f.id}
                onClick={() => setFabricante(f.id)}
              >
                {f.nome}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <ListaCarregando />
      ) : isError ? (
        <Aviso
          icone={CloudOff}
          titulo="Não foi possível carregar o catálogo"
          descricao="Verifique a conexão e tente de novo."
          acao={
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="size-4" aria-hidden />
              Tentar de novo
            </Button>
          }
        />
      ) : resultados.length === 0 ? (
        <Aviso
          icone={Search}
          titulo="Nenhum produto encontrado"
          descricao={`Nada corresponde a "${termo}". Tente outro termo ou parte do código.`}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {resultados.length.toLocaleString("pt-BR")}{" "}
            {resultados.length === 1 ? "produto" : "produtos"}
            {resultados.length > MAX_VISIVEL
              ? ` · mostrando os ${MAX_VISIVEL} mais relevantes`
              : ""}
            {isFetching ? " · atualizando…" : ""}
          </p>

          <ul className="space-y-2">
            {resultados.slice(0, MAX_VISIVEL).map((p) => (
              <CartaoProduto
                key={p.id}
                produto={p}
                fabricante={nomeFabricante(p.id_fabricante)}
                aoEditar={() => setEmEdicao(p)}
              />
            ))}
          </ul>
        </>
      )}

      {/* `key` remonta o formulario a cada abertura: sem isso ele guardaria
          os campos do produto anterior */}
      <Sheet
        open={emEdicao !== null}
        onOpenChange={(aberto) => !aberto && setEmEdicao(null)}
      >
        <SheetContent
          side="bottom"
          className="max-h-[92dvh]! overflow-y-auto rounded-t-2xl sm:max-w-none"
        >
          <SheetHeader>
            <SheetTitle>Editar produto</SheetTitle>
            <SheetDescription>
              Para corrigir a carga, ajustar um preço ou marcar em falta.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {emEdicao ? (
              <FormularioProduto
                key={emEdicao.id}
                produto={emEdicao}
                fabricante={nomeFabricante(emEdicao.id_fabricante)}
                aoSalvar={atualizarCache}
                aoCancelar={() => setEmEdicao(null)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
        ativo
          ? "border-transparent bg-marca-navy text-white dark:bg-marca-dourado dark:text-marca-navy"
          : "bg-background hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function CartaoProduto({
  produto,
  fabricante,
  aoEditar,
}: {
  produto: Produto;
  fabricante: string;
  aoEditar: () => void;
}) {
  const semPreco = produto.preco_unitario === 0;
  const emFalta = produto.situacao === 0;

  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-xl border p-3.5 transition-colors",
        emFalta
          ? "border-dashed bg-muted/40"
          : "bg-card hover:border-marca-dourado/40",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug font-medium">{produto.descricao}</p>
        {produto.variante ? (
          <p className="mt-0.5 text-xs text-marca-azul dark:text-marca-dourado">
            {produto.variante}
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs text-muted-foreground">
            {produto.referencia}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{fabricante}</span>
          {emFalta ? (
            <Badge variant="destructive" className="text-[11px]">
              Em falta
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {semPreco ? (
          <Badge variant="secondary" className="text-[11px]">
            Sem preço
          </Badge>
        ) : (
          <>
            <p className="text-base leading-tight font-semibold tabular-nums">
              {formatarPreco(produto.preco_unitario)}
            </p>
            {produto.porcentagem_imposto > 0 ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                +{produto.porcentagem_imposto.toLocaleString("pt-BR")}% imp.
              </p>
            ) : null}
          </>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        title="Editar produto"
        onClick={aoEditar}
        className="shrink-0"
      >
        <Pencil className="size-4" aria-hidden />
        <span className="sr-only">Editar {produto.descricao}</span>
      </Button>
    </li>
  );
}

function ListaCarregando() {
  return (
    <ul className="space-y-2" aria-label="Carregando produtos">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="rounded-xl border bg-card p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Aviso({
  icone: Icone,
  titulo,
  descricao,
  acao,
}: {
  icone: React.ElementType;
  titulo: string;
  descricao: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        <Icone className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <div>
        <p className="font-medium">{titulo}</p>
        <p className="mt-1 text-sm text-balance text-muted-foreground">
          {descricao}
        </p>
      </div>
      {acao}
    </div>
  );
}
