"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Minus,
  Package,
  Plus,
  Smartphone,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarPreco } from "@/lib/catalogo";
import {
  calcularItem,
  calcularOrcamento,
  formatarQuantidade,
} from "@/lib/orcamento";
import {
  useCarrinho,
  type EstadoCarrinho,
  type ItemCarrinho,
} from "@/lib/carrinho";
import {
  novoIdRascunho,
  useRascunhos,
  useRascunhosProntos,
} from "@/lib/rascunhos";
import { cn } from "@/lib/utils";
import { salvarOrcamento } from "./actions";
import { SeletorCliente, type ClienteOpcao } from "./seletor-cliente";
import { SeletorFabricante, type FabricanteOpcao } from "./seletor-fabricante";
import { SeletorProdutos } from "./seletor-produtos";

type Props = {
  clientes: ClienteOpcao[];
  fabricantes: FabricanteOpcao[];
  /** Presente ao abrir um orcamento que ja esta no banco. */
  orcamento?: EstadoCarrinho;
  /** Presente ao abrir um rascunho guardado no aparelho. */
  idRascunho?: string;
};

/**
 * O que importa comparar para saber se ha alteracao pendente. Nome do
 * cliente e descricao do produto nao entram: nao sao editaveis aqui.
 */
function assinatura(e: {
  id_cliente: string | null;
  percentual_desconto: number;
  itens: ItemCarrinho[];
}) {
  return JSON.stringify([
    e.id_cliente,
    e.percentual_desconto,
    e.itens.map((i) => [i.id_produto, i.quantidade, i.percentual_desconto]),
  ]);
}

export function EditorOrcamento({
  clientes,
  fabricantes,
  orcamento,
  idRascunho,
}: Props) {
  const router = useRouter();
  const [enviando, iniciarEnvio] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);
  // troca de empresa com itens no orcamento: guarda a escolha ate confirmar
  const [trocaEmpresa, setTrocaEmpresa] = useState<string | null>(null);
  // o seletor de produtos e unico e fica sempre montado — ver SeletorProdutos
  const [seletorAberto, setSeletorAberto] = useState(false);

  const carrinho = useCarrinho();
  const rascunhosProntos = useRascunhosProntos();
  const guardarRascunho = useRascunhos((s) => s.guardar);
  const removerRascunho = useRascunhos((s) => s.remover);

  // Sincroniza o estado da tela com a rota:
  //   /orcamentos/[id]           carrega o orcamento do banco;
  //   /orcamentos/rascunho/[id]  carrega o rascunho do aparelho;
  //   /orcamentos/novo           comeca do zero, toda vez que ele entra.
  // Os objetos vem novos a cada render, dai comparar por id: sem isso,
  // reabrir sobrescreveria o que ele acabou de editar.
  useEffect(() => {
    if (orcamento) {
      if (useCarrinho.getState().id !== orcamento.id) {
        useCarrinho.getState().abrir(orcamento);
      }
      return;
    }

    if (idRascunho) {
      if (!rascunhosProntos) return;
      if (useCarrinho.getState().id_rascunho === idRascunho) return;

      const r = useRascunhos
        .getState()
        .rascunhos.find((x) => x.id === idRascunho);
      if (!r) {
        // link velho ou rascunho ja enviado de outro lugar
        router.replace("/orcamentos");
        return;
      }
      useCarrinho.getState().abrir({
        id: null,
        numero: null,
        id_rascunho: r.id,
        id_cliente: r.id_cliente,
        id_fabricante: r.id_fabricante,
        itens: r.itens,
        percentual_desconto: r.percentual_desconto,
      });
      return;
    }

    useCarrinho.getState().novo();
  }, [orcamento, idRascunho, rascunhosProntos, router]);

  const totais = useMemo(
    () => calcularOrcamento(carrinho.itens, carrinho.percentual_desconto),
    [carrinho.itens, carrinho.percentual_desconto],
  );

  // no primeiro render o efeito ainda nao rodou; mostrar "nenhum produto"
  // nesse instante pareceria orcamento vazio
  const carregado = orcamento
    ? carrinho.id === orcamento.id
    : idRascunho
      ? carrinho.id_rascunho === idRascunho
      : true;

  const alterado = orcamento
    ? assinatura(carrinho) !== assinatura(orcamento)
    : carrinho.itens.length > 0;

  const semPreco = carrinho.itens.some((i) => i.preco_unitario === 0);

  const nomeCliente =
    clientes.find((c) => c.id === carrinho.id_cliente)?.nome ?? "";
  const nomeEmpresa =
    fabricantes.find((f) => f.id === carrinho.id_fabricante)?.nome ?? "";

  /** Trocar de empresa apaga os itens; com o orcamento montado, confirma. */
  function escolherFabricante(id: string) {
    if (id === carrinho.id_fabricante) return;
    if (carrinho.itens.length > 0) {
      setTrocaEmpresa(id);
      return;
    }
    carrinho.definirFabricante(id);
  }

  /** Devolve a primeira pendencia, ou null quando esta pronto para subir. */
  function validar() {
    if (!carrinho.id_cliente) return "Selecione o cliente.";
    if (!carrinho.id_fabricante) return "Selecione a empresa.";
    if (carrinho.itens.length === 0) return "Adicione ao menos um produto.";
    const semQuantidade = carrinho.itens.find((i) => i.quantidade <= 0);
    if (semQuantidade) {
      return `Informe a quantidade de ${semQuantidade.descricao}.`;
    }
    return null;
  }

  /** Grava no aparelho. Nao valida: rascunho pode estar pela metade. */
  function guardarNoAparelho({ silencioso = false } = {}) {
    const id = carrinho.id_rascunho ?? novoIdRascunho();
    guardarRascunho({
      id,
      id_cliente: carrinho.id_cliente,
      cliente: nomeCliente,
      id_fabricante: carrinho.id_fabricante,
      fabricante: nomeEmpresa,
      itens: carrinho.itens,
      percentual_desconto: carrinho.percentual_desconto,
      total: totais.total,
      atualizado_em: new Date().toISOString(),
    });
    if (!silencioso) {
      toast.success("Guardado neste aparelho", {
        description: "Envie quando tiver conexão.",
      });
      router.push("/orcamentos");
    }
    return id;
  }

  function enviar() {
    const pendencia = validar();
    setErro(pendencia);
    if (pendencia) return;

    iniciarEnvio(async () => {
      try {
        const r = await salvarOrcamento({
          id: carrinho.id,
          id_cliente: carrinho.id_cliente!,
          percentual_desconto: carrinho.percentual_desconto,
          itens: carrinho.itens.map((i) => ({
            id_produto: i.id_produto,
            quantidade: i.quantidade,
            percentual_desconto: i.percentual_desconto,
          })),
        });

        if (!r.ok) {
          setErro(r.erro);
          toast.error(r.erro);
          return;
        }

        // subiu: a copia local perde a razao de existir
        if (carrinho.id_rascunho) removerRascunho(carrinho.id_rascunho);
        toast.success(`Orçamento ${r.numero} enviado`);
        useCarrinho.getState().novo();
        router.push(`/orcamentos/${r.id}`);
      } catch {
        // A action so lanca quando a requisicao nao chega ao servidor. Perder
        // o trabalho aqui seria o pior desfecho possivel: guarda e avisa.
        guardarNoAparelho({ silencioso: true });
        toast.warning("Sem conexão", {
          description: "Guardamos no aparelho. Envie quando o sinal voltar.",
        });
        router.push("/orcamentos");
      }
    });
  }

  if (!carregado) return <EditorCarregando />;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center gap-3">
        <Link
          href="/orcamentos"
          aria-label="Voltar para orçamentos"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-xl font-semibold tracking-tight">
          {carrinho.numero ? `Orçamento ${carrinho.numero}` : "Novo orçamento"}
        </h1>
        {carrinho.id_rascunho ? (
          <Badge variant="outline" className="gap-1 text-[11px]">
            <Smartphone aria-hidden />
            No aparelho
          </Badge>
        ) : alterado && carrinho.id ? (
          <Badge variant="outline" className="text-[11px]">
            Não enviado
          </Badge>
        ) : null}
      </div>

      {/* acompanha a rolagem: o total e o botao ficam sempre a mao */}
      <div className="sticky top-16 z-30 -mx-4 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-2.5 backdrop-blur">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {carrinho.itens.length}{" "}
            {carrinho.itens.length === 1 ? "item" : "itens"}
            {carrinho.itens.length > 0
              ? ` · ${formatarQuantidade(totais.quantidadeTotal)} pç`
              : ""}
          </p>
          <p className="text-lg leading-tight font-semibold tabular-nums">
            {formatarPreco(totais.total)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon-lg"
            title="Guardar neste aparelho"
            disabled={enviando || carrinho.itens.length === 0}
            onClick={() => guardarNoAparelho()}
          >
            <Smartphone className="size-4" aria-hidden />
            <span className="sr-only">Guardar neste aparelho</span>
          </Button>
          <Button size="lg" onClick={enviar} disabled={enviando}>
            <Upload className="size-4" aria-hidden />
            {enviando ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </div>

      {erro ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {erro}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Cliente
          </h2>
          <SeletorCliente
            clientes={clientes}
            selecionado={carrinho.id_cliente}
            aoSelecionar={carrinho.definirCliente}
            invalido={!!erro && !carrinho.id_cliente}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Empresa
          </h2>
          <SeletorFabricante
            fabricantes={fabricantes}
            selecionado={carrinho.id_fabricante}
            aoSelecionar={escolherFabricante}
          />
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Produtos
          </h2>
          {carrinho.itens.length > 0 ? (
            <Button size="lg" onClick={() => setSeletorAberto(true)}>
              <Plus className="size-4" aria-hidden />
              Adicionar
            </Button>
          ) : null}
        </div>

        {carrinho.itens.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted">
              <Package className="size-6 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="font-medium">Nenhum produto</p>
              <p className="mt-1 text-sm text-balance text-muted-foreground">
                {carrinho.id_fabricante
                  ? "Busque pelo nome ou pelo código."
                  : "Escolha a empresa para liberar o catálogo."}
              </p>
            </div>
            {carrinho.id_fabricante ? (
              <Button size="lg" onClick={() => setSeletorAberto(true)}>
                <Plus className="size-4" aria-hidden />
                Adicionar produto
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-2">
            {carrinho.itens.map((item) => (
              <LinhaItem key={item.id_produto} item={item} />
            ))}
          </ul>
        )}

        {semPreco ? (
          <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Há produto sem preço no orçamento. Ele entra valendo R$ 0,00.
          </p>
        ) : null}
      </section>

      {carrinho.itens.length > 0 ? (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Desconto no orçamento
            </h2>
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
              <CampoNumero
                valor={carrinho.percentual_desconto}
                aoMudar={carrinho.definirDescontoGlobal}
                ariaLabel="Desconto no orçamento em porcentagem"
                sufixo="%"
              />
              <p className="text-xs text-muted-foreground">
                Aplicado sobre o total já com impostos.
              </p>
            </div>
          </section>

          <Resumo totais={totais} percentual={carrinho.percentual_desconto} />

          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            onClick={() => setConfirmarLimpeza(true)}
          >
            <Trash2 className="size-4" aria-hidden />
            {carrinho.id_rascunho ? "Descartar rascunho" : "Limpar orçamento"}
          </Button>
        </>
      ) : null}

      <SeletorProdutos
        aberto={seletorAberto}
        aoMudarAberto={setSeletorAberto}
      />

      <AlertDialog
        open={trocaEmpresa !== null}
        onOpenChange={(aberto) => !aberto && setTrocaEmpresa(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Trocar para{" "}
              {fabricantes.find((f) => f.id === trocaEmpresa)?.nome ??
                "outra empresa"}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Um orçamento é de uma empresa só. Os {carrinho.itens.length}{" "}
              {carrinho.itens.length === 1 ? "produto" : "produtos"} já
              adicionados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (trocaEmpresa) carrinho.definirFabricante(trocaEmpresa);
                setTrocaEmpresa(null);
              }}
            >
              Trocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarLimpeza} onOpenChange={setConfirmarLimpeza}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {carrinho.id_rascunho
                ? "Descartar o rascunho?"
                : "Limpar o orçamento?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {carrinho.id_rascunho
                ? "Ele existe só neste aparelho e não tem como voltar."
                : carrinho.id
                  ? "Os itens e o desconto saem desta tela. O orçamento no banco continua como está até você enviar de novo."
                  : "Os itens e o desconto são apagados desta tela."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const rascunho = carrinho.id_rascunho;
                useCarrinho.getState().novo();
                setConfirmarLimpeza(false);
                setErro(null);
                if (rascunho) removerRascunho(rascunho);
                if (orcamento || rascunho) router.push("/orcamentos");
              }}
            >
              {carrinho.id_rascunho ? "Descartar" : "Limpar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LinhaItem({ item }: { item: ItemCarrinho }) {
  const definirQuantidade = useCarrinho((s) => s.definirQuantidade);
  const definirDescontoItem = useCarrinho((s) => s.definirDescontoItem);
  const remover = useCarrinho((s) => s.remover);

  const t = calcularItem(item);
  const semPreco = item.preco_unitario === 0;

  return (
    <li className="space-y-3 rounded-xl border bg-card p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-medium">{item.descricao}</p>
          {item.variante ? (
            <p className="mt-0.5 text-xs text-marca-azul dark:text-marca-dourado">
              {item.variante}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-xs text-muted-foreground">
              {item.referencia}
            </span>
            {semPreco ? (
              <Badge variant="destructive" className="text-[11px]">
                Sem preço
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatarPreco(item.preco_unitario)} un
              </span>
            )}
            {item.porcentagem_imposto > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                +{item.porcentagem_imposto.toLocaleString("pt-BR")}% imp.
              </span>
            ) : null}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          title="Remover"
          onClick={() => remover(item.id_produto)}
        >
          <Trash2 className="size-4 text-destructive" aria-hidden />
          <span className="sr-only">Remover {item.descricao}</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Diminuir quantidade"
            disabled={item.quantidade <= 1}
            onClick={() =>
              definirQuantidade(item.id_produto, item.quantidade - 1)
            }
          >
            <Minus className="size-4" aria-hidden />
          </Button>
          <CampoNumero
            valor={item.quantidade}
            aoMudar={(v) => definirQuantidade(item.id_produto, v)}
            ariaLabel={`Quantidade de ${item.descricao}`}
          />
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Aumentar quantidade"
            onClick={() =>
              definirQuantidade(item.id_produto, item.quantidade + 1)
            }
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Desc.</span>
          <CampoNumero
            valor={item.percentual_desconto}
            aoMudar={(v) => definirDescontoItem(item.id_produto, v)}
            ariaLabel={`Desconto em ${item.descricao}`}
            sufixo="%"
          />
        </div>

        <div className="ml-auto text-right">
          {t.desconto > 0 || t.imposto > 0 ? (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {formatarPreco(t.bruto)}
              {t.desconto > 0 ? ` − ${formatarPreco(t.desconto)}` : ""}
              {t.imposto > 0 ? ` + ${formatarPreco(t.imposto)}` : ""}
            </p>
          ) : null}
          <p className="leading-tight font-semibold tabular-nums">
            {formatarPreco(t.total)}
          </p>
        </div>
      </div>
    </li>
  );
}

/**
 * Le o numero como um brasileiro escreveria — e tambem como o teclado do
 * celular as vezes entrega.
 *
 * Havendo virgula, ela e a decimal e os pontos sao separador de milhar
 * ("1.250,5"). So com ponto, ele e a decimal ("3.5" = tres e meio, nao 35),
 * que e o erro silencioso mais provavel em campo de quantidade.
 */
function interpretarNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, "");
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Campo numerico em portugues: aceita virgula, deixa digitar livremente e
 * so converte ao sair. Travar a cada tecla impede de apagar para redigitar.
 */
function CampoNumero({
  valor,
  aoMudar,
  ariaLabel,
  sufixo,
}: {
  valor: number;
  aoMudar: (v: number) => void;
  ariaLabel: string;
  sufixo?: string;
}) {
  const [texto, setTexto] = useState(() => formatarQuantidade(valor));
  const [ultimo, setUltimo] = useState(valor);

  // valor mudou por fora (botao +/−, carga do servidor): reflete no campo
  if (valor !== ultimo) {
    setUltimo(valor);
    setTexto(formatarQuantidade(valor));
  }

  function confirmar() {
    const numero = interpretarNumero(texto);
    if (texto.trim() === "" || numero === null) {
      setTexto(formatarQuantidade(valor)); // entrada invalida: volta ao que era
      return;
    }
    aoMudar(numero);
    setTexto(formatarQuantidade(numero));
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={texto}
        aria-label={ariaLabel}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(
          "h-9 w-16 rounded-lg border bg-background text-center text-base font-medium tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          sufixo && "pr-5",
        )}
      />
      {sufixo ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm text-muted-foreground"
        >
          {sufixo}
        </span>
      ) : null}
    </div>
  );
}

function Resumo({
  totais,
  percentual,
}: {
  totais: ReturnType<typeof calcularOrcamento>;
  percentual: number;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">Resumo</h2>
      <dl className="space-y-2 rounded-xl border bg-card p-4 text-sm">
        <Linha rotulo="Subtotal" valor={formatarPreco(totais.subTotal)} />
        {totais.descontoItens > 0 ? (
          <Linha
            rotulo="Descontos nos itens"
            valor={`− ${formatarPreco(totais.descontoItens)}`}
          />
        ) : null}
        {totais.imposto > 0 ? (
          <Linha
            rotulo="Impostos"
            valor={`+ ${formatarPreco(totais.imposto)}`}
          />
        ) : null}
        {totais.descontoGlobal > 0 ? (
          <Linha
            rotulo={`Desconto no orçamento (${percentual.toLocaleString("pt-BR")}%)`}
            valor={`− ${formatarPreco(totais.descontoGlobal)}`}
          />
        ) : null}
        <div className="flex items-baseline justify-between gap-3 border-t pt-2.5">
          <dt className="font-semibold">Total</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {formatarPreco(totais.total)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}

function EditorCarregando() {
  return (
    <div className="space-y-5" aria-label="Carregando orçamento">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-14 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
