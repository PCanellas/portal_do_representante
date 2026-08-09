"use client";

import { useState } from "react";
import { Check, ChevronDown, Factory } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type FabricanteOpcao = {
  id: string;
  nome: string;
  tipo_imposto: "ST" | "IPI";
};

type Props = {
  fabricantes: FabricanteOpcao[];
  selecionado: string | null;
  /** Recebe a escolha ja confirmada — trocar de empresa esvazia os itens. */
  aoSelecionar: (id: string) => void;
};

export function SeletorFabricante({
  fabricantes,
  selecionado,
  aoSelecionar,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const atual = fabricantes.find((f) => f.id === selecionado) ?? null;

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger
        render={
          <button
            type="button"
            className="flex h-14 w-full items-center gap-3 rounded-xl border bg-card px-4 text-left transition-colors hover:bg-accent/40"
          />
        }
      >
        <div className="min-w-0 flex-1">
          {atual ? (
            <>
              <p className="truncate font-medium">{atual.nome}</p>
              <p className="text-xs text-muted-foreground">
                Imposto {atual.tipo_imposto}
              </p>
            </>
          ) : (
            <span className="text-muted-foreground">Selecionar empresa</span>
          )}
        </div>
        <ChevronDown
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </SheetTrigger>

      {/* `!` na altura: a classe base traz data-[side=bottom]:h-auto, de
          especificidade maior, e o painel cresceria com a lista */}
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh]! gap-3 rounded-t-2xl sm:max-w-none"
      >
        <SheetHeader className="pb-0">
          <SheetTitle>Empresa</SheetTitle>
          <SheetDescription>
            Cada orçamento é de um fabricante só.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {fabricantes.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma empresa cadastrada.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {fabricantes.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      aoSelecionar(f.id);
                      setAberto(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
                      f.id === selecionado
                        ? "border-marca-dourado bg-marca-dourado/10"
                        : "bg-card hover:bg-accent/40",
                    )}
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
                      <Factory
                        className="size-5 text-muted-foreground"
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{f.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Imposto {f.tipo_imposto}
                      </p>
                    </div>
                    {f.id === selecionado ? (
                      <Check
                        className="size-5 shrink-0 text-marca-azul dark:text-marca-dourado"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
