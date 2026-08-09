"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVEGACAO, ehRotaAtiva } from "@/lib/navegacao";
import { cn } from "@/lib/utils";

/**
 * Navegacao principal no celular. Fica na base porque e onde o polegar
 * alcanca — ele usa o app em pe, com uma mao so, dentro da loja.
 */
export function BarraInferior() {
  const pathname = usePathname();

  return (
    <nav
      className="z-40 shrink-0 border-t bg-background md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      <div className="grid grid-cols-4">
        {NAVEGACAO.map(({ href, rotulo, icone: Icone }) => {
          const ativo = ehRotaAtiva(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                ativo
                  ? "text-marca-azul dark:text-marca-dourado"
                  : "text-muted-foreground",
              )}
            >
              <Icone
                className={cn("size-5", ativo && "stroke-[2.5]")}
                aria-hidden
              />
              {rotulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
