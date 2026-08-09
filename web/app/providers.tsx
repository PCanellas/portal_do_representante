"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
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

  // Persiste o cache no navegador para o catalogo sobreviver a recarga e
  // ficar disponivel sem rede. So roda no cliente, onde localStorage existe.
  useEffect(() => {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "innecco-cache",
    });
    const [desfazer] = persistQueryClient({
      queryClient,
      persister,
      // aqui e comparacao de data, nao timeout, mas segue o mesmo prazo
      maxAge: VINTE_E_QUATRO_DIAS,
    });
    return desfazer;
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
