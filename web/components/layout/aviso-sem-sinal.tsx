"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConexao } from "@/lib/conexao";

/**
 * A tela de "nao deu para carregar", usada nos dois jeitos de isso acontecer:
 * ao trocar de tela sem sinal (pelo error.tsx) e ao abrir o app sem sinal
 * (pela rota /offline, servida pelo service worker).
 *
 * Uma so para as duas porque, para quem usa, e a mesma situacao. O texto muda
 * conforme o aparelho enxergue rede ou nao, e o botao existe sempre: o
 * navegador as vezes diz que ha conexao quando o wifi da loja nao leva a
 * lugar nenhum, e nesse caso so tentando para saber.
 */
export function AvisoSemSinal({
  aoTentarNovamente,
}: {
  aoTentarNovamente: () => void;
}) {
  const online = useConexao();

  return (
    <div className="flex flex-col items-center gap-4 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-muted">
        <WifiOff className="size-7 text-muted-foreground" aria-hidden />
      </div>

      <div className="space-y-1">
        <p className="text-lg font-semibold">
          {online ? "Não foi possível carregar" : "Sem conexão"}
        </p>
        <p className="max-w-xs text-sm text-balance text-muted-foreground">
          {online
            ? "A internet respondeu, mas esta tela não veio. Tente de novo."
            : "Esta tela precisa de internet. O catálogo de preços continua disponível no aparelho."}
        </p>
      </div>

      <Button size="lg" onClick={aoTentarNovamente}>
        <RefreshCw className="size-4" aria-hidden />
        Tentar novamente
      </Button>
    </div>
  );
}
