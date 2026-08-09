"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVEGACAO, ehRotaAtiva } from "@/lib/navegacao";
import { cn } from "@/lib/utils";

/**
 * Navegacao principal no celular. Fica na base porque e onde o polegar
 * alcanca — ele usa o app em pe, com uma mao so, dentro da loja.
 *
 * A altura sai de --recuo-fundo e --barra-respiro, declaradas no :root do
 * globals.css com a explicacao de cada uma. Ficam la, e nao aqui, porque sao
 * o que se mexe para acertar a barra no aparelho — um lugar so, sem cacar
 * numero espalhado entre arquivo de estilo e de componente. O recuo e o
 * mesmo que a folha de baixo usa, para os dois respirarem igual.
 */
export function BarraInferior() {
  const pathname = usePathname();

  return (
    <nav
      className="z-40 shrink-0 border-t bg-background md:hidden"
      style={{ paddingBottom: "var(--recuo-fundo)" }}
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
                "flex flex-col items-center gap-1 py-[var(--barra-respiro)] text-[11px] font-medium transition-colors",
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
