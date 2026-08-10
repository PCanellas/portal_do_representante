"use client";

import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/**
 * 24 dias, nao 30.
 *
 * gcTime vira um setTimeout, e timeout nao cabe em 32 bits estoura: em vez
 * de esperar, dispara quase na hora. Com 30 dias o catalogo era descartado
 * da memoria assim que a tela de produtos perdia o ultimo observador — ou
 * seja, ao sair da tela — e voltar significava buscar tudo de novo. O teto
 * e 24,8 dias; 24 fica dentro com folga.
 */
const VINTE_E_QUATRO_DIAS = 1000 * 60 * 60 * 24 * 24;

/**
 * Muda quando o formato do que guardamos muda, e descarta o cache antigo.
 *
 * Sem isso, o aparelho que ja tinha o catalogo guardado continuaria servindo
 * a versao sem o campo novo por ate 6 horas — o produto apareceria sem ficha
 * tecnica e ninguem saberia por que. Anotar aqui o que entrou em cada versao:
 *
 *   2  ficha tecnica do produto (`detalhes`)
 */
const VERSAO_CACHE = "2";

/**
 * PersistQueryClientProvider, e nao persistQueryClient dentro de um efeito.
 *
 * A diferenca aparece justamente sem rede. Restaurando por efeito, a consulta
 * do catalogo dispara antes de o disco responder: a busca falha, a consulta
 * fica em estado de erro e a tela mostra "nao foi possivel carregar" com os
 * 2.693 produtos ali do lado, guardados. Pior, o persister grava por cima o
 * estado que acabou de falhar, e o catalogo se perde de verdade.
 *
 * Este provider segura as consultas ate a restauracao terminar. Deixa de ser
 * corrida e passa a ser ordem.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // o catalogo muda poucas vezes por ano: cache longo e refetch raro
            staleTime: 1000 * 60 * 60,
            gcTime: VINTE_E_QUATRO_DIAS,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // storage so existe no navegador; no servidor o persister fica inerte
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      key: "innecco-cache",
    }),
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // aqui e comparacao de data, nao timeout, mas segue o mesmo prazo
        maxAge: VINTE_E_QUATRO_DIAS,
        buster: VERSAO_CACHE,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
