"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Sintese de voz do proprio navegador — a metade que fala.
 *
 * Como o reconhecimento, nao custa nada e nao tem servidor. Diferente dele,
 * costuma funcionar SEM sinal: as vozes do iOS sao locais. A metade que fala
 * sobrevive na loja sem rede, mesmo quando a que ouve nao.
 */

function sintese(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

/** Voz em portugues, se houver. Sem ela o motor le pt-BR com sotaque errado. */
function escolherVoz(): SpeechSynthesisVoice | null {
  const vozes = sintese()?.getVoices() ?? [];
  return (
    vozes.find((v) => v.lang.toLowerCase().startsWith("pt-br")) ??
    vozes.find((v) => v.lang.toLowerCase().startsWith("pt")) ??
    null
  );
}

const semAssinatura = () => () => {};

/**
 * As vozes chegam depois do primeiro render em quase todo navegador, e o
 * evento e como eles avisam. Devolve o NOME e nao o objeto de proposito: o
 * getVoices() cria um array novo a cada chamada, e o useSyncExternalStore
 * compara por identidade — objeto novo sempre seria estado sempre mudando.
 */
function assinarVozes(aoMudar: () => void) {
  const s = sintese();
  s?.addEventListener("voiceschanged", aoMudar);
  return () => s?.removeEventListener("voiceschanged", aoMudar);
}

export type EstadoFala = {
  disponivel: boolean;
  falando: boolean;
  /** Nome da voz escolhida, "" enquanto a lista nao chegou. */
  voz: string;
  destravar: () => void;
  falar: (texto: string) => void;
  parar: () => void;
};

export function useFala(): EstadoFala {
  const disponivel = useSyncExternalStore(
    semAssinatura,
    () => sintese() !== null,
    () => false,
  );

  const voz = useSyncExternalStore(
    assinarVozes,
    () => escolherVoz()?.name ?? "",
    () => "",
  );

  const [falando, setFalando] = useState(false);
  const destravado = useRef(false);

  // silencia ao sair da tela; sem isto a voz continua na proxima
  useEffect(() => () => sintese()?.cancel(), []);

  /**
   * O iOS so libera audio dentro do gesto do usuario, e a resposta e falada
   * DEPOIS da transcricao voltar — ja fora dele. Um enunciado mudo disparado
   * no toque destrava o motor para os proximos.
   */
  const destravar = useCallback(() => {
    const s = sintese();
    if (!s || destravado.current) return;
    // um espaco, e nao string vazia: parte dos motores recusa a vazia
    s.speak(new SpeechSynthesisUtterance(" "));
    destravado.current = true;
  }, []);

  const falar = useCallback((texto: string) => {
    const s = sintese();
    if (!s || !texto.trim()) return;

    s.cancel(); // corta o que ainda estava na fila

    const enunciado = new SpeechSynthesisUtterance(texto);
    enunciado.lang = "pt-BR";
    const escolhida = escolherVoz();
    if (escolhida) enunciado.voice = escolhida;
    enunciado.onstart = () => setFalando(true);
    enunciado.onend = () => setFalando(false);
    enunciado.onerror = () => setFalando(false);

    s.speak(enunciado);
  }, []);

  const parar = useCallback(() => {
    sintese()?.cancel();
    setFalando(false);
  }, []);

  return { disponivel, falando, voz, destravar, falar, parar };
}
