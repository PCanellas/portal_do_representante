"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { NAVEGACAO, ehRotaAtiva } from "@/lib/navegacao";
import { BotaoAtualizar } from "./botao-atualizar";
import { cn } from "@/lib/utils";

type Props = {
  nome: string;
  aoSair: () => Promise<void>;
};

export function Cabecalho({ nome, aoSair }: Props) {
  const pathname = usePathname();

  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const primeiroNome = nome.split(" ")[0] ?? "";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-marca-navy text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/home" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/logo-simbolo.png"
            alt=""
            width={515}
            height={640}
            priority
            className="h-9 w-auto"
          />
          <span className="hidden text-sm leading-tight font-semibold sm:block">
            Innecco
            <span className="block text-[11px] font-normal text-white/50">
              Representações
            </span>
          </span>
        </Link>

        {/* navegacao horizontal: some no celular, onde a barra inferior assume */}
        <nav className="ml-4 hidden flex-1 items-center gap-1 md:flex">
          {NAVEGACAO.map(({ href, rotulo, icone: Icone }) => {
            const ativo = ehRotaAtiva(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-white/10 text-marca-dourado"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icone className="size-4" aria-hidden />
                {rotulo}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <BotaoAtualizar />

          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-full bg-white/10 text-xs font-semibold"
            >
              {iniciais || <User className="size-4" />}
            </span>
            <span className="hidden text-sm font-medium sm:block">
              {primeiroNome}
            </span>
          </div>

          <form action={aoSair}>
            <button
              type="submit"
              title="Sair"
              className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:px-3"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sair</span>
              <span className="sr-only sm:hidden">Sair</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
