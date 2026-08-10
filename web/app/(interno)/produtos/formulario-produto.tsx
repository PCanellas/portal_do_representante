"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, PackageX, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Produto } from "@/lib/catalogo";
import { formatarDecimal, interpretarNumero } from "@/lib/numero";
import { cn } from "@/lib/utils";
import { salvarProduto } from "./actions";

type Props = {
  produto: Produto;
  fabricante: string;
  /** Recebe o produto como ficou no banco, para atualizar o catálogo local. */
  aoSalvar: (produto: Produto) => void;
  aoCancelar: () => void;
};

type Erros = Partial<Record<"referencia" | "descricao" | "preco", string>>;

export function FormularioProduto({
  produto,
  fabricante,
  aoSalvar,
  aoCancelar,
}: Props) {
  const [referencia, setReferencia] = useState(produto.referencia);
  const [variante, setVariante] = useState(produto.variante);
  const [descricao, setDescricao] = useState(produto.descricao);
  const [detalhes, setDetalhes] = useState(produto.detalhes);
  const [preco, setPreco] = useState(formatarDecimal(produto.preco_unitario));
  const [imposto, setImposto] = useState(
    formatarDecimal(produto.porcentagem_imposto),
  );
  const [emFalta, setEmFalta] = useState(produto.situacao === 0);

  const [erros, setErros] = useState<Erros>({});
  const [salvando, iniciarSalvamento] = useTransition();

  function salvar() {
    const precoNumero = interpretarNumero(preco);
    const impostoNumero = interpretarNumero(imposto) ?? 0;

    const novos: Erros = {};
    if (!referencia.trim()) novos.referencia = "Informe a referência";
    if (descricao.trim().length < 2) novos.descricao = "Informe a descrição";
    if (precoNumero === null || precoNumero < 0) {
      novos.preco = "Preço inválido";
    }
    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    iniciarSalvamento(async () => {
      try {
        const r = await salvarProduto({
          id: produto.id,
          referencia: referencia.trim(),
          variante: variante.trim(),
          descricao: descricao.trim(),
          detalhes: detalhes.trim(),
          preco_unitario: precoNumero!,
          porcentagem_imposto: impostoNumero,
          situacao: emFalta ? 0 : 1,
        });

        if (!r.ok) {
          toast.error(r.erro);
          return;
        }
        toast.success("Produto atualizado");
        aoSalvar(r.produto);
      } catch {
        toast.error("Não foi possível salvar", {
          description: "Verifique a conexão e tente de novo.",
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="referencia">
            Referência <span className="text-destructive">*</span>
          </Label>
          <Input
            id="referencia"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            maxLength={60}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!!erros.referencia}
            className={cn(
              "h-12 font-mono text-base",
              erros.referencia && "border-destructive",
            )}
          />
          <Erro mensagem={erros.referencia} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="variante">Variante</Label>
          <Input
            id="variante"
            value={variante}
            onChange={(e) => setVariante(e.target.value)}
            maxLength={80}
            placeholder="Cor ou acabamento"
            className="h-12 text-base"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">
          Descrição <span className="text-destructive">*</span>
        </Label>
        <Input
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={300}
          aria-invalid={!!erros.descricao}
          className={cn(
            "h-12 text-base",
            erros.descricao && "border-destructive",
          )}
        />
        <Erro mensagem={erros.descricao} />
      </div>

      {/* Uma informação por linha, como sai da tabela do fabricante: é assim
          que ele lê para responder o lojista. */}
      <div className="space-y-2">
        <Label htmlFor="detalhes">Ficha técnica</Label>
        <Textarea
          id="detalhes"
          value={detalhes}
          onChange={(e) => setDetalhes(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder={"Largura: 8cm | Altura: 40cm\nMaterial: Alumínio"}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Medida, lâmpada, material e cores. Uma por linha.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="preco">
            Preço unitário <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
            >
              R$
            </span>
            <Input
              id="preco"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              onBlur={() => {
                const n = interpretarNumero(preco);
                if (n !== null) setPreco(formatarDecimal(n));
              }}
              inputMode="decimal"
              aria-invalid={!!erros.preco}
              className={cn(
                "h-12 pl-10 text-base tabular-nums",
                erros.preco && "border-destructive",
              )}
            />
          </div>
          <Erro mensagem={erros.preco} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="imposto">Imposto</Label>
          <div className="relative">
            <Input
              id="imposto"
              value={imposto}
              onChange={(e) => setImposto(e.target.value)}
              onBlur={() => {
                const n = interpretarNumero(imposto);
                if (n !== null) setImposto(formatarDecimal(n));
              }}
              inputMode="decimal"
              className="h-12 pr-9 text-base tabular-nums"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
            >
              %
            </span>
          </div>
        </div>
      </div>

      {/* Inativo continua visível na busca — some só dos orçamentos. É o
          que ele quer ao marcar em falta: consultar o preço sem correr o
          risco de vender o que não tem. */}
      <button
        type="button"
        role="switch"
        aria-checked={emFalta}
        onClick={() => setEmFalta((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
          emFalta ? "border-destructive/50 bg-destructive/5" : "bg-card",
        )}
      >
        <PackageX
          className={cn(
            "size-5 shrink-0",
            emFalta ? "text-destructive" : "text-muted-foreground",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Produto em falta</p>
          <p className="text-xs text-muted-foreground">
            Continua na busca, mas não entra em orçamento.
          </p>
        </div>
        <span
          aria-hidden
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            emFalta ? "bg-destructive" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white transition-all",
              emFalta ? "left-[1.375rem]" : "left-0.5",
            )}
          />
        </span>
      </button>

      <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          A próxima carga da tabela da <strong>{fabricante}</strong> sobrescreve
          estes campos. A correção vale até lá.
        </span>
      </p>

      <div className="flex gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={aoCancelar}
          disabled={salvando}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="lg"
          className="flex-1"
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden />
              Salvando…
            </>
          ) : (
            "Salvar"
          )}
        </Button>
      </div>
    </div>
  );
}

function Erro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null;
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {mensagem}
    </p>
  );
}
