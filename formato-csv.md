# Formato do CSV de carga

Contrato entre a extração (conversa com o Claude, ou parser) e o script de carga.
Vale para qualquer fabricante, atual ou futuro.

## Colunas

```
referencia;variante;descricao;preco_unitario;porcentagem_imposto;pagina
```

| coluna | obrigatória | descrição |
|---|---|---|
| `referencia` | sim | código do produto, exatamente como usado no pedido ao fabricante |
| `variante` | não | cor/acabamento quando o preço depende disso; vazio quando não há |
| `descricao` | sim | nome do produto como consta na tabela |
| `preco_unitario` | sim | decimal com ponto, sem `R$`, sem separador de milhar |
| `porcentagem_imposto` | sim | decimal com ponto; `0` quando não houver |
| `pagina` | sim | página do PDF de onde a linha saiu |

## Regras

- **Encoding UTF-8**, com cabeçalho na primeira linha.
- **Separador `;`** — as descrições contêm vírgula com frequência
  (`PERFIL LIGHT MINI DE SOBREPOR, INTERNO ATÉ 5,7MM, BC/BC, TAM: 2M`).
- **Números sempre com ponto decimal e sem milhar**: `1755.84`, nunca `R$ 1.755,84`.
  Converter no momento da extração elimina ambiguidade na leitura.
- **Campo vazio é vazio**, não `NULL` nem `-`.
- **Descrição preservada como está no PDF** (inclusive caixa alta). Normalizar
  é trabalho do app na exibição, não da carga.
- **Preço zero entra como `0.00`**, com imposto `0`. São produtos que ainda não
  entraram em circulação. O script os carrega como `situacao = 0` (inativo):
  aparecem na busca, mas não podem ser lançados em orçamento. Quando a fábrica
  publicar o preço, a carga seguinte os reativa sozinha.

## O que NÃO vai no CSV

- `id_fabricante` — vem por parâmetro do script.
- `situacao` — derivada (preço zero → inativo).
- `id_tabela` — gerada no momento da carga.

## Para que serve a coluna `pagina`

É a defesa contra extração fatiada. Quando o CSV sai de uma conversa em várias
partes, cada emenda é uma chance de pular ou repetir um bloco. Com a página
gravada, o script confere se todas as páginas do PDF aparecem e em que volume —
um buraco na sequência denuncia a fatia perdida antes de qualquer coisa ir ao banco.

## Regras por fabricante

### Luminatti
- Preço: coluna **Sul/MG/RJ** (o PDF traz 5 colunas por região; as demais se ignoram)
- Imposto: **IPI por produto**, como consta na tabela (0 / 9,75 / 15%)
- Referência: `LM` + 4 dígitos

### Metal Domado
- Imposto: **ST em todas as peças**, alíquota única de **16,60%**
- Referência: **somente o número**, com as letras que vierem concatenadas —
  `9080`, `5522P`, `5520GG`, `6609C`, `11304`. O `IP` que aparece no PDF é
  elemento gráfico do catálogo, não faz parte do código.
- Combos viram **produto separado**, com referência própria (`5522P.C05`).
  O preço do combo é **por unidade**, não pelo pacote fechado.
  Descrição no formato `Embalagem Combo 05 un - <nome da peça>`.
- Variante preenchida só quando o preço muda por cor.

## Exemplos

**Luminatti** (IPI por produto, preço da região escolhida):

```csv
referencia;variante;descricao;preco_unitario;porcentagem_imposto;pagina
LM3654;;LUMINARIA LED DE EMBUTIR DOT INFINITE 3 SPOTS 6W 2700K BC/BC;43.20;9.75;1
LM3829;;LUMINARIA DE LED 1 SPOT DE EMBUTIR DIRECIONÁVEL 2W 3000K PT/PT;0.00;0;2
LM3223;;PERFIL LIGHT MINI DE SOBREPOR, INTERNO ATÉ 5,7MM, BC/BC, TAM: 2M;14.70;0;22
```

**Metal Domado** (ST constante, variante quando o preço muda por cor):

```csv
referencia;variante;descricao;preco_unitario;porcentagem_imposto;pagina
9080;;Arandela Linê P;347.00;ST;1
6609C;Travertino Bruto, Kouros e Verde Guatemala;Arandela Bolle Rock Axs M;924.95;ST;7
6609C;Bronze Armani;Arandela Bolle Rock Axs M;1188.65;ST;7
5522P;;Arandela Retrô Sextavada Pequena;637.61;ST;21
5522P.C05;;Embalagem Combo 05 un - Arandela Retrô Sextavada Pequena;410.90;ST;21
5522P.C10;;Embalagem Combo 10 un - Arandela Retrô Sextavada Pequena;367.90;ST;21
```

## Contagens de referência

Servem para conferir a cobertura de cada extração:

| fabricante | tabela | produtos esperados |
|---|---|---|
| Luminatti | julho/2026 | 1.635 (44 páginas) |
| Metal Domado | julho/2026 | 802, sendo 667 base + 135 combos (81 páginas) |

Divergência não significa erro automático — a fábrica pode ter incluído ou
retirado itens. Mas divergência grande sem explicação é sinal de extração
incompleta, e o diff contra o banco mostra exatamente quais linhas mudaram.
