"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Reconhecimento de fala do proprio navegador — sem servidor, sem chave, sem
 * custo. O audio nao passa por nos: quem transcreve e o sistema operacional
 * ou o servico do fabricante do navegador.
 *
 * Isto e um spike. A pergunta que ele existe para responder e uma so: a Web
 * Speech API funciona no aparelho dele, dentro do PWA instalado? Se nao
 * funcionar, nao adianta discutir o resto da feature.
 *
 * Duas armadilhas conhecidas do iOS, e as duas estao tratadas aqui:
 *
 * 1. `start()` precisa ser chamado DENTRO do gesto do usuario, sem await
 *    antes. Por isso `ouvir` e sincrono do primeiro ao ultimo comando — um
 *    `await` no meio faz o Safari descartar o gesto e negar o microfone.
 * 2. Reaproveitar a mesma instancia entre acionamentos trava depois do
 *    primeiro uso. Cada `ouvir` cria uma instancia nova.
 */

type Alternativa = { readonly transcript: string; readonly confidence: number };

type Resultado = {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [i: number]: Alternativa;
};

type EventoResultado = Event & {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [i: number]: Resultado };
};

type EventoErro = Event & { readonly error: string; readonly message: string };

/**
 * Nomes em portugues de proposito: `SpeechRecognition` colide com o tipo que
 * algumas versoes da lib DOM ja declaram, e a colisao quebra o build sem
 * dizer por que.
 */
interface Reconhecimento extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onresult: ((e: EventoResultado) => void) | null;
  onerror: ((e: EventoErro) => void) | null;
  onend: (() => void) | null;
}

type ConstrutorReconhecimento = new () => Reconhecimento;

function construtor(): ConstrutorReconhecimento | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Mensagem util para cada codigo de erro que a API devolve. */
const ERROS: Record<string, string> = {
  "not-allowed":
    "Permissão de microfone negada. Autorize nos ajustes do site e tente de novo.",
  "service-not-allowed":
    "O navegador bloqueou o serviço de transcrição. Comum em PWA instalado no iOS.",
  "no-speech": "Não ouvi nada. Fale logo depois de tocar no botão.",
  "audio-capture": "Nenhum microfone disponível.",
  network: "A transcrição precisa de internet e a rede falhou.",
  aborted: "Cancelado.",
};

export type EstadoVoz = {
  /** Só é conhecido no navegador — no servidor é sempre false. */
  disponivel: boolean;
  ouvindo: boolean;
  /** Texto já confirmado pelo transcritor. */
  transcricao: string;
  /** Texto ainda sendo reconhecido, muda enquanto ele fala. */
  parcial: string;
  erro: string | null;
  /** Diário do que a API disparou. É o que transforma "não funcionou" em pista. */
  eventos: string[];
  ouvir: () => void;
  parar: () => void;
  limpar: () => void;
};

/** O suporte do navegador nao muda no meio da sessao: nao ha o que assinar. */
const semAssinatura = () => () => {};

export function useVoz(): EstadoVoz {
  // Ler isto num efeito seria mais curto, mas gravar estado dentro de efeito
  // dispara render em cascata — e o lint do projeto recusa. Aqui a resposta
  // vem do navegador ja na primeira leitura, e o servidor responde `false`,
  // que e o que o HTML entregue afirma. Mesmo arranjo do useRascunho.
  const disponivel = useSyncExternalStore(
    semAssinatura,
    () => construtor() !== null,
    () => false,
  );

  const [ouvindo, setOuvindo] = useState(false);
  const [transcricao, setTranscricao] = useState("");
  const [parcial, setParcial] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [eventos, setEventos] = useState<string[]>([]);
  const ref = useRef<Reconhecimento | null>(null);

  // aborta ao sair da tela; sem isto o microfone fica aberto
  useEffect(() => () => ref.current?.abort(), []);

  const registrar = useCallback((mensagem: string) => {
    const hora = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    setEventos((atuais) => [...atuais.slice(-40), `${hora}  ${mensagem}`]);
  }, []);

  const ouvir = useCallback(() => {
    const Ctor = construtor();
    if (!Ctor) {
      setErro("Este navegador não tem reconhecimento de voz.");
      return;
    }

    ref.current?.abort();

    const r = new Ctor();
    r.lang = "pt-BR";
    // Uma tomada por vez: continuo e instavel no iOS, e o comando cabe numa
    // frase. Ele toca, fala, e a API fecha sozinha no silencio.
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      setOuvindo(true);
      registrar("onstart — sessão aberta");
    };
    r.onaudiostart = () => registrar("onaudiostart — microfone abriu");
    r.onspeechstart = () => registrar("onspeechstart — detectou voz");

    r.onresult = (e) => {
      let final = "";
      let emCurso = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const resultado = e.results[i];
        const texto = resultado?.[0]?.transcript ?? "";
        if (resultado?.isFinal) final += texto;
        else emCurso += texto;
      }

      if (final.trim()) {
        setTranscricao((atual) => `${atual} ${final}`.trim());
        setParcial("");
        registrar(`final — "${final.trim()}"`);
        return;
      }
      setParcial(emCurso);
    };

    r.onerror = (e) => {
      setErro(ERROS[e.error] ?? `Falhou: ${e.error}`);
      registrar(`onerror — ${e.error}${e.message ? ` (${e.message})` : ""}`);
    };

    r.onend = () => {
      setOuvindo(false);
      setParcial("");
      registrar("onend — sessão fechada");
    };

    ref.current = r;
    setErro(null);
    setParcial("");
    setTranscricao("");
    registrar("start() chamado");

    // start() lanca se ja houver sessao aberta — no iOS acontece quando a
    // anterior nao fechou direito
    try {
      r.start();
    } catch (falha) {
      const motivo = falha instanceof Error ? falha.message : String(falha);
      setErro(`Não consegui abrir o microfone: ${motivo}`);
      registrar(`start() lançou — ${motivo}`);
      setOuvindo(false);
    }
  }, [registrar]);

  const parar = useCallback(() => {
    registrar("stop() chamado");
    ref.current?.stop();
  }, [registrar]);

  const limpar = useCallback(() => {
    setTranscricao("");
    setParcial("");
    setErro(null);
    setEventos([]);
  }, []);

  return {
    disponivel,
    ouvindo,
    transcricao,
    parcial,
    erro,
    eventos,
    ouvir,
    parar,
    limpar,
  };
}
