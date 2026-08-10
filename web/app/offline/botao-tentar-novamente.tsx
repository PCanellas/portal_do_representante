"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConexao } from "@/lib/conexao";

/**
 * Vai para a raiz, e nao recarrega esta tela.
 *
 * Recarregar era o obvio e estava errado: esta pagina e /offline, entao com
 * o sinal de volta a recarga traria /offline de novo e ele ficaria preso na
 * tela de sem-sinal com a internet funcionando. Indo para a raiz, o servidor
 * encaminha para onde ele deve estar; ainda sem sinal, o service worker
 * devolve para ca e nada se perde.
 *
 * O botao fica sempre habilitado, mesmo com o navegador dizendo que nao ha
 * rede. `navigator.onLine` erra para os dois lados, e um botao desabilitado
 * com a internet ja de volta seria pior do que uma tentativa que falha.
 */
export function BotaoTentarNovamente() {
  const online = useConexao();

  return (
    <Button
      size="lg"
      variant={online ? "default" : "outline"}
      // Navegacao de documento de proposito, e nao router.push, que e o que
      // o lint pede: push faz o roteador buscar o payload RSC no servidor —
      // exatamente o que nao responde quando se esta nesta tela. Recarregar
      // a pagina inteira e o unico caminho que funciona nos dois estados.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      onClick={() => location.assign("/")}
      className="w-full sm:w-auto"
    >
      <RefreshCw className="size-4" aria-hidden />
      {online ? "Conectado — entrar no app" : "Tentar novamente"}
    </Button>
  );
}
