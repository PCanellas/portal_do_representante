"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { digitosCnpj, validarCnpj } from "@/lib/cnpj";
import { digitosNacionais, validarTelefone } from "@/lib/telefone";

const schema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome do cliente")
    .max(120, "Nome muito longo"),

  // opcional, mas se vier tem que ser um CNPJ valido
  cnpj: z
    .string()
    .trim()
    .refine((v) => validarCnpj(v) === null, { message: "CNPJ inválido" }),

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

export type CamposCliente = {
  nome: string;
  cnpj: string;
  whatsapp: string;
  email: string;
};

export type ClienteSalvo = {
  id: string;
  nome: string;
  whatsapp: string | null;
};

export type EstadoCliente = {
  erros?: Partial<Record<keyof CamposCliente, string>>;
  valores?: CamposCliente;
  /** Muda a cada gravacao bem-sucedida: e o sinal para o modal fechar. */
  salvoEm?: number;
  /**
   * O que ficou gravado. Quem cadastra a partir do orcamento precisa do id
   * para ja deixar o cliente escolhido — sem isto ele teria que procurar na
   * lista o nome que acabou de digitar.
   */
  cliente?: ClienteSalvo;
};

export async function salvarCliente(
  _estado: EstadoCliente,
  formData: FormData,
): Promise<EstadoCliente> {
  const valores: CamposCliente = {
    nome: String(formData.get("nome") ?? ""),
    cnpj: String(formData.get("cnpj") ?? ""),
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
    cnpj: dados.data.cnpj ? digitosCnpj(dados.data.cnpj) || null : null,
    whatsapp: dados.data.whatsapp
      ? digitosNacionais(dados.data.whatsapp) || null
      : null,
    email: dados.data.email || null,
  };

  const { data, error } = id
    ? await supabase
        .from("clientes")
        .update(registro)
        .eq("id", id)
        .select("id, nome, whatsapp")
        .single()
    : await supabase
        .from("clientes")
        // o RLS exige que o dono seja quem esta gravando
        .insert({ ...registro, id_representante: user.id })
        .select("id, nome, whatsapp")
        .single();

  if (error || !data) {
    return {
      erros: { nome: "Não foi possível salvar. Tente de novo." },
      valores,
    };
  }

  revalidatePath("/clientes");
  // o seletor do orcamento tambem lista clientes, e ele pode ter acabado de
  // cadastrar um de dentro do orcamento
  revalidatePath("/orcamentos", "layout");
  // sem redirect: o formulario vive num modal sobre a propria lista, que o
  // revalidatePath acima ja atualiza
  return { salvoEm: Date.now(), cliente: data };
}

/**
 * Nao apaga: marca como excluido para nao orfanar orcamentos antigos.
 *
 * Devolve se deu certo. O RLS esconde o que nao e dele, e update em linha
 * escondida nao da erro — nao encontra nada e segue. Sem conferir a linha
 * devolvida, a tela anunciaria "excluido" para uma exclusao que nao houve, e
 * o cliente reapareceria na proxima abertura sem explicacao.
 */
export async function excluirCliente(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .update({ situacao: 2 })
    .eq("id", id)
    .select("id");

  if (error || !data?.length) {
    console.error("[excluirCliente]", { id, error });
    return { ok: false };
  }

  revalidatePath("/clientes");
  return { ok: true };
}
