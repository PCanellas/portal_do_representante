"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatarPreco } from "@/lib/catalogo";
import { useFilaHidratada, useFilaOrcamentos } from "@/lib/fila-orcamentos";

/**
 * Sobe o que ficou na fila, sozinho.
 *
 * Duas deixas: quando o app abre e quando o navegador avisa que a rede
 * voltou. O evento `online` mente com alguma frequencia — ele dispara quando
 * o aparelho pega a rede local, que pode nao ter internet —, mas errar aqui
 * custa uma tentativa que falha e volta para a fila.
 *
 * Fica no layout interno para valer em qualquer tela: ele pode fechar o
 * orcamento sem sinal e so voltar a ter rede na tela de clientes.
 */
export function SincronizarFila() {
  const hidratada = useFilaHidratada();
  const pendentes = useFilaOrcamentos((s) => s.pendentes);
  const sincronizar = useFilaOrcamentos((s) => s.sincronizar);
  const router = useRouter();

  const enviar = useCallback(async () => {
    const r = await sincronizar();
    if (r.enviados === 0 && r.recusados.length === 0) return;

    if (r.enviados > 0) {
      toast.success(
        r.enviados === 1
          ? "Orçamento enviado"
          : `${r.enviados} orçamentos enviados`,
      );
      // a lista vem do servidor: sem isto o orcamento que acabou de subir
      // continuaria aparecendo como pendente ate a proxima navegacao
      router.refresh();
    }

    for (const d of r.divergentes) {
      toast.warning(`Orçamento ${d.numero} subiu com outro total`, {
        description: `No aparelho ${formatarPreco(d.local)}, no sistema ${formatarPreco(d.servidor)}. A tabela mudou antes do envio — confira antes de mandar ao cliente.`,
        duration: 30000,
      });
    }

    for (const rec of r.recusados) {
      toast.error(`Orçamento de ${rec.cliente} não pôde ser enviado`, {
        description: `${rec.erro} Monte de novo quando puder.`,
        duration: 30000,
      });
    }
  }, [sincronizar, router]);

  useEffect(() => {
    if (!hidratada || pendentes.length === 0) return;

    void enviar();
    window.addEventListener("online", enviar);
    return () => window.removeEventListener("online", enviar);
  }, [hidratada, pendentes.length, enviar]);

  return null;
}
