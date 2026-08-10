"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  FileDown,
  FilePlus,
  FileText,
  LoaderCircle,
  Lock,
  Pencil,
  Search,
  Trash2,
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
import { formatarPreco, normalizar } from "@/lib/catalogo";
import { formatarData } from "@/lib/orcamento";
import { compartilharOrcamento } from "@/lib/pdf/compartilhar";
import { cn } from "@/lib/utils";
import { dadosParaPdf, excluirOrcamento } from "./actions";

export type OrcamentoLista = {
  id: string;
  numero: number;
  valor_total: number;
  criado_em: string;
  cliente: string;
  id_fabricante: string;
  fabricante: string;
  /** anterior à tabela vigente da empresa: abre só para consulta e PDF */
  bloqueado: boolean;
};

export function ListaOrcamentos({
  orcamentos,
}: {
  orcamentos: OrcamentoLista[];
}) {
  const [termo, setTermo] = useState("");
  const [empresa, setEmpresa] = useState<string | null>(null);
  const [aExcluir, setAExcluir] = useState<OrcamentoLista | null>(null);
  const [processando, iniciar] = useTransition();
  // guarda o id em vez de um booleano: o giro aparece so no botao tocado
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null);

  async function exportarPdf(o: OrcamentoLista) {
    if (gerandoPdf) return;
    setGerandoPdf(o.id);
    try {
      const r = await dadosParaPdf(o.id);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      const fim = await compartilharOrcamento(r.dados);
      if (fim === "baixado") toast.success("PDF baixado");
    } catch {
      toast.error("Não foi possível gerar o PDF", {
        description: "Tente de novo em instantes.",
      });
    } finally {
      setGerandoPdf(null);
    }
  }

  const filtrados = useMemo(() => {
    const busca = normalizar(termo.trim());
    return orcamentos.filter((o) => {
      if (empresa && o.id_fabricante !== empresa) return false;
      if (!busca) return true;
      return normalizar(`${o.numero} ${o.cliente} ${o.fabricante}`).includes(
        busca,
      );
    });
  }, [orcamentos, termo, empresa]);

  // so oferece filtro que existe na lista — filtro que sempre volta vazio
  // so atrapalha
  const empresasPresentes = useMemo(() => {
    const porId = new Map<string, string>();
    for (const o of orcamentos) porId.set(o.id_fabricante, o.fabricante);
    return [...porId].map(([id, nome]) => ({ id, nome }));
  }, [orcamentos]);

  function excluir(o: OrcamentoLista) {
    iniciar(async () => {
      let r;
      try {
        r = await excluirOrcamento(o.id);
      } catch {
        toast.error("Não foi possível excluir", {
          description: "Verifique a conexão e tente de novo.",
        });
        return;
      }
      if (!r.ok) {
        toast.error("Não foi possível excluir", {
          description: "O orçamento continua na lista. Tente de novo.",
        });
        return;
      }
      toast.success(`Orçamento ${o.numero} excluído`);
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

      {orcamentos.length > 0 ? (
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

      {orcamentos.length === 0 ? (
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
      ) : filtrados.length === 0 ? (
        <Vazio
          titulo="Nenhum resultado"
          descricao="Nada corresponde a essa busca ou filtro."
        />
      ) : (
        <ul className="space-y-2">
          {filtrados.map((o) => (
            <li
              key={o.id}
              className="flex items-center gap-2 rounded-xl border bg-card p-3.5"
            >
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs text-muted-foreground">
                  Nº {o.numero}
                </span>
                <p className="mt-1 truncate font-medium">{o.cliente}</p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                  <span>{formatarData(o.criado_em)}</span>
                  {o.fabricante ? (
                    <>
                      <span>·</span>
                      <span className="truncate">{o.fabricante}</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-1.5 font-semibold tabular-nums">
                  {formatarPreco(o.valor_total)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Compartilhar PDF"
                  disabled={gerandoPdf !== null}
                  onClick={() => exportarPdf(o)}
                >
                  {gerandoPdf === o.id ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <FileDown className="size-4" aria-hidden />
                  )}
                  <span className="sr-only">
                    Compartilhar orçamento {o.numero} em PDF
                  </span>
                </Button>

                {/* Bloqueado ainda abre — ele consulta e tira PDF. O que
                    muda e o icone, que promete o que a tela vai entregar. */}
                <Link
                  href={`/orcamentos/${o.id}`}
                  title={o.bloqueado ? "Ver (tabela antiga)" : "Editar"}
                  className={buttonVariants({ variant: "ghost", size: "icon" })}
                >
                  {o.bloqueado ? (
                    <Lock
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  ) : (
                    <Pencil className="size-4" aria-hidden />
                  )}
                  <span className="sr-only">
                    {o.bloqueado ? "Ver" : "Editar"} orçamento {o.numero}
                  </span>
                </Link>

                <Button
                  variant="ghost"
                  size="icon"
                  title="Excluir"
                  onClick={() => setAExcluir(o)}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden />
                  <span className="sr-only">Excluir orçamento {o.numero}</span>
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
              Excluir o orçamento {aExcluir?.numero}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ele sai da lista. O histórico do cliente continua guardado.
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
              {processando ? "Excluindo…" : "Excluir"}
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
