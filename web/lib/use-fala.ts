"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Sintese de voz do proprio navegador — a metade que fala.
 *
 * Como o reconhecimento, nao custa nada e nao tem servidor. Diferente dele,
 * costuma funcionar SEM sinal: as vozes do iOS sao locais. A metade que fala
 * sobrevive na loja sem rede, mesmo quando a que ouve nao.
 *
 * A qualidade varia MUITO conforme a voz escolhida. O iOS traz uma voz
 * compacta embutida — a que soa robotica — e oferece versoes Aprimorada e
 * Premium por download, em Ajustes > Acessibilidade > Conteudo Falado > Vozes.
 * Sao elas que soam humanas, e continuam locais e de graca. Por isso a escolha
 * automatica prefere as melhores, e a tela deixa trocar a mao: nenhum codigo
 * aqui descobre o que esta instalado no aparelho dele.
 */

function sintese(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

/**
 * Marcas de voz de maior qualidade no nome. Nao ha campo padronizado que
 * diga isso — os fabricantes anunciam no proprio nome, e e o que da para ler.
 */
const SINAL_DE_QUALIDADE = /enhanced|premium|neural|aprimorada|siri/i;

function pontuar(v: SpeechSynthesisVoice) {
  let pontos = 0;
  if (SINAL_DE_QUALIDADE.test(v.name)) pontos += 10;
  if (v.lang.toLowerCase().startsWith("pt-br")) pontos += 5;
  if (v.localService) pontos += 1; // local funciona sem sinal
  return pontos;
}

function vozesEmPortugues(): SpeechSynthesisVoice[] {
  const vozes = sintese()?.getVoices() ?? [];
  return vozes
    .filter((v) => v.lang.toLowerCase().startsWith("pt"))
    .sort((a, b) => pontuar(b) - pontuar(a) || a.name.localeCompare(b.name));
}

const semAssinatura = () => () => {};

/**
 * As vozes chegam depois do primeiro render em quase todo navegador, e o
 * evento e como eles avisam.
 */
function assinarVozes(aoMudar: () => void) {
  const s = sintese();
  s?.addEventListener("voiceschanged", aoMudar);
  return () => s?.removeEventListener("voiceschanged", aoMudar);
}

// Separadores de campo e de registro. Escritos em escape, e nao com o
// caractere literal, porque sao de controle: invisiveis no editor e no diff,
// e um replace distraido os apagaria sem deixar rastro. Mesmo cuidado do
// regex de acentos no catalogo.ts.
const CAMPO = "\u001f";
const REGISTRO = "\u001e";

/**
 * Texto, e nao a lista de objetos, porque o useSyncExternalStore compara o
 * retorno por identidade: getVoices() cria um array novo a cada chamada, e
 * isso seria estado sempre mudando, render sem fim.
 */
function retratoDasVozes() {
  return vozesEmPortugues()
    .map((v) => [v.name, v.lang, v.localService].join(CAMPO))
    .join(REGISTRO);
}

export type VozDisponivel = { nome: string; idioma: string; local: boolean };

export type EstadoFala = {
  disponivel: boolean;
  falando: boolean;
  vozes: VozDisponivel[];
  /** Nome da voz em uso; "" quando nao ha nenhuma em portugues. */
  vozAtual: string;
  definirVoz: (nome: string) => void;
  velocidade: number;
  definirVelocidade: (v: number) => void;
  destravar: () => void;
  falar: (texto: string) => void;
  parar: () => void;
};

/**
 * Um pouco abaixo de 1: no ritmo cheio o motor atropela numero e referencia,
 * que e justamente o que ele precisa conferir de ouvido.
 */
const VELOCIDADE_PADRAO = 0.95;

export function useFala(): EstadoFala {
  const disponivel = useSyncExternalStore(
    semAssinatura,
    () => sintese() !== null,
    () => false,
  );

  const retrato = useSyncExternalStore(assinarVozes, retratoDasVozes, () => "");

  const vozes = useMemo<VozDisponivel[]>(() => {
    if (!retrato) return [];
    return retrato.split(REGISTRO).map((linha) => {
      const [nome = "", idioma = "", local = ""] = linha.split(CAMPO);
      return { nome, idioma, local: local === "true" };
    });
  }, [retrato]);

  const [escolhida, setEscolhida] = useState("");
  const [velocidade, setVelocidade] = useState(VELOCIDADE_PADRAO);
  const [falando, setFalando] = useState(false);
  const destravado = useRef(false);

  // a escolha dele vale; sem escolha, a melhor pontuada
  const vozAtual =
    vozes.find((v) => v.nome === escolhida)?.nome ?? vozes[0]?.nome ?? "";

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

  const falar = useCallback(
    (texto: string) => {
      const s = sintese();
      if (!s || !texto.trim()) return;

      s.cancel(); // corta o que ainda estava na fila

      const enunciado = new SpeechSynthesisUtterance(texto);
      enunciado.lang = "pt-BR";
      enunciado.rate = velocidade;
      const voz = sintese()
        ?.getVoices()
        .find((v) => v.name === vozAtual);
      if (voz) enunciado.voice = voz;
      enunciado.onstart = () => setFalando(true);
      enunciado.onend = () => setFalando(false);
      enunciado.onerror = () => setFalando(false);

      s.speak(enunciado);
    },
    [vozAtual, velocidade],
  );

  const parar = useCallback(() => {
    sintese()?.cancel();
    setFalando(false);
  }, []);

  return {
    disponivel,
    falando,
    vozes,
    vozAtual,
    definirVoz: setEscolhida,
    velocidade,
    definirVelocidade: setVelocidade,
    destravar,
    falar,
    parar,
  };
}
