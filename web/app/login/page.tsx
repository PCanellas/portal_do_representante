import Image from "next/image";
import type { Metadata, Viewport } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

/**
 * A tela e navy de ponta a ponta, entao a faixa que o sistema pinta no pe
 * tem que ser navy tambem — nos dois modos, porque a tela nao muda de cor
 * com o tema. Substitui so o themeColor; o resto do viewport vem da raiz.
 */
export const viewport: Viewport = { themeColor: "#00112A" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // No Next 16 searchParams e assincrono.
  const params = await searchParams;
  const proximo =
    typeof params.proximo === "string" ? params.proximo : undefined;

  return (
    // data-tela pinta o documento de navy junto (regra em globals.css): sem
    // isso o app instalado mostra uma faixa branca no pe da tela escura
    <main
      data-tela="login"
      className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-marca-navy px-5 py-10 tela-baixa:py-6"
    >
      {/* halo de luz: a lampada da logo virando ambiente */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[38rem] -translate-x-1/2 rounded-full bg-marca-dourado/12 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center tela-baixa:mb-6">
          <Image
            src="/logo-marca.png"
            alt="Rogério Innecco Representações"
            width={1073}
            height={900}
            priority
            className="h-auto w-56 tela-baixa:w-40"
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8 dark:bg-card">
          <div className="mb-6 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
            <p className="text-sm text-muted-foreground">
              Acesse para consultar preços e montar orçamentos.
            </p>
          </div>

          <LoginForm proximo={proximo} />
        </div>
      </div>
    </main>
  );
}
