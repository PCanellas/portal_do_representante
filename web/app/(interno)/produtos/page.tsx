import type { Metadata } from "next";
import { BuscaProdutos } from "./busca-produtos";

export const metadata: Metadata = { title: "Produtos" };

export default function ProdutosPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
      <BuscaProdutos />
    </div>
  );
}
