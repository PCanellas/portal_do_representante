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
  `9080`, `5522P`, `5520GG`, `6609C`, `11304`. A caixa da letra distingue peça
  (`6020D` direta, `6020i` indireta). O `IP` que aparece no PDF é elemento
  gráfico do catálogo, não faz parte do código.
- Combos viram **produto separado**, com referência própria (`5522P.C05`).
  O preço do combo é **por unidade**, não pelo pacote fechado.
  Descrição no formato `Embalagem Combo 05 un - <nome da peça>`.
  O PDF escreve o sufixo de três jeitos — `.C05`, `.C5` e `.05` são o mesmo
  pacote de cinco; a referência gravada padroniza em `.C05`.
- Variante preenchida só quando o preço muda por cor.
- **Código com duas letras** (`5590G/L`, `7054A/F`) é peça que existe em duas
  versões, e as letras aparecem marcadas na ficha técnica: `(L)` fita de Led
  Cob, `(G)` soquete, `(E)` E-27, `(A)`berta / `(F)`echada.
  - **um preço** — as duas versões custam o mesmo: uma linha só, com a
    referência como está impressa.
  - **dois preços** — viram duas referências, `5590G` e `5590L`. A ordem das
    letras no código segue a ordem dos preços, e é por isso que a página 52
    imprime `L/G` e a 55 imprime `G/L`.
- Peça com duas versões de cúpula abre um nome cheio e, sob ele, dois
  sub-rótulos com código próprio. A descrição junta os dois:
  `Arandela Thomas Cup Cúpula Pequena` (`5985CP`).
- A página de **acessórios** (cabo, corrente, canopla, esfera de vidro) fica
  **fora da carga**: a numeração dela é independente da dos produtos e chega a
  repetir código — `6535` é o `Pendente Ballon M` da página 38 e também o tricô
  náutico vendido por metro.

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
| Metal Domado | julho/2026 | 989, sendo 772 base + 217 combos (77 páginas) |

Divergência não significa erro automático — a fábrica pode ter incluído ou
retirado itens. Mas divergência grande sem explicação é sinal de extração
incompleta, e o diff contra o banco mostra exatamente quais linhas mudaram.

## A conferência que vale para catálogo em bloco

Contar produto num catálogo-álbum é discutível: uma peça com dois preços conta
como uma ou duas? A conferência que não depende de opinião é **uma linha por
preço impresso**. O extrator da Metal Domado fecha assim: 989 valores na coluna
de preço das páginas 1 a 77, 989 linhas no CSV. Sobra ou falta em alguma página
aponta o bloco exato para conferir no PDF.
