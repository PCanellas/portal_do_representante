import type { Metadata, Viewport } from "next";
import { Montserrat, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { RegistrarServiceWorker } from "@/components/pwa/registrar-service-worker";
import { Providers } from "./providers";
import "./globals.css";

// Montserrat e a fonte da marca — a logo usa a mesma familia geometrica.
// next/font baixa e hospeda localmente: sem request a servidor externo.
const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// monoespacada fica para codigo de produto, onde o alinhamento ajuda a ler
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Innecco Representações",
    template: "%s · Innecco Representações",
  },
  description: "Consulta de preços e orçamentos — soluções em iluminação.",
  applicationName: "Innecco Representações",
  appleWebApp: {
    capable: true,
    title: "Innecco",
    // "black" e nao "black-translucent" de proposito. O translucent entrega a
    // tela toda para a pagina, mas entrega torto: origem no topo e altura
    // descontando a barra de status — 793 numa tela de 852. Os 59 pontos que
    // sobram no pe nao recebem desenho, so cor, entao a barra de baixo nunca
    // encostava no fim. Com "black" o sistema encaixa a pagina abaixo da
    // barra de status e o viewport vai ate a borda de baixo de verdade.
    // Custa o navy atras do relogio: aquela faixa passa a ser preta.
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  // Instalado no iPhone, e o theme-color que pinta a faixa fora da pagina no
  // pe da tela — nao o fundo do documento. Tem que ser a cor exata de
  // --background, senao a faixa aparece: em #ffffff ela saia branca sobre o
  // cinza-claro do app. A tela de login declara a sua, que e navy.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#00112A" },
  ],
  // permite ampliar: acessibilidade importa mais que travar o layout
  initialScale: 1,
  width: "device-width",
  viewportFit: "cover",
};

/**
 * Sem altura declarada no html e no body, de proposito.
 *
 * `h-full` no html resolve contra o viewport grande — o de barra de endereco
 * escondida —, enquanto cada tela usa `min-h-dvh`, que e o viewport de agora.
 * No celular as duas medidas discordam pela altura da barra, e sobra uma
 * rolagem que nao corresponde a conteudo nenhum. Quem manda na altura passa
 * a ser o container de cada tela, que ja declarava `min-h-dvh`.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${montserrat.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
        <Toaster position="top-center" richColors />
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
