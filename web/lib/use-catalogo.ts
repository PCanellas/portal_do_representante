"use client";

import { useQuery } from "@tanstack/react-query";
import type { Catalogo } from "@/lib/catalogo";

/** Sinaliza sessao expirada para a tela redirecionar ao login. */
export class SessaoExpirada extends Error {
  constructor() {
    super("Sessão expirada");
    this.name = "SessaoExpirada";
  }
}

export const CHAVE_CATALOGO = ["catalogo"];

export async function buscarCatalogo(): Promise<Catalogo> {
  const r = await fetch("/api/catalogo");
  if (r.status === 401) throw new SessaoExpirada();
  if (!r.ok) throw new Error("Não foi possível carregar o catálogo");
  return r.json();
}

/**
 * Catalogo completo, baixado uma vez e mantido em cache pelo React Query
 * (persistido em localStorage — ver providers.tsx). Fica disponivel offline.
 *
 * O nome precisa comecar com "use": o React e o compiler identificam hooks
 * por esse prefixo.
 */
export function useCatalogo() {
  return useQuery({
    queryKey: CHAVE_CATALOGO,
    queryFn: buscarCatalogo,
    staleTime: 1000 * 60 * 60 * 6, // revalida a cada 6h de uso
    retry: (falhas, erro) => !(erro instanceof SessaoExpirada) && falhas < 1,
  });
}
