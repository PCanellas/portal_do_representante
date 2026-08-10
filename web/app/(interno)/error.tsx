"use client";

import { AvisoSemSinal } from "@/components/layout/aviso-sem-sinal";

/**
 * Trocar de tela sem sinal caia na tela de erro do proprio Next — "This page
 * couldn't load", em ingles e sem saida.
 *
 * A causa: `<Link>` no App Router nao pede a pagina, pede o payload RSC ao
 * servidor. Sem rede a requisicao falha e o roteador lanca. Nao ha como
 * evitar o lancamento; ha como decidir onde ele para.
 *
 * Estando aqui, dentro de (interno), o cabecalho e a barra de baixo
 * continuam na tela — ele ve onde esta e navega para outro lugar. Um
 * error.tsx na raiz substituiria o app inteiro por uma pagina solta.
 *
 * `reset` remonta o trecho que falhou. Com o sinal de volta, a tela aparece;
 * sem ele, volta para ca — o que ja e uma resposta.
 */
export default function ErroInterno({ reset }: { reset: () => void }) {
  return <AvisoSemSinal aoTentarNovamente={reset} />;
}
