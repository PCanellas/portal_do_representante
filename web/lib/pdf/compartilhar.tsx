"use client";

import type { DadosPdf } from "@/app/(interno)/orcamentos/actions";

/**
 * Gera o PDF no proprio aparelho e entrega ao sistema.
 *
 * O @react-pdf pesa umas centenas de KB e so faz sentido quando ele
 * realmente pede o documento — por isso o import fica aqui dentro, e nao
 * no topo do modulo. Quem nunca toca no botao nunca baixa a biblioteca.
 */

function nomeArquivo(dados: DadosPdf) {
  const cliente = dados.cliente
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `orcamento-${dados.numero}${cliente ? `-${cliente}` : ""}.pdf`;
}

export type ResultadoCompartilhar = "compartilhado" | "baixado" | "cancelado";

/**
 * Decide pelo aparelho, nao pela API.
 *
 * O Chrome no Windows tem Web Share, mas a folha do sistema serve para
 * encaminhar e nao para salvar — no computador ele quer o arquivo em disco,
 * para anexar onde quiser. No celular e o contrario: a folha ja leva direto
 * ao WhatsApp. `pointer: coarse` e o mesmo sinal que o CSS usa para alvos
 * de toque, entao os dois concordam sobre o que e "aparelho de mao".
 */
function preferirFolhaDoSistema() {
  return window.matchMedia("(pointer: coarse)").matches;
}

export async function compartilharOrcamento(
  dados: DadosPdf,
): Promise<ResultadoCompartilhar> {
  const [{ pdf }, { DocumentoOrcamento }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./documento-orcamento"),
  ]);

  const blob = await pdf(<DocumentoOrcamento dados={dados} />).toBlob();
  const nome = nomeArquivo(dados);
  const arquivo = new File([blob], nome, { type: "application/pdf" });

  // canShare tambem precisa ser checado: ha navegador com navigator.share
  // que recusa arquivo, e ai a folha nunca abriria.
  if (preferirFolhaDoSistema() && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({
        files: [arquivo],
        title: `Orçamento ${dados.numero}`,
      });
      return "compartilhado";
    } catch (erro) {
      // fechar a folha de compartilhamento nao e falha: nao vale cair no
      // download por tras, que deixaria um arquivo que ele nao pediu
      if (erro instanceof DOMException && erro.name === "AbortError") {
        return "cancelado";
      }
    }
  }

  // computador, ou navegador sem compartilhamento de arquivo
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
  return "baixado";
}
