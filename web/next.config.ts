import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // So vale em desenvolvimento. Sem isto o Next recusa servir os chunks de
  // JS para quem chega por outro host que nao localhost — o celular abre a
  // pagina pelo IP da rede, recebe o HTML e nunca hidrata, entao nada que
  // depende de JavaScript funciona no aparelho.
  allowedDevOrigins: ["192.168.15.10", "192.168.15.*"],
};

export default nextConfig;
