"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Mic, Square, TriangleAlert, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatarPreco } from "@/lib/catalogo";
import { respostaFalada } from "@/lib/fala";
import {
  acharPorReferencia,
  candidatosReferencia,
  indexarPorReferencia,
} from "@/lib/referencia";
import { useCatalogo } from "@/lib/use-catalogo";
import { useFala } from "@/lib/use-fala";
import { useVoz } from "@/lib/use-voz";
import { cn } from "@/lib/utils";

/**
 * Spike do Jarvis. Nao e a feature — e o teste que decide se a feature existe.
 *
 * Duas perguntas, e as duas precisam de resposta antes de qualquer linha de
 * codigo com custo:
 *
 *   1. A Web Speech API funciona no aparelho dele, no PWA instalado?
 *   2. O que ela transcreve acha produto na busca que ja temos?
 *
 * A segunda e a que costuma ser esquecida. Adianta pouco o microfone abrir se
 * "MD dois mil duzentos e onze" nao chega em MD-2211.
 *
 * O painel de diagnostico existe para o retorno nao ser "nao funcionou": com
 * o codigo do erro e o modo de exibicao da tela da para saber o que fazer.
 */

type Ambiente = {
  seguro: boolean;
  instalado: boolean;
  navegador: string;
};

/**
 * Guardado entre leituras porque o useSyncExternalStore compara o retorno por
 * identidade: um objeto novo a cada chamada seria estado sempre "mudando", e
 * o render nunca pararia. Nada aqui muda no meio da sessao.
 */
let ambienteLido: Ambiente | null = null;

function lerAmbiente(): Ambiente | null {
  if (typeof window === "undefined") return null;
  const iosInstalado = (navigator as unknown as { standalone?: boolean })
    .standalone;
  ambienteLido ??= {
    seguro: window.isSecureContext,
    instalado:
      window.matchMedia("(display-mode: standalone)").matches ||
      iosInstalado === true,
    navegador: navigator.userAgent,
  };
  return ambienteLido;
}

const semAssinatura = () => () => {};

export function SpikeVoz() {
  const voz = useVoz();
  const { data: catalogo } = useCatalogo();
  const ambiente = useSyncExternalStore(semAssinatura, lerAmbiente, () => null);

  // o indice so e refeito quando o catalogo muda, nao a cada transcricao
  const indice = useMemo(
    () => indexarPorReferencia(catalogo?.produtos ?? []),
    [catalogo],
  );

  const achados = useMemo(
    () => (voz.transcricao ? acharPorReferencia(indice, voz.transcricao) : []),
    [indice, voz.transcricao],
  );

  // o que ele TENTOU casar. Quando nada bate, e isto que diz se o problema
  // foi a transcricao, a separacao em pedacos, ou a referencia mesmo.
  const candidatos = useMemo(
    () => (voz.transcricao ? candidatosReferencia(voz.transcricao) : []),
    [voz.transcricao],
  );

  const candidatosQueCasaram = useMemo(
    () => new Set(achados.map((a) => a.candidato)),
    [achados],
  );

  const { falar, ...fala } = useFala();
  const resposta = useMemo(
    () => (voz.transcricao ? respostaFalada(achados) : ""),
    [voz.transcricao, achados],
  );

  // Fala quando a resposta muda. O ref evita repetir a cada render — sem ele,
  // qualquer re-render recomecaria a mesma frase por cima dela mesma.
  const jaFalado = useRef("");
  useEffect(() => {
    if (!resposta || resposta === jaFalado.current) return;
    jaFalado.current = resposta;
    falar(resposta);
  }, [resposta, falar]);

  return (
    <div className="space-y-5 pb-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Jarvis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Teste de microfone. Toque e fale a referência do produto — pode ser
          uma frase inteira, o resto é ignorado.
        </p>
      </header>

      {ambiente && !ambiente.seguro ? (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Sem HTTPS o navegador nem oferece o microfone. Abra por{" "}
          <code>localhost</code> ou pelo endereço publicado.
        </p>
      ) : null}

      {ambiente && !voz.disponivel ? (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Este navegador não expõe reconhecimento de voz. É a resposta que o
          teste procurava — anote o navegador no rodapé desta tela.
        </p>
      ) : null}

      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6">
        <Button
          size="lg"
          disabled={!voz.disponivel}
          onClick={() => {
            if (voz.ouvindo) {
              voz.parar();
              return;
            }
            // dentro do gesto, e antes de tudo: e a unica janela em que o
            // iOS libera audio, e a resposta so vem falar bem depois
            fala.destravar();
            voz.ouvir();
          }}
          className={cn(
            "h-20 w-20 rounded-full",
            voz.ouvindo && "animate-pulse bg-destructive hover:bg-destructive",
          )}
          aria-label={voz.ouvindo ? "Parar de ouvir" : "Acionar Jarvis"}
        >
          {voz.ouvindo ? (
            <Square className="size-7" aria-hidden />
          ) : (
            <Mic className="size-7" aria-hidden />
          )}
        </Button>
        <p className="text-sm text-muted-foreground" role="status">
          {voz.ouvindo ? "Ouvindo…" : "Toque para falar"}
        </p>
      </div>

      {voz.erro ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {voz.erro}
        </p>
      ) : null}

      {voz.transcricao || voz.parcial ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Transcrição
          </h2>
          <p className="rounded-xl border bg-card p-4 text-lg">
            {voz.transcricao}
            {voz.parcial ? (
              <span className="text-muted-foreground">
                {voz.transcricao ? " " : ""}
                {voz.parcial}
              </span>
            ) : null}
          </p>
        </section>
      ) : null}

      {voz.transcricao ? (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Referência encontrada
            </h2>
            <div className="flex items-center gap-2">
              {achados.length > 0 ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {achados.length} da família
                </span>
              ) : null}
              {resposta && fala.disponivel ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (fala.falando ? fala.parar() : falar(resposta))}
                  aria-label={
                    fala.falando ? "Parar de falar" : "Ouvir a resposta de novo"
                  }
                >
                  <Volume2
                    className={cn("size-4", fala.falando && "animate-pulse")}
                    aria-hidden
                  />
                  {fala.falando ? "Parar" : "Ouvir"}
                </Button>
              ) : null}
            </div>
          </div>

          {achados.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Nenhuma referência do catálogo apareceu na frase. Os pedaços que
              foram testados estão no diagnóstico, embaixo.
            </p>
          ) : (
            <ul className="space-y-2">
              {achados.flatMap(({ referencia, exata, produtos }) =>
                produtos.map((p) => (
                  <li
                    key={`${referencia}-${p.id}`}
                    className={cn(
                      "rounded-xl border p-3.5",
                      exata
                        ? "border-marca-dourado bg-marca-dourado/10"
                        : "bg-card",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-sm font-semibold">
                        {p.referencia}
                      </span>
                      <span className="text-lg font-semibold tabular-nums">
                        {formatarPreco(p.preco_unitario)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-snug">{p.descricao}</p>
                    {p.variante ? (
                      <p className="mt-0.5 text-xs text-marca-azul dark:text-marca-dourado">
                        {p.variante}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {exata ? null : (
                        <Badge variant="outline" className="text-[11px]">
                          variante
                        </Badge>
                      )}
                      {p.situacao !== 1 ? (
                        <Badge variant="destructive" className="text-[11px]">
                          Inativo
                        </Badge>
                      ) : null}
                    </div>
                  </li>
                )),
              )}
            </ul>
          )}
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Diagnóstico
          </h2>
          <Button variant="ghost" size="sm" onClick={voz.limpar}>
            Limpar
          </Button>
        </div>

        <dl className="space-y-1.5 rounded-xl border bg-card p-4 text-xs">
          <Linha
            rotulo="Reconhecimento de voz"
            valor={voz.disponivel ? "disponível" : "indisponível"}
          />
          <Linha
            rotulo="Contexto seguro (HTTPS)"
            valor={ambiente ? (ambiente.seguro ? "sim" : "não") : "…"}
          />
          <Linha
            rotulo="Modo"
            valor={
              ambiente
                ? ambiente.instalado
                  ? "PWA instalado"
                  : "aba do navegador"
                : "…"
            }
          />
          <Linha
            rotulo="Catálogo no aparelho"
            valor={
              catalogo
                ? `${catalogo.produtos.length.toLocaleString("pt-BR")} produtos`
                : "carregando…"
            }
          />
          <Linha
            rotulo="Referências indexadas"
            valor={indice.chaves.length.toLocaleString("pt-BR")}
          />
          <Linha
            rotulo="Síntese de voz"
            valor={fala.disponivel ? "disponível" : "indisponível"}
          />
          <Linha rotulo="Voz escolhida" valor={fala.voz || "nenhuma em pt-BR"} />
        </dl>

        {resposta ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">O que foi falado:</p>
            <p className="rounded-xl border bg-muted/40 p-3 text-xs">
              {resposta}
            </p>
          </div>
        ) : null}

        {candidatos.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Pedaços testados como referência ({candidatos.length}):
            </p>
            <div className="flex flex-wrap gap-1">
              {candidatos.map((c) => (
                <span
                  key={c}
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono text-[11px]",
                    candidatosQueCasaram.has(c)
                      ? "border-transparent bg-marca-navy text-white dark:bg-marca-dourado dark:text-marca-navy"
                      : "text-muted-foreground",
                  )}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {voz.eventos.length > 0 ? (
          <pre className="overflow-x-auto rounded-xl border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
            {voz.eventos.join("\n")}
          </pre>
        ) : null}

        {ambiente ? (
          <p className="text-[11px] break-all text-muted-foreground">
            {ambiente.navegador}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
