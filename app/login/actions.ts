"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
  proximo: z.string().optional(),
});

/**
 * `email` volta no estado porque o React reseta o formulario apos a action.
 * Sem isso o campo esvazia a cada erro e ele redigita tudo. A senha nunca
 * e devolvida.
 */
export type EstadoLogin = { erro?: string; email?: string };

export async function entrar(
  _estado: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const emailDigitado = String(formData.get("email") ?? "");

  const dados = schema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
    proximo: formData.get("proximo") ?? undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0].message, email: emailDigitado };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: dados.data.email,
    password: dados.data.senha,
  });

  if (error) {
    // mensagem generica de proposito: nao revelar se o e-mail existe
    return { erro: "E-mail ou senha incorretos.", email: emailDigitado };
  }

  // so aceita caminho interno: "//host" ou "https://..." viraria redirect aberto
  const proximo = dados.data.proximo;
  const destino =
    proximo && proximo.startsWith("/") && !proximo.startsWith("//")
      ? proximo
      : "/home";
  redirect(destino);
}
