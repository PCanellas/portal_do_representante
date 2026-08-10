/**
 * uuid v4 gerado no aparelho.
 *
 * `crypto.randomUUID` so existe em contexto seguro — HTTPS ou localhost. No
 * site publicado ele esta la, mas testar pelo IP da rede local (http://
 * 192.168.x.x) cai fora dessa regra, e a funcao some sem aviso: a chamada
 * estoura e leva junto o clique inteiro. Gravar orcamento nao pode depender
 * de onde o app esta sendo servido.
 *
 * `crypto.getRandomValues`, ao contrario, vale em qualquer contexto — e e
 * dele que sai a aleatoriedade aqui. Nada de Math.random: id de orcamento
 * repetido significa um sobrescrever o outro.
 */
export function gerarId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versão 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
