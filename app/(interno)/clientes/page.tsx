import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ListaClientes, type ClienteLista } from "./lista-clientes";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const supabase = await createClient();

  // o RLS ja limita aos clientes deste representante
  const { data } = await supabase
    .from("clientes")
    .select("id, nome, whatsapp, email")
    .neq("situacao", 2)
    .order("nome");

  return <ListaClientes clientes={(data ?? []) as ClienteLista[]} />;
}
