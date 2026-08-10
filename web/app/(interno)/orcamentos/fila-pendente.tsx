"use client";

import { useState } from "react";
import { CloudUpload, LoaderCircle, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatarPreco } from "@/lib/catalogo";
import { formatarData } from "@/lib/orcamento";
import {
  useFilaHidratada,
  useFilaOrcamentos,
  type OrcamentoPendente,
} from "@/lib/fila-orcamentos";

/**
 * Os orcamentos fechados sem sinal, acima da lista que veio do servidor.
 *
 * Aparecem separados e nao misturados na lista porque nao sao a mesma coisa:
 * nao tem numero — quem numera e o banco —, nao geram PDF e nao abrem para
 * edicao. Some daqui quando sobe, e ai entra na lista de baixo com numero.
 */
export function FilaPendente() {
  const hidratada = useFilaHidratada();
  const pendentes = useFilaOrcamentos((s) => s.pendentes);
  const enviando = useFilaOrcamentos((s) => s.enviando);
  const descartar = useFilaOrcamentos((s) => s.descartar);
  const [aDescartar, setADescartar] = useState<OrcamentoPendente | null>(null);

  if (!hidratada || pendentes.length === 0) return null;

  return (
    <>
      <section
        aria-label="Aguardando envio"
        className="space-y-2 rounded-xl border border-marca-dourado/50 bg-marca-dourado/5 p-3"
      >
        <p className="flex items-center gap-2 text-sm font-medium">
          {enviando ? (
            <LoaderCircle
              className="size-4 animate-spin text-marca-azul dark:text-marca-dourado"
              aria-hidden
            />
          ) : (
            <CloudUpload
              className="size-4 text-marca-azul dark:text-marca-dourado"
              aria-hidden
            />
          )}
          {enviando
            ? "Enviando…"
            : `${pendentes.length} ${pendentes.length === 1 ? "orçamento fechado" : "orçamentos fechados"} sem sinal`}
        </p>
        <p className="text-xs text-muted-foreground">
          Sobem sozinhos quando a internet voltar. Ganham número na hora do
          envio.
        </p>

        <ul className="space-y-2">
          {pendentes.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.cliente}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{formatarData(p.criado_em)}</span>
                  {p.fabricante ? (
                    <>
                      <span>·</span>
                      <span>{p.fabricante}</span>
                    </>
                  ) : null}
                  <Badge variant="secondary" className="text-[11px]">
                    Pendente
                  </Badge>
                </div>
              </div>

              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatarPreco(p.valor_total)}
              </span>

              <Button
                variant="ghost"
                size="icon"
                title="Descartar"
                disabled={enviando}
                onClick={() => setADescartar(p)}
                className="shrink-0"
              >
                <Trash2 className="size-4" aria-hidden />
                <span className="sr-only">
                  Descartar orçamento de {p.cliente}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <AlertDialog
        open={aDescartar !== null}
        onOpenChange={(aberto) => !aberto && setADescartar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar este orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O orçamento de {aDescartar?.cliente} ainda não subiu. Descartado,
              ele se perde — não há cópia no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (aDescartar) descartar(aDescartar.id);
                setADescartar(null);
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
