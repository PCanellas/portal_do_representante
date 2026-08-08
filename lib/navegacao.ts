import { Home, Package, Users, FileText, type LucideIcon } from "lucide-react";

export type ItemNav = {
  href: string;
  rotulo: string;
  icone: LucideIcon;
};

/** Ordem pensada para o polegar: o que ele mais usa fica mais a esquerda. */
export const NAVEGACAO: ItemNav[] = [
  { href: "/home", rotulo: "Início", icone: Home },
  { href: "/produtos", rotulo: "Produtos", icone: Package },
  { href: "/orcamentos", rotulo: "Orçamentos", icone: FileText },
  { href: "/clientes", rotulo: "Clientes", icone: Users },
];

/** Marca o item ativo sem que /orcamentos capture /orcamentos-antigos. */
export function ehRotaAtiva(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}
