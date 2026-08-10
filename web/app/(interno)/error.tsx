"use client";

import { AvisoSemSinal } from "@/components/layout/aviso-sem-sinal";

/**
 * Erro ao renderizar uma tela interna, com o cabecalho e a barra de baixo
 * ainda no lugar — ele ve onde esta e sai andando.
 *
 * NAO e isto que trata a falta de sinal, embora tenha sido escrito para
 * isso. Medido: quando o payload RSC nao vem, o roteador do Next nao lanca
 * dentro do boundary — ele desiste da navegacao suave e recarrega a pagina
 * inteira. Nada chega aqui. Quem atende esse caso e o service worker, que
 * intercepta o recarregamento e devolve /offline.
 *
 * O que sobra para ca sao os erros de verdade: server component que estourou,
 * resposta que nao deu para ler. Continua valendo a pena existir — sem ele,
 * qualquer um deles vira a tela em ingles do Next.
 *
 * `retry` refaz a busca e remonta o trecho, que e o que se quer aqui. `reset`
 * so limpa o estado sem buscar de novo, e devolveria o mesmo erro.
 */
export default function ErroInterno({ retry }: { retry: () => void }) {
  return <AvisoSemSinal aoTentarNovamente={retry} />;
}
