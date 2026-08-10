import type { NextConfig } from "next";

/**
 * Cabecalhos de seguranca.
 *
 * Sao os quatro que nao dependem de conhecer o conteudo da pagina, entao nao
 * quebram nada e valem em toda rota. Falta uma Content-Security-Policy, que
 * seria o ganho maior — ela exige nonce por requisicao no proxy, porque o
 * Next injeta script inline para hidratar, e "unsafe-inline" jogaria fora a
 * protecao que ela existe para dar. Fica como proximo passo, com teste.
 */
const SEGURANCA = [
  // o app nao e embutido em lugar nenhum; enquadrar so serviria para
  // sobrepor uma tela falsa e colher o toque dele
  { key: "X-Frame-Options", value: "DENY" },
  // impede o navegador de adivinhar o tipo do arquivo e executar como script
  // algo servido como outra coisa
  { key: "X-Content-Type-Options", value: "nosniff" },
  // link para fora nao leva o caminho interno junto — o id do orcamento e
  // do cliente ficam na URL
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // nada disto e usado; negar de antemao fecha a porta
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactCompiler: true,

  async headers() {
    return [{ source: "/:path*", headers: SEGURANCA }];
  },

  // So vale em desenvolvimento. Sem isto o Next recusa servir os chunks de
  // JS para quem chega por outro host que nao localhost — o celular abre a
  // pagina pelo IP da rede, recebe o HTML e nunca hidrata, entao nada que
  // depende de JavaScript funciona no aparelho.
  allowedDevOrigins: ["192.168.15.10", "192.168.15.*"],
};

export default nextConfig;
