"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  buscarCatalogo,
  CHAVE_CATALOGO,
  SessaoExpirada,
} from "@/lib/use-catalogo";
import { cn } from "@/lib/utils";

/**
 * Rebaixa tudo que o aparelho guarda: o catalogo (produtos e fabricantes,
 * que ficam em localStorage) e os dados da tela em que ele esta, vindos do
 * servidor. Existe porque a carga de uma tabela nova acontece fora do app —
 * sem isto ele esperaria ate 6h para ver preco novo.
 */
export function BotaoAtualizar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [atualizando, setAtualizando] = useState(false);

  async function atualizar() {
    if (atualizando) return;
    setAtualizando(true);
    try {
      // fetchQuery com staleTime 0 forca ida a rede e propaga o erro —
      // refetchQueries resolveria em silencio se nao houvesse nada em cache
      const catalogo = await queryClient.fetchQuery({
        queryKey: CHAVE_CATALOGO,
        queryFn: buscarCatalogo,
        staleTime: 0,
      });

      // recarrega os componentes de servidor da rota atual (clientes,
      // orcamentos), que nao passam pelo React Query
      router.refresh();

      toast.success("Dados atualizados", {
        description: `${catalogo.produtos.length.toLocaleString("pt-BR")} produtos · ${catalogo.fabricantes.length} ${catalogo.fabricantes.length === 1 ? "empresa" : "empresas"}`,
      });
    } catch (erro) {
      if (erro instanceof SessaoExpirada) {
        toast.error("Sessão expirada", {
          description: "Entre de novo para continuar.",
        });
        router.push("/login");
        return;
      }
      toast.error("Não foi possível atualizar", {
        description: "Verifique a conexão e tente de novo.",
      });
    } finally {
      setAtualizando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={atualizar}
      disabled={atualizando}
      title="Atualizar dados"
      aria-label="Atualizar dados"
      className="grid size-9 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
    >
      <RefreshCw
        className={cn("size-4", atualizando && "animate-spin")}
        aria-hidden
      />
    </button>
  );
}
