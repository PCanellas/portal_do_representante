"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarTelefone, validarTelefone } from "@/lib/telefone";
import { salvarCliente, type EstadoCliente } from "./actions";
import { cn } from "@/lib/utils";

type Props = {
  cliente?: {
    id: string;
    nome: string;
    whatsapp: string | null;
    email: string | null;
  };
  /** Chamado quando a gravacao dá certo — o modal se fecha por aqui. */
  aoConcluir: () => void;
  aoCancelar: () => void;
};

function BotaoSalvar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="flex-1" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" aria-hidden />
          Salvando…
        </>
      ) : (
        "Salvar"
      )}
    </Button>
  );
}

function Erro({ id, mensagem }: { id: string; mensagem?: string }) {
  if (!mensagem) return null;
  return (
    <p id={id} role="alert" className="text-sm font-medium text-destructive">
      {mensagem}
    </p>
  );
}

export function FormularioCliente({ cliente, aoConcluir, aoCancelar }: Props) {
  const [estado, acao] = useActionState<EstadoCliente, FormData>(
    salvarCliente,
    {},
  );

  // formata enquanto digita; o servidor guarda so os digitos
  const [whatsapp, setWhatsapp] = useState(
    formatarTelefone(estado.valores?.whatsapp ?? cliente?.whatsapp ?? ""),
  );
  // valida ao sair do campo, nao a cada tecla: avisar no meio da digitacao irrita
  const [erroZap, setErroZap] = useState<string | null>(null);

  const erroWhatsapp = erroZap ?? estado.erros?.whatsapp;

  // gravou: avisa quem abriu o formulario para fechar
  const salvoEm = estado.salvoEm;
  useEffect(() => {
    if (salvoEm) aoConcluir();
  }, [salvoEm, aoConcluir]);

  return (
    <form action={acao} className="space-y-5" noValidate>
      {cliente ? <input type="hidden" name="id" value={cliente.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="nome">
          Nome <span className="text-destructive">*</span>
        </Label>
        <Input
          id="nome"
          name="nome"
          required
          maxLength={120}
          autoFocus={!cliente}
          aria-invalid={!!estado.erros?.nome}
          aria-describedby={estado.erros?.nome ? "erro-nome" : undefined}
          defaultValue={estado.valores?.nome ?? cliente?.nome ?? ""}
          placeholder="Nome do cliente ou da loja"
          className="h-12 text-base"
        />
        <Erro id="erro-nome" mensagem={estado.erros?.nome} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="whatsapp">WhatsApp</Label>
        <Input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          inputMode="numeric"
          value={whatsapp}
          onChange={(e) => {
            setWhatsapp(formatarTelefone(e.target.value));
            if (erroZap) setErroZap(null);
          }}
          onBlur={(e) => setErroZap(validarTelefone(e.target.value))}
          aria-invalid={!!erroWhatsapp}
          aria-describedby={erroWhatsapp ? "erro-whatsapp" : undefined}
          placeholder="(21) 99999-9999"
          className={cn("h-12 text-base", erroWhatsapp && "border-destructive")}
        />
        <Erro id="erro-whatsapp" mensagem={erroWhatsapp ?? undefined} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          maxLength={150}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={!!estado.erros?.email}
          aria-describedby={estado.erros?.email ? "erro-email" : undefined}
          defaultValue={estado.valores?.email ?? cliente?.email ?? ""}
          placeholder="cliente@exemplo.com"
          className={cn(
            "h-12 text-base",
            estado.erros?.email && "border-destructive",
          )}
        />
        <Erro id="erro-email" mensagem={estado.erros?.email} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" size="lg" onClick={aoCancelar}>
          Cancelar
        </Button>
        <BotaoSalvar />
      </div>
    </form>
  );
}
