"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Lock,
  Minus,
  Package,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatarPreco } from "@/lib/catalogo";
import {
  calcularItem,
  calcularOrcamento,
  formatarPercentual,
  formatarPrazo,
  formatarQuantidade,
  PRAZOS_PAGAMENTO,
} from "@/lib/orcamento";
import {
  useCarrinho,
  useRascunho,
  type EstadoCarrinho,
  type ItemCarrinho,
} from "@/lib/carrinho";
import { useFilaOrcamentos } from "@/lib/fila-orcamentos";
import { gerarId } from "@/lib/id";
import { useCatalogo } from "@/lib/use-catalogo";
import { interpretarNumero } from "@/lib/numero";
import { cn } from "@/lib/utils";
import { salvarOrcamento } from "./actions";
import { SeletorCliente, type ClienteOpcao } from "./seletor-cliente";
import { SeletorFabricante, type FabricanteOpcao } from "./seletor-fabricante";
import { SeletorProdutos } from "./seletor-produtos";

type Props = {
  clientes: ClienteOpcao[];
  fabricantes: FabricanteOpcao[];
  /** Ausente em /orcamentos/novo; presente ao abrir um orcamento salvo. */
  orcamento?: EstadoCarrinho;
  /** Anterior a tabela vigente: fica so para consulta. Ver a regra em
   *  `orcamentoDesatualizado`, em lib/orcamento.ts. */
  bloqueado?: boolean;
};

/**
 * O que importa comparar para saber se ha alteracao pendente. Nome do
 * cliente e descricao do produto nao entram: nao sao editaveis aqui.
 */
function assinatura(e: {
  id_cliente: string | null;
  percentual_desconto: number;
  prazo_pagamento: number;
  obs: string;
  transportadora: string;
  itens: ItemCarrinho[];
}) {
  return JSON.stringify([
    e.id_cliente,
    e.percentual_desconto,
    e.prazo_pagamento,
    e.obs,
    e.transportadora,
    e.itens.map((i) => [i.id_produto, i.quantidade, i.percentual_desconto]),
  ]);
}

export function EditorOrcamento({
  clientes,
  fabricantes,
  orcamento,
  bloqueado = false,
}: Props) {
  const router = useRouter();
  const [salvando, iniciarSalvamento] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);
  // troca de empresa com itens no orcamento: guarda a escolha ate confirmar
  const [trocaEmpresa, setTrocaEmpresa] = useState<string | null>(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  // o seletor de produtos e unico e fica sempre montado — ver SeletorProdutos
  const [seletorAberto, setSeletorAberto] = useState(false);

  const carrinho = useCarrinho();

  const hidratado = useRascunho();

  // Sincroniza o estado da tela com a rota:
  //   /orcamentos/[id]  carrega o orcamento salvo;
  //   /orcamentos/novo  retoma o rascunho gravado no aparelho.
  // O objeto `orcamento` e recriado a cada render do servidor, dai comparar
  // por id: sem isso, reabrir sobrescreveria o que ele acabou de editar.
  //
  // Em /novo o rascunho so e descartado quando tem `id`, ou seja, quando
  // sobrou de um orcamento ja salvo que ele abriu e deixou sem gravar —
  // esse nao e o rascunho de agora. Zerar aqui em todo caso, como era
  // antes, apagaria o trabalho que a gravacao no aparelho existe para
  // proteger: bastava o iOS descarregar o app e voltar para a tela.
  useEffect(() => {
    if (!hidratado) return;
    if (orcamento) {
      if (useCarrinho.getState().id !== orcamento.id) {
        useCarrinho.getState().abrir(orcamento);
      }
    } else if (useCarrinho.getState().id !== null) {
      useCarrinho.getState().novo();
    }
  }, [orcamento, hidratado]);

  // O catalogo do aparelho e a versao mais recente que ele tem dos produtos.
  // Enquanto o rascunho esta aberto, as linhas acompanham — inclusive quando
  // ele acabou de corrigir o preco na tela de Produtos.
  const { data: catalogo } = useCatalogo();

  useEffect(() => {
    if (!hidratado || !catalogo) return;
    useCarrinho.getState().sincronizarComCatalogo(catalogo.produtos);
  }, [hidratado, catalogo]);

  /** Produto que saiu do catalogo ou ficou em falta depois de entrar. */
  const indisponiveis = useMemo(() => {
    if (!catalogo) return new Set<string>();
    const porId = new Map(catalogo.produtos.map((p) => [p.id, p]));
    return new Set(
      carrinho.itens
        .filter((i) => porId.get(i.id_produto)?.situacao !== 1)
        .map((i) => i.id_produto),
    );
  }, [catalogo, carrinho.itens]);

  const totais = useMemo(
    () => calcularOrcamento(carrinho.itens, carrinho.percentual_desconto),
    [carrinho.itens, carrinho.percentual_desconto],
  );

  // no primeiro render o efeito ainda nao rodou; mostrar "nenhum produto"
  // nesse instante pareceria orcamento vazio
  const carregado = hidratado && (!orcamento || carrinho.id === orcamento.id);

  const alterado = orcamento
    ? assinatura(carrinho) !== assinatura(orcamento)
    : carrinho.itens.length > 0;

  const semPreco = carrinho.itens.some((i) => i.preco_unitario === 0);

  /** Trocar de empresa apaga os itens; com o orcamento montado, confirma. */
  function escolherFabricante(id: string) {
    if (id === carrinho.id_fabricante) return;
    if (carrinho.itens.length > 0) {
      setTrocaEmpresa(id);
      return;
    }
    carrinho.definirFabricante(id);
  }

  /** Larga o orcamento e volta para a lista. */
  function sair() {
    useCarrinho.getState().novo();
    router.push("/orcamentos");
  }

  /** Devolve a primeira pendencia, ou null quando esta pronto para salvar. */
  function validar() {
    if (!carrinho.id_cliente) return "Selecione o cliente.";
    if (!carrinho.id_fabricante) return "Selecione a empresa.";
    if (carrinho.itens.length === 0) return "Adicione ao menos um produto.";
    const semQuantidade = carrinho.itens.find((i) => i.quantidade <= 0);
    if (semQuantidade) {
      return `Informe a quantidade de ${semQuantidade.descricao}.`;
    }
    // o servidor recusaria do mesmo jeito; avisar aqui poupa a ida
    const emFalta = carrinho.itens.find((i) => indisponiveis.has(i.id_produto));
    if (emFalta) {
      return `${emFalta.descricao} está em falta. Remova para salvar.`;
    }
    return null;
  }

  function salvar() {
    const pendencia = validar();
    setErro(pendencia);
    if (pendencia) return;

    // o id sai daqui e nao do banco: e ele que faz o reenvio da fila
    // atualizar o mesmo orcamento em vez de criar um segundo
    const entrada = {
      id: carrinho.id,
      id_novo: carrinho.id ? undefined : gerarId(),
      id_cliente: carrinho.id_cliente!,
      percentual_desconto: carrinho.percentual_desconto,
      prazo_pagamento: carrinho.prazo_pagamento,
      obs: carrinho.obs,
      transportadora: carrinho.transportadora,
      itens: carrinho.itens.map((i) => ({
        id_produto: i.id_produto,
        quantidade: i.quantidade,
        percentual_desconto: i.percentual_desconto,
      })),
    };

    iniciarSalvamento(async () => {
      try {
        const r = await salvarOrcamento(entrada);

        if (!r.ok) {
          setErro(r.erro);
          toast.error(r.erro);
          return;
        }

        toast.success(`Orçamento ${r.numero} salvo`);
        // volta para a lista: salvou, acabou. Cair na edicao do que acabou
        // de ser salvo sugere que ainda falta alguma coisa.
        useCarrinho.getState().novo();
        router.push("/orcamentos");
      } catch {
        // A action so lanca quando a requisicao nao chega ao servidor — sem
        // sinal, tunel, elevador. Antes ficava na tela mandando tentar de
        // novo, o que na loja sem sinal significava tentar ate desistir.
        // Agora o orcamento entra na fila e sobe sozinho.
        useFilaOrcamentos.getState().enfileirar({
          id: entrada.id_novo ?? entrada.id!,
          entrada,
          cliente:
            clientes.find((c) => c.id === carrinho.id_cliente)?.nome ?? "—",
          fabricante:
            fabricantes.find((f) => f.id === carrinho.id_fabricante)?.nome ??
            "",
          valor_total: totais.total,
          criado_em: new Date().toISOString(),
        });

        toast.success("Orçamento guardado no aparelho", {
          description: "Sobe sozinho assim que o sinal voltar.",
          duration: 8000,
        });
        useCarrinho.getState().novo();

        // Sem router.push aqui, de proposito. Trocar de tela pede o payload
        // RSC ao servidor, e e justamente ele que nao esta respondendo — a
        // navegacao estouraria no roteador e a tela quebraria logo depois de
        // guardar o orcamento com sucesso. Fica onde esta, ja em branco para
        // o proximo. A lista, com o pendente, ele ve quando o sinal voltar.
      }
    });
  }

  if (!carregado) return <EditorCarregando />;

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center gap-3">
        {/* Sair pela seta e desistir do orcamento, entao o rascunho vai
            junto — gravar no aparelho existe para o app ser descarregado sem
            ele mandar, nao para guardar o que ele decidiu abandonar.
            Com produtos na tela, pergunta antes: um toque errado na seta nao
            pode apagar o que ele acabou de montar na frente do cliente. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Voltar para orçamentos"
          onClick={() => (alterado ? setConfirmarSaida(true) : sair())}
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Button>
        <h1 className="flex-1 text-xl font-semibold tracking-tight">
          {carrinho.numero ? `Orçamento ${carrinho.numero}` : "Novo orçamento"}
        </h1>
        {alterado && carrinho.id && !bloqueado ? (
          <Badge variant="outline" className="text-[11px]">
            Não salvo
          </Badge>
        ) : null}
      </div>

      {bloqueado ? (
        <p className="flex items-start gap-2 rounded-xl border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Este orçamento é anterior à tabela de preços atual desta empresa.
            Fica para consulta e PDF: alterar recalcularia tudo pelos preços de
            hoje, e o cliente receberia outro valor.
          </span>
        </p>
      ) : null}

      {/* acompanha a rolagem: o total e o botao ficam sempre a mao */}
      <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-2.5 backdrop-blur">
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
        {bloqueado ? null : (
          <Button size="lg" onClick={salvar} disabled={salvando}>
            <Save className="size-4" aria-hidden />
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        )}
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
            desabilitado={bloqueado}
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
            desabilitado={bloqueado}
          />
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Produtos
          </h2>
          {carrinho.itens.length > 0 && !bloqueado ? (
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
            {carrinho.id_fabricante && !bloqueado ? (
              <Button size="lg" onClick={() => setSeletorAberto(true)}>
                <Plus className="size-4" aria-hidden />
                Adicionar produto
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-2">
            {carrinho.itens.map((item) => (
              <LinhaItem
                key={item.id_produto}
                item={item}
                indisponivel={indisponiveis.has(item.id_produto)}
                bloqueado={bloqueado}
              />
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
          {/* Congelado, estes quatro viram texto — nao campo desabilitado.
              Editavel que nao salva e pior do que ausente: ele digita a
              observacao na frente do cliente, sai da tela e ela some, sem
              nada em momento nenhum ter avisado. Mesmo criterio da LinhaItem.
              Os que estao vazios somem: campo em branco num documento
              fechado so ocupa espaco. */}
          {bloqueado ? (
            <>
              {carrinho.percentual_desconto > 0 ? (
                <SecaoFixa rotulo="Desconto no orçamento">
                  {formatarPercentual(carrinho.percentual_desconto)} sobre o
                  total já com impostos.
                </SecaoFixa>
              ) : null}

              <SecaoFixa rotulo="Condição de pagamento">
                {carrinho.prazo_pagamento === 0
                  ? "Pagamento à vista."
                  : `Pagamento em ${formatarPrazo(carrinho.prazo_pagamento)}.`}
              </SecaoFixa>

              {carrinho.transportadora ? (
                <SecaoFixa rotulo="Transportadora">
                  {carrinho.transportadora}
                </SecaoFixa>
              ) : null}

              {carrinho.obs ? (
                <SecaoFixa rotulo="Observações">
                  {/* whitespace-pre-line preserva as quebras que ele digitou */}
                  <span className="whitespace-pre-line">{carrinho.obs}</span>
                </SecaoFixa>
              ) : null}
            </>
          ) : (
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

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Condição de pagamento
                </h2>
                <div className="space-y-2 rounded-xl border bg-card p-3.5">
                  {/* Dominio fechado: so estes prazos existem, entao botao em
                      vez de campo aberto — nada de "30d" ou "trinta dias" no
                      banco. */}
                  <div
                    className="grid grid-cols-5 gap-2"
                    role="group"
                    aria-label="Prazo de pagamento em dias"
                  >
                    {PRAZOS_PAGAMENTO.map((dias) => (
                      <button
                        key={dias}
                        type="button"
                        aria-pressed={carrinho.prazo_pagamento === dias}
                        aria-label={formatarPrazo(dias)}
                        onClick={() => carrinho.definirPrazoPagamento(dias)}
                        className={cn(
                          "rounded-lg border py-2.5 text-sm font-medium tabular-nums transition-colors",
                          carrinho.prazo_pagamento === dias
                            ? "border-transparent bg-marca-navy text-white dark:bg-marca-dourado dark:text-marca-navy"
                            : "bg-background hover:bg-accent",
                        )}
                      >
                        {dias === 0 ? "À vista" : dias}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {carrinho.prazo_pagamento === 0
                      ? "Pagamento à vista."
                      : `Pagamento em ${formatarPrazo(carrinho.prazo_pagamento)}.`}
                  </p>
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Transportadora
                </h2>
                <Input
                  value={carrinho.transportadora}
                  onChange={(e) =>
                    carrinho.definirTransportadora(e.target.value)
                  }
                  placeholder="Nome da transportadora"
                  aria-label="Transportadora do orçamento"
                  maxLength={120}
                  className="h-12 text-base"
                />
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Observações
                </h2>
                <Textarea
                  value={carrinho.obs}
                  onChange={(e) => carrinho.definirObs(e.target.value)}
                  placeholder="Alguma observação para este orçamento…"
                  aria-label="Observações do orçamento"
                />
              </section>
            </>
          )}

          <Resumo totais={totais} percentual={carrinho.percentual_desconto} />

          {/* So no orcamento novo. Num ja salvo isto nao apagaria nada do
              banco — seria um botao vermelho que nao faz o que promete.
              Para apagar de verdade existe o Excluir, na lista. */}
          {!orcamento ? (
            <Button
              variant="destructive"
              size="lg"
              className="w-full"
              onClick={() => setConfirmarLimpeza(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              Recomeçar do zero
            </Button>
          ) : null}
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

      <AlertDialog open={confirmarSaida} onOpenChange={setConfirmarSaida}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              {carrinho.itens.length > 0
                ? `Os ${carrinho.itens.length} ${carrinho.itens.length === 1 ? "produto sai" : "produtos saem"} da tela e o orçamento se perde.`
                : "O que está preenchido se perde."}{" "}
              {carrinho.id
                ? "O orçamento já salvo continua como estava."
                : "Não há cópia salva."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmarSaida(false);
                sair();
              }}
            >
              Sair e descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarLimpeza} onOpenChange={setConfirmarLimpeza}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recomeçar do zero?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente, a empresa e os {carrinho.itens.length}{" "}
              {carrinho.itens.length === 1 ? "produto" : "produtos"} saem da
              tela, e o orçamento volta a ficar em branco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                useCarrinho.getState().novo();
                setConfirmarLimpeza(false);
                setErro(null);
              }}
            >
              Recomeçar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Campo do orcamento congelado: rotulo e valor, sem nada para tocar. */
function SecaoFixa({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{rotulo}</h2>
      <p className="rounded-xl border bg-card p-3.5 text-sm">{children}</p>
    </section>
  );
}

function LinhaItem({
  item,
  indisponivel,
  bloqueado,
}: {
  item: ItemCarrinho;
  /** produto saiu do catálogo ou ficou em falta depois de entrar aqui */
  indisponivel: boolean;
  /** orçamento anterior à tabela vigente: linha só de leitura */
  bloqueado: boolean;
}) {
  const definirQuantidade = useCarrinho((s) => s.definirQuantidade);
  const definirDescontoItem = useCarrinho((s) => s.definirDescontoItem);
  const remover = useCarrinho((s) => s.remover);

  const t = calcularItem(item);
  const semPreco = item.preco_unitario === 0;

  return (
    <li
      className={cn(
        "space-y-3 rounded-xl border p-3.5",
        indisponivel ? "border-destructive/50 bg-destructive/5" : "bg-card",
      )}
    >
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
            {indisponivel ? (
              <Badge variant="destructive" className="text-[11px]">
                Em falta
              </Badge>
            ) : null}
          </div>
        </div>

        {bloqueado ? null : (
          <Button
            variant="ghost"
            size="icon"
            title="Remover"
            onClick={() => remover(item.id_produto)}
          >
            <Trash2 className="size-4 text-destructive" aria-hidden />
            <span className="sr-only">Remover {item.descricao}</span>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {bloqueado ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatarQuantidade(item.quantidade)} pç
            {item.percentual_desconto > 0
              ? ` · ${item.percentual_desconto.toLocaleString("pt-BR")}% desc.`
              : ""}
          </p>
        ) : (
          <>
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
          </>
        )}

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
