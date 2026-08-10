"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entrar, type EstadoLogin } from "./actions";

function BotaoEntrar() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      className="w-full text-base"
      disabled={pending}
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" aria-hidden />
          Entrando…
        </>
      ) : (
        "Entrar"
      )}
    </Button>
  );
}

export function LoginForm({ proximo }: { proximo?: string }) {
  const [estado, acao] = useActionState<EstadoLogin, FormData>(entrar, {});
  const [verSenha, setVerSenha] = useState(false);
  const senhaRef = useRef<HTMLInputElement>(null);

  // apos erro, o e-mail volta preenchido e o cursor cai direto na senha
  useEffect(() => {
    if (estado.erro) senhaRef.current?.focus();
  }, [estado]);

  return (
    <form action={acao} className="space-y-5">
      {proximo ? <input type="hidden" name="proximo" value={proximo} /> : null}

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          placeholder="voce@exemplo.com"
          defaultValue={estado.email ?? ""}
          className="h-12 text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <div className="relative">
          <Input
            id="senha"
            name="senha"
            ref={senhaRef}
            type={verSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="h-12 pr-12 text-base"
          />
          <button
            type="button"
            onClick={() => setVerSenha((v) => !v)}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
          >
            {verSenha ? (
              <EyeOff className="size-5" aria-hidden />
            ) : (
              <Eye className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {estado.erro ? (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
        >
          {estado.erro}
        </p>
      ) : null}

      <BotaoEntrar />
    </form>
  );
}
