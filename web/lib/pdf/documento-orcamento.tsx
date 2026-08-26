import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatarPreco } from "@/lib/catalogo";
import {
  calcularItem,
  calcularOrcamento,
  formatarPrazo,
  formatarQuantidade,
} from "@/lib/orcamento";
import { formatarTelefone } from "@/lib/telefone";
import type { DadosPdf } from "@/app/(interno)/orcamentos/actions";

/**
 * O orcamento em papel.
 *
 * Usa o mesmo lib/orcamento do app e do servidor — o cliente nao pode
 * receber um numero diferente do que ficou gravado no banco.
 */

// Arquivos locais, servidos pelo proprio dominio: o PDF e gerado no
// navegador e nao pode depender de request a servidor externo.
Font.register({
  family: "Montserrat",
  fonts: [
    { src: "/fontes/Montserrat-400.ttf", fontWeight: 400 },
    { src: "/fontes/Montserrat-600.ttf", fontWeight: 600 },
    { src: "/fontes/Montserrat-700.ttf", fontWeight: 700 },
  ],
});

// sem isto o texto longo estoura a celula em vez de quebrar
Font.registerHyphenationCallback((palavra) => [palavra]);

const NAVY = "#00112A";
const CINZA = "#6B7280";
const BORDA = "#E5E7EB";

// Somam 535pt, a largura util do A4 com margem de 30pt de cada lado.
// A descricao fica com a sobra porque e a unica coluna de tamanho variavel.
const COL = {
  referencia: 52,
  descricao: 175,
  preco: 58,
  quantidade: 30,
  desconto: 52,
  subtotal: 56,
  imposto: 50,
  total: 62,
};

const s = StyleSheet.create({
  pagina: {
    fontFamily: "Montserrat",
    fontSize: 8,
    color: NAVY,
    paddingTop: 0,
    paddingBottom: 46,
    paddingHorizontal: 0,
  },

  // A logo so funciona sobre fundo escuro: e um letreiro branco com feixe
  // em degrade preto. Sobre papel branco ela simplesmente some, entao a
  // faixa navy nao e enfeite — e o que torna a marca visivel.
  faixa: {
    backgroundColor: NAVY,
    color: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 30,
    paddingVertical: 16,
  },
  logo: { width: 54, height: 45, objectFit: "contain" },
  representante: { fontSize: 12, fontWeight: 700, color: "#FFFFFF" },
  contato: { fontSize: 8, color: "#FFFFFFB3", marginTop: 3 },

  corpo: { paddingHorizontal: 30, paddingTop: 18 },

  identificacao: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 16,
  },
  rotulo: { fontSize: 7, color: CINZA, textTransform: "uppercase" },
  valor: { fontSize: 10, fontWeight: 600, marginTop: 2 },

  cabecalhoTabela: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: BORDA,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  th: {
    fontSize: 7,
    fontWeight: 700,
    color: CINZA,
    textTransform: "uppercase",
  },

  linha: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDA,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  td: { fontSize: 8 },
  variante: { fontSize: 7, color: CINZA, marginTop: 1 },
  direita: { textAlign: "right" },
  centro: { textAlign: "center" },

  // a condicao de pagamento ocupa a sobra a esquerda dos totais, que e
  // onde quem le um orcamento procura as condicoes comerciais
  totais: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
  },
  obs: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDA,
  },
  obsTexto: { fontSize: 8, marginTop: 3, lineHeight: 1.4 },
  caixaTotais: { width: 230 },
  linhaTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  linhaFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 2,
    borderTopColor: NAVY,
    paddingTop: 6,
    marginTop: 2,
  },
  totalRotulo: { fontSize: 11, fontWeight: 700 },
  totalValor: { fontSize: 13, fontWeight: 700 },

  rodape: {
    position: "absolute",
    bottom: 22,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDA,
    paddingTop: 6,
    fontSize: 7,
    color: CINZA,
  },
});

const DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** "160/2026" — o mesmo formato que ele ja usa na planilha. */
function numeroDoOrcamento(numero: number, iso: string) {
  const ano = new Intl.DateTimeFormat("pt-BR", {
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
  return `${numero}/${ano}`;
}

export function DocumentoOrcamento({ dados }: { dados: DadosPdf }) {
  const totais = calcularOrcamento(dados.itens, dados.percentual_desconto);
  const identificacao = numeroDoOrcamento(dados.numero, dados.criado_em);

  return (
    <Document
      title={`Orçamento ${identificacao}`}
      author={dados.representante.nome}
      subject={`Orçamento para ${dados.cliente}`}
    >
      <Page size="A4" style={s.pagina}>
        <View style={s.faixa} fixed>
          {/* Image do @react-pdf, nao do HTML: desenha no papel e nao tem
              conceito de alt — a regra de a11y nao se aplica aqui. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src="/logo-simbolo.png" style={s.logo} />
          <View>
            <Text style={s.representante}>{dados.representante.nome}</Text>
            <Text style={s.contato}>
              {[
                dados.representante.whatsapp
                  ? formatarTelefone(dados.representante.whatsapp)
                  : null,
                dados.representante.email,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </Text>
          </View>
        </View>

        <View style={s.corpo}>
          <View style={s.identificacao}>
            <Campo rotulo="Cliente" valor={dados.cliente} />
            <Campo rotulo="Empresa" valor={dados.fabricante || "—"} />
            <Campo rotulo="Orçamento" valor={identificacao} />
            <Campo
              rotulo="Data"
              valor={DATA.format(new Date(dados.criado_em))}
            />
          </View>

          {/* repete o cabecalho quando a lista passa de uma pagina */}
          <View style={s.cabecalhoTabela} fixed>
            <Text style={[s.th, { width: COL.referencia }]}>Ref.</Text>
            <Text style={[s.th, { width: COL.descricao }]}>Descrição</Text>
            <Text style={[s.th, s.direita, { width: COL.preco }]}>
              Unitário
            </Text>
            <Text style={[s.th, s.centro, { width: COL.quantidade }]}>Qtd</Text>
            <Text style={[s.th, s.direita, { width: COL.desconto }]}>
              Desc.
            </Text>
            <Text style={[s.th, s.direita, { width: COL.subtotal }]}>
              Subtotal
            </Text>
            <Text style={[s.th, s.direita, { width: COL.imposto }]}>
              Imposto
            </Text>
            <Text style={[s.th, s.direita, { width: COL.total }]}>Total</Text>
          </View>

          {dados.itens.map((item, i) => {
            const t = calcularItem(item);
            return (
              <View
                key={`${item.referencia}-${i}`}
                style={s.linha}
                wrap={false}
              >
                <Text style={[s.td, { width: COL.referencia }]}>
                  {item.referencia}
                </Text>
                <View style={{ width: COL.descricao, paddingRight: 6 }}>
                  <Text style={s.td}>{item.descricao}</Text>
                  {item.variante ? (
                    <Text style={s.variante}>{item.variante}</Text>
                  ) : null}
                </View>
                <Text style={[s.td, s.direita, { width: COL.preco }]}>
                  {formatarPreco(item.preco_unitario)}
                </Text>
                <Text style={[s.td, s.centro, { width: COL.quantidade }]}>
                  {formatarQuantidade(item.quantidade)}
                </Text>
                <Text style={[s.td, s.direita, { width: COL.desconto }]}>
                  {t.desconto > 0 ? `−${formatarPreco(t.desconto)}` : "—"}
                </Text>
                <Text style={[s.td, s.direita, { width: COL.subtotal }]}>
                  {formatarPreco(t.base)}
                </Text>
                <Text style={[s.td, s.direita, { width: COL.imposto }]}>
                  {t.imposto > 0 ? formatarPreco(t.imposto) : "—"}
                </Text>
                <Text
                  style={[
                    s.td,
                    s.direita,
                    { width: COL.total, fontWeight: 600 },
                  ]}
                >
                  {formatarPreco(t.total)}
                </Text>
              </View>
            );
          })}

          {/* "Total com impostos" e a soma da coluna Total: quem conferir
              linha a linha fecha a conta. O desconto aqui e o do orcamento
              inteiro — os descontos de item ja aparecem na coluna deles.
              Nome deliberadamente diferente do "Subtotal" da tabela: la e o
              item sem imposto, aqui e o pedido inteiro com imposto — o mesmo
              rotulo nos dois lugares diria coisas diferentes. */}
          <View style={s.totais}>
            <View style={{ flexShrink: 1 }}>
              <Text style={s.rotulo}>Condição de pagamento</Text>
              <Text style={s.valor}>
                {formatarPrazo(dados.prazo_pagamento)}
              </Text>
              {dados.transportadora ? (
                <>
                  <Text style={[s.rotulo, { marginTop: 8 }]}>
                    Transportadora
                  </Text>
                  <Text style={s.valor}>{dados.transportadora}</Text>
                </>
              ) : null}
            </View>

            <View style={s.caixaTotais}>
              <View style={s.linhaTotal}>
                <Text style={{ color: CINZA }}>Total com impostos</Text>
                <Text style={{ fontWeight: 600 }}>
                  {formatarPreco(totais.totalComImposto)}
                </Text>
              </View>
              <View style={s.linhaTotal}>
                <Text style={{ color: CINZA }}>
                  Desconto
                  {dados.percentual_desconto > 0
                    ? ` (${dados.percentual_desconto.toLocaleString("pt-BR")}%)`
                    : ""}
                </Text>
                <Text style={{ fontWeight: 600 }}>
                  {totais.descontoGlobal > 0
                    ? `−${formatarPreco(totais.descontoGlobal)}`
                    : "—"}
                </Text>
              </View>
              <View style={s.linhaFinal}>
                <Text style={s.totalRotulo}>Total</Text>
                <Text style={[s.totalValor, { color: NAVY }]}>
                  {formatarPreco(totais.total)}
                </Text>
              </View>
            </View>
          </View>

          {dados.obs ? (
            <View style={s.obs}>
              <Text style={s.rotulo}>Observações</Text>
              <Text style={s.obsTexto}>{dados.obs}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.rodape} fixed>
          <Text>
            Orçamento {identificacao} · {dados.cliente}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ flexShrink: 1 }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={s.valor}>{valor}</Text>
    </View>
  );
}
