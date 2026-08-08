"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // o catalogo muda poucas vezes por ano: cache longo e refetch raro
            staleTime: 1000 * 60 * 60,
            gcTime: 1000 * 60 * 60 * 24 * 30,
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
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
    return desfazer;
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
