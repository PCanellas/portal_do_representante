/** Guarda so digitos: comparar e enviar mensagem fica previsivel. */
function apenasDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

const PESOS_PRIMEIRO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function digitoVerificador(digitos: string, pesos: number[]) {
  const soma = pesos.reduce(
    (acc, peso, i) => acc + peso * Number(digitos[i]),
    0,
  );
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Valida CNPJ pelos digitos verificadores oficiais. Campo vazio e valido:
 * CNPJ e opcional no cadastro, nem todo cliente e pessoa juridica.
 */
export function validarCnpj(valor: string): string | null {
  const d = apenasDigitos(valor);
  if (!d) return null;

  if (d.length !== 14) return "CNPJ incompleto";
  // 00000000000000, 11111111111111 etc passam no digito verificador mas
  // nao sao numero real — nenhuma empresa tem CNPJ assim
  if (/^(\d)\1{13}$/.test(d)) return "CNPJ inválido";

  const d1 = digitoVerificador(d, PESOS_PRIMEIRO);
  const d2 = digitoVerificador(d, PESOS_SEGUNDO);
  if (d1 !== Number(d[12]) || d2 !== Number(d[13])) return "CNPJ inválido";

  return null;
}

/** Formata enquanto digita: 00.000.000/0000-00. */
export function formatarCnpj(valor: string) {
  const d = apenasDigitos(valor).slice(0, 14);

  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** So os digitos, para gravar no banco — a formatacao e so da tela. */
export function digitosCnpj(valor: string) {
  return apenasDigitos(valor);
}
