"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Search, UserPlus, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { normalizar } from "@/lib/catalogo";
import { formatarTelefone } from "@/lib/telefone";
import { cn } from "@/lib/utils";

export type ClienteOpcao = {
  id: string;
  nome: string;
  whatsapp: string | null;
};

type Props = {
  clientes: ClienteOpcao[];
  selecionado: string | null;
  aoSelecionar: (id: string) => void;
  invalido?: boolean;
};

export function SeletorCliente({
  clientes,
  selecionado,
  aoSelecionar,
  invalido,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");

  const atual = clientes.find((c) => c.id === selecionado) ?? null;

  const filtrados = useMemo(() => {
    const busca = normalizar(termo.trim());
    if (!busca) return clientes;
    return clientes.filter((c) => normalizar(c.nome).includes(busca));
  }, [clientes, termo]);

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger
        render={
          // aria-invalid nao vale em botao; quem anuncia a falta do cliente
          // e a mensagem de erro do formulario, com role="alert"
          <button
            type="button"
            className={cn(
              "flex h-14 w-full items-center gap-3 rounded-xl border bg-card px-4 text-left transition-colors hover:bg-accent/40",
              invalido && "border-destructive",
            )}
          />
        }
      >
        <div className="min-w-0 flex-1">
          {atual ? (
            <>
              <p className="truncate font-medium">{atual.nome}</p>
              {atual.whatsapp ? (
                <p className="text-xs text-muted-foreground">
                  {formatarTelefone(atual.whatsapp)}
                </p>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">Selecionar cliente</span>
          )}
        </div>
        <ChevronDown
          className="size-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </SheetTrigger>

      {/* `!` na altura: a classe base traz data-[side=bottom]:h-auto, de
          especificidade maior, e o painel cresceria com a lista, empurrando
          o cabecalho e a busca para fora da tela */}
      <SheetContent
        side="bottom"
        className="flex h-[85dvh]! gap-3 rounded-t-2xl sm:max-w-none"
      >
        <SheetHeader className="pb-0">
          <SheetTitle>Cliente</SheetTitle>
          <SheetDescription className="sr-only">
            Escolha o cliente do orçamento
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar cliente…"
              aria-label="Buscar cliente"
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {clientes.length === 0
                  ? "Nenhum cliente cadastrado ainda."
                  : `Nada corresponde a "${termo}".`}
              </p>
              <Link href="/clientes/novo" className={buttonVariants()}>
                <UserPlus className="size-4" aria-hidden />
                Cadastrar cliente
              </Link>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {filtrados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      aoSelecionar(c.id);
                      setAberto(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
                      c.id === selecionado
                        ? "border-marca-dourado bg-marca-dourado/10"
                        : "bg-card hover:bg-accent/40",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.nome}</p>
                      {c.whatsapp ? (
                        <p className="text-xs text-muted-foreground">
                          {formatarTelefone(c.whatsapp)}
                        </p>
                      ) : null}
                    </div>
                    {c.id === selecionado ? (
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
