import Image from "next/image";
import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { BuscaProdutos } from "../(interno)/produtos/busca-produtos";
import { BotaoTentarNovamente } from "./botao-tentar-novamente";

export const metadata: Metadata = { title: "Sem conexão" };

/**
 * A tela que o service worker serve quando nao ha rede e nao ha nada melhor
 * guardado.
 *
 * Fica fora de (interno) e fora do proxy de propósito: precisa ser estatica
 * de verdade, sem consulta ao Supabase, para o service worker guardar uma
 * copia utilizavel na instalacao. Uma rota protegida responderia com o
 * redirecionamento para o login, e era isso que ficaria em cache.
 *
 * Nao mostrar dado nenhum do servidor tambem e o que a torna segura sendo
 * publica: os produtos vem do catalogo que ja esta no aparelho de quem
 * abriu. Quem nunca entrou ve uma busca vazia.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 pt-[calc(var(--safe-topo)+1rem)] pb-8">
      <div className="flex items-center gap-3">
        <Image
          src="/logo-simbolo.png"
          alt=""
          width={40}
          height={40}
          className="size-9 w-auto"
        />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sem conexão</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <WifiOff className="size-3.5" aria-hidden />
            Consulta de preços com o catálogo do aparelho
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Preço, ficha técnica e código continuam disponíveis. Orçamento e
          edição de produto voltam quando o sinal voltar.
        </p>
        <BotaoTentarNovamente />
      </div>

      <BuscaProdutos somenteLeitura />
    </main>
  );
}
