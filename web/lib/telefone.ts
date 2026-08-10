/** Guarda so digitos: comparar e enviar mensagem fica previsivel. */
export function apenasDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

/**
 * Descarta o codigo do pais quando ele vem junto — acontece sempre que
 * ele cola um numero copiado do contato do WhatsApp (+55 21 99999-8888).
 */
export function digitosNacionais(valor: string) {
  const d = apenasDigitos(valor);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
    return d.slice(2);
  }
  return d;
}

// DDDs em uso no Brasil. Evita aceitar 00, 10, 20 e outros inexistentes.
// Uma linha por região, como a Anatel publica: assim dá para conferir contra
// a fonte e ver de relance qual região falta. O prettier juntaria tudo num
// bloco corrido, que passa a ser uma parede de números.
// prettier-ignore
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Valida telefone brasileiro. Devolve null quando esta ok, ou a mensagem
 * a mostrar. Campo vazio e valido: WhatsApp e opcional no cadastro.
 */
export function validarTelefone(valor: string): string | null {
  const d = digitosNacionais(valor);
  if (!d) return null;

  if (d.length < 10) return "Número incompleto";
  if (d.length > 11) return "Número muito longo";
  if (!DDDS.has(Number(d.slice(0, 2)))) return "DDD inexistente";
  // celular tem 11 digitos e comeca com 9 depois do DDD
  if (d.length === 11 && d[2] !== "9") return "Celular deve começar com 9";

  return null;
}

/**
 * Formata enquanto digita, descartando qualquer caractere que nao seja
 * numero: (21) 99999-9999 para celular, (21) 9999-9999 para fixo.
 */
export function formatarTelefone(valor: string) {
  const d = digitosNacionais(valor).slice(0, 11);

  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Link direto para a conversa no WhatsApp (55 = Brasil). */
export function linkWhatsApp(valor: string) {
  const d = digitosNacionais(valor);
  if (!d || validarTelefone(d) !== null) return null;
  return `https://wa.me/55${d}`;
}
