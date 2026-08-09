"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { digitosNacionais, validarTelefone } from "@/lib/telefone";

const schema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome do cliente")
    .max(120, "Nome muito longo"),

  // opcional, mas se vier tem que ser um numero brasileiro valido
  whatsapp: z
    .string()
    .trim()
    .refine((v) => validarTelefone(v) === null, {
      message: "Número de WhatsApp inválido",
    }),

  email: z.union([
    z.string().trim().toLowerCase().email("E-mail inválido").max(150),
    z.literal(""),
  ]),
});

export type CamposCliente = { nome: string; whatsapp: string; email: string };

export type EstadoCliente = {
  erros?: Partial<Record<keyof CamposCliente, string>>;
  valores?: CamposCliente;
  /** Muda a cada gravacao bem-sucedida: e o sinal para o modal fechar. */
  salvoEm?: number;
};

export async function salvarCliente(
  _estado: EstadoCliente,
  formData: FormData,
): Promise<EstadoCliente> {
  const valores: CamposCliente = {
    nome: String(formData.get("nome") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  const id = formData.get("id") ? String(formData.get("id")) : null;

  const dados = schema.safeParse(valores);
  if (!dados.success) {
    // uma mensagem por campo, para o erro aparecer junto do input
    const erros: EstadoCliente["erros"] = {};
    for (const issue of dados.error.issues) {
      const campo = issue.path[0] as keyof CamposCliente;
      if (campo && !erros[campo]) erros[campo] = issue.message;
    }
    return { erros, valores };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const registro = {
    nome: dados.data.nome,
    whatsapp: dados.data.whatsapp
      ? digitosNacionais(dados.data.whatsapp) || null
      : null,
    email: dados.data.email || null,
  };

  const { error } = id
    ? await supabase.from("clientes").update(registro).eq("id", id)
    : await supabase
        .from("clientes")
        // o RLS exige que o dono seja quem esta gravando
        .insert({ ...registro, id_representante: user.id });

  if (error) {
    return {
      erros: { nome: "Não foi possível salvar. Tente de novo." },
      valores,
    };
  }

  revalidatePath("/clientes");
  // sem redirect: o formulario vive num modal sobre a propria lista, que o
  // revalidatePath acima ja atualiza
  return { salvoEm: Date.now() };
}

/** Nao apaga: marca como excluido para nao orfanar orcamentos antigos. */
export async function excluirCliente(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .update({ situacao: 2 })
    .eq("id", id);

  if (!error) revalidatePath("/clientes");
}
