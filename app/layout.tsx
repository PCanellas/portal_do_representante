import type { Metadata, Viewport } from "next";
import { Montserrat, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#00112A" },
  ],
  // permite ampliar: acessibilidade importa mais que travar o layout
  initialScale: 1,
  width: "device-width",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${montserrat.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
