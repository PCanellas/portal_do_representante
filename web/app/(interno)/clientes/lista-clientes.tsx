"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  MessageCircle,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  Users,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizar } from "@/lib/catalogo";
import { formatarCnpj } from "@/lib/cnpj";
import { formatarTelefone, linkWhatsApp } from "@/lib/telefone";
import { excluirCliente } from "./actions";
import { FormularioCliente } from "./formulario-cliente";

export type ClienteLista = {
  id: string;
  nome: string;
  cnpj: string | null;
  whatsapp: string | null;
  email: string | null;
};

/** null = fechado; "novo" = cadastro; um cliente = edicao. */
type Formulario = null | "novo" | ClienteLista;

export function ListaClientes({ clientes }: { clientes: ClienteLista[] }) {
  const [termo, setTermo] = useState("");
  const [aExcluir, setAExcluir] = useState<ClienteLista | null>(null);
  const [excluindo, iniciarExclusao] = useTransition();
  const [formulario, setFormulario] = useState<Formulario>(null);

  // referencia estavel: o formulario chama isto de dentro de um efeito
  const fechar = useCallback(() => setFormulario(null), []);

  const filtrados = useMemo(() => {
    const busca = normalizar(termo.trim());
    if (!busca) return clientes;
    return clientes.filter((c) =>
      normalizar(
        `${c.nome} ${c.cnpj ?? ""} ${c.whatsapp ?? ""} ${c.email ?? ""}`,
      ).includes(busca),
    );
  }, [clientes, termo]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <Button onClick={() => setFormulario("novo")}>
          <UserPlus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Novo cliente</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {clientes.length > 0 ? (
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
      ) : null}

      {clientes.length === 0 ? (
        <Vazio
          titulo="Nenhum cliente cadastrado"
          descricao="Cadastre o primeiro cliente para começar a emitir orçamentos."
          acao={
            <Button onClick={() => setFormulario("novo")}>
              <UserPlus className="size-4" aria-hidden />
              Cadastrar cliente
            </Button>
          }
        />
      ) : filtrados.length === 0 ? (
        <Vazio
          titulo="Nenhum resultado"
          descricao={`Nada corresponde a "${termo}".`}
        />
      ) : (
        <ul className="space-y-2">
          {filtrados.map((c) => {
            const zap = c.whatsapp ? linkWhatsApp(c.whatsapp) : null;
            return (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.nome}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    {c.cnpj ? <span>{formatarCnpj(c.cnpj)}</span> : null}
                    {c.cnpj && (c.whatsapp || c.email) ? <span>·</span> : null}
                    {c.whatsapp ? (
                      <span>{formatarTelefone(c.whatsapp)}</span>
                    ) : null}
                    {c.whatsapp && c.email ? <span>·</span> : null}
                    {c.email ? (
                      <span className="truncate">{c.email}</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {zap ? (
                    <a
                      href={zap}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir no WhatsApp"
                      className={buttonVariants({
                        variant: "ghost",
                        size: "icon",
                      })}
                    >
                      <MessageCircle className="size-4" aria-hidden />
                      <span className="sr-only">Abrir no WhatsApp</span>
                    </a>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Editar"
                    onClick={() => setFormulario(c)}
                  >
                    <Pencil className="size-4" aria-hidden />
                    <span className="sr-only">Editar {c.nome}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Excluir"
                    onClick={() => setAExcluir(c)}
                  >
                    <Trash2 className="size-4 text-destructive" aria-hidden />
                    <span className="sr-only">Excluir {c.nome}</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* `key` remonta o formulario a cada abertura: sem isso ele guardaria o
          estado do cliente anterior. `!` na altura porque a classe base do
          Sheet traz data-[side=bottom]:h-auto, de especificidade maior. */}
      <Sheet
        open={formulario !== null}
        onOpenChange={(aberto) => !aberto && setFormulario(null)}
      >
        <SheetContent
          side="bottom"
          className="max-h-[90dvh]! overflow-y-auto rounded-t-2xl sm:max-w-none"
        >
          <SheetHeader>
            <SheetTitle>
              {formulario === "novo" ? "Novo cliente" : "Editar cliente"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Dados de contato do cliente
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {formulario ? (
              <FormularioCliente
                key={formulario === "novo" ? "novo" : formulario.id}
                cliente={formulario === "novo" ? undefined : formulario}
                aoConcluir={fechar}
                aoCancelar={fechar}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={aExcluir !== null}
        onOpenChange={(aberto) => !aberto && setAExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {aExcluir?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente sai da lista, mas os orçamentos já emitidos para ele
              continuam guardados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={() => {
                const alvo = aExcluir;
                if (!alvo) return;
                iniciarExclusao(async () => {
                  const r = await excluirCliente(alvo.id).catch(() => ({
                    ok: false,
                  }));
                  if (!r.ok) {
                    toast.error("Não foi possível excluir", {
                      description: "O cliente continua na lista.",
                    });
                    return;
                  }
                  toast.success(`${alvo.nome} excluído`);
                  setAExcluir(null);
                });
              }}
            >
              {excluindo ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
        <Users className="size-6 text-muted-foreground" aria-hidden />
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
