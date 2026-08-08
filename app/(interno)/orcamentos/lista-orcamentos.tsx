"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  FileDown,
  FilePlus,
  FileText,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarPreco, normalizar } from "@/lib/catalogo";
import { formatarData } from "@/lib/orcamento";
import {
  useRascunhos,
  useRascunhosProntos,
  type Rascunho,
} from "@/lib/rascunhos";
import { cn } from "@/lib/utils";
import { excluirOrcamento, salvarOrcamento } from "./actions";

export type OrcamentoLista = {
  id: string;
  numero: number;
  valor_total: number;
  criado_em: string;
  cliente: string;
  id_fabricante: string;
  fabricante: string;
};

/** Linha da lista, venha ela do banco ou do aparelho. */
type Linha = {
  chave: string;
  local: boolean;
  titulo: string;
  cliente: string;
  data: string;
  id_fabricante: string;
  fabricante: string;
  total: number;
  href: string;
  orcamento?: OrcamentoLista;
  rascunho?: Rascunho;
};

export function ListaOrcamentos({
  orcamentos,
}: {
  orcamentos: OrcamentoLista[];
}) {
  const [termo, setTermo] = useState("");
  const [empresa, setEmpresa] = useState<string | null>(null);
  const [aExcluir, setAExcluir] = useState<Linha | null>(null);
  const [processando, iniciar] = useTransition();

  const prontos = useRascunhosProntos();
  const rascunhos = useRascunhos((s) => s.rascunhos);
  const removerRascunho = useRascunhos((s) => s.remover);

  // rascunho primeiro: e trabalho pendente, tem que saltar aos olhos
  const linhas = useMemo<Linha[]>(
    () => [
      ...rascunhos.map((r) => ({
        chave: `rascunho-${r.id}`,
        local: true,
        titulo: "No aparelho",
        cliente: r.cliente || "Sem cliente",
        data: r.atualizado_em,
        id_fabricante: r.id_fabricante ?? "",
        fabricante: r.fabricante,
        total: r.total,
        href: `/orcamentos/rascunho/${r.id}`,
        rascunho: r,
      })),
      ...orcamentos.map((o) => ({
        chave: o.id,
        local: false,
        titulo: `Nº ${o.numero}`,
        cliente: o.cliente,
        data: o.criado_em,
        id_fabricante: o.id_fabricante,
        fabricante: o.fabricante,
        total: o.valor_total,
        href: `/orcamentos/${o.id}`,
        orcamento: o,
      })),
    ],
    [orcamentos, rascunhos],
  );

  const filtradas = useMemo(() => {
    const busca = normalizar(termo.trim());
    return linhas.filter((l) => {
      if (empresa && l.id_fabricante !== empresa) return false;
      if (!busca) return true;
      return normalizar(`${l.titulo} ${l.cliente} ${l.fabricante}`).includes(
        busca,
      );
    });
  }, [linhas, termo, empresa]);

  // so oferece filtro que existe na lista — filtro que sempre volta vazio
  // so atrapalha
  const empresasPresentes = useMemo(() => {
    const porId = new Map<string, string>();
    for (const l of linhas) {
      if (l.id_fabricante) porId.set(l.id_fabricante, l.fabricante);
    }
    return [...porId].map(([id, nome]) => ({ id, nome }));
  }, [linhas]);

  function enviar(r: Rascunho) {
    iniciar(async () => {
      try {
        const resultado = await salvarOrcamento({
          id: null,
          id_cliente: r.id_cliente ?? "",
          percentual_desconto: r.percentual_desconto,
          itens: r.itens.map((i) => ({
            id_produto: i.id_produto,
            quantidade: i.quantidade,
            percentual_desconto: i.percentual_desconto,
          })),
        });

        if (!resultado.ok) {
          toast.error(resultado.erro);
          return;
        }
        // so descarta a copia local depois que o banco confirmou
        removerRascunho(r.id);
        toast.success(`Orçamento ${resultado.numero} enviado`);
      } catch {
        toast.error("Sem conexão", {
          description: "O rascunho continua guardado no aparelho.",
        });
      }
    });
  }

  function excluir(linha: Linha) {
    iniciar(async () => {
      if (linha.rascunho) {
        removerRascunho(linha.rascunho.id);
      } else if (linha.orcamento) {
        await excluirOrcamento(linha.orcamento.id);
      }
      setAExcluir(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Orçamentos</h1>
        {/* Link com estilo de botao: o Button do Base UI exige um <button> */}
        <Link href="/orcamentos/novo" className={buttonVariants()}>
          <FilePlus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Novo orçamento</span>
          <span className="sm:hidden">Novo</span>
        </Link>
      </div>

      {linhas.length > 0 ? (
        <div className="space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar por número ou cliente…"
              aria-label="Buscar orçamento"
              autoComplete="off"
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

          {empresasPresentes.length > 1 ? (
            <div
              className="flex gap-2 overflow-x-auto pb-0.5"
              role="group"
              aria-label="Filtrar por empresa"
            >
              <Chip ativo={!empresa} onClick={() => setEmpresa(null)}>
                Todas
              </Chip>
              {empresasPresentes.map((f) => (
                <Chip
                  key={f.id}
                  ativo={empresa === f.id}
                  onClick={() => setEmpresa(f.id)}
                >
                  {f.nome}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!prontos ? (
        <ul className="space-y-2" aria-label="Carregando orçamentos">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="rounded-xl border bg-card p-3.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </li>
          ))}
        </ul>
      ) : linhas.length === 0 ? (
        <Vazio
          titulo="Nenhum orçamento ainda"
          descricao="Monte a primeira proposta escolhendo o cliente e os produtos."
          acao={
            <Link href="/orcamentos/novo" className={buttonVariants()}>
              <FilePlus className="size-4" aria-hidden />
              Novo orçamento
            </Link>
          }
        />
      ) : filtradas.length === 0 ? (
        <Vazio
          titulo="Nenhum resultado"
          descricao="Nada corresponde a essa busca ou filtro."
        />
      ) : (
        <ul className="space-y-2">
          {filtradas.map((l) => (
            <li
              key={l.chave}
              className={cn(
                "flex items-center gap-2 rounded-xl border p-3.5",
                l.local
                  ? "border-dashed border-marca-dourado/60 bg-marca-dourado/5"
                  : "bg-card",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {l.local ? (
                    <span className="rounded-full bg-marca-dourado/25 px-2 py-0.5 text-[11px] font-medium">
                      {l.titulo}
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">
                      {l.titulo}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate font-medium">{l.cliente}</p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                  <span>{formatarData(l.data)}</span>
                  {l.fabricante ? (
                    <>
                      <span>·</span>
                      <span className="truncate">{l.fabricante}</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-1.5 font-semibold tabular-nums">
                  {formatarPreco(l.total)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {l.rascunho ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Enviar"
                    disabled={processando}
                    onClick={() => enviar(l.rascunho!)}
                  >
                    <Upload className="size-4" aria-hidden />
                    <span className="sr-only">
                      Enviar rascunho de {l.cliente}
                    </span>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Exportar PDF"
                    onClick={() =>
                      toast.info("Exportação em PDF ainda não está pronta.")
                    }
                  >
                    <FileDown className="size-4" aria-hidden />
                    <span className="sr-only">Exportar {l.titulo} em PDF</span>
                  </Button>
                )}

                <Link
                  href={l.href}
                  title="Editar"
                  className={buttonVariants({ variant: "ghost", size: "icon" })}
                >
                  <Pencil className="size-4" aria-hidden />
                  <span className="sr-only">
                    Editar orçamento de {l.cliente}
                  </span>
                </Link>

                <Button
                  variant="ghost"
                  size="icon"
                  title="Excluir"
                  onClick={() => setAExcluir(l)}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden />
                  <span className="sr-only">
                    Excluir orçamento de {l.cliente}
                  </span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={aExcluir !== null}
        onOpenChange={(aberto) => !aberto && setAExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {aExcluir?.local
                ? "Descartar o rascunho?"
                : `Excluir o orçamento ${aExcluir?.titulo}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {aExcluir?.local
                ? "Ele existe só neste aparelho e não tem como voltar."
                : "Ele sai da lista. O histórico do cliente continua guardado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processando}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={processando}
              onClick={() => aExcluir && excluir(aExcluir)}
            >
              {processando
                ? "Excluindo…"
                : aExcluir?.local
                  ? "Descartar"
                  : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function Vazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        <FileText className="size-6 text-muted-foreground" aria-hidden />
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
