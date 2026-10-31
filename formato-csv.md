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
- **Código errado no PDF se corrige no extrator, nunca no CSV** — a
  reextração seguinte desfaria a edição à mão. O dicionário `CORRECOES` do
  `extrair_metaldomado.py` guarda o par impresso (código, nome da peça) e a
  referência que vale no pedido, e só entra ali o que o representante
  confirmou. Em outubro/2026 a página 3 imprime `9082` em duas peças e pula o
  `9084`: o `Pendente Linê Vertical M` é `9083` e o `Pendente Linê Vertical
  G`, impresso `9083`, é `9084` — com a troca a sequência fecha de 9077 a
  9088. Correção que não acha peça aparece no relatório: ou a peça não está
  naquela tabela, ou a fábrica já arrumou e a entrada pode sair.
- A página de **acessórios** (cabo, corrente, canopla, esfera de vidro) fica
  **fora da carga**: a numeração dela é independente da dos produtos e chega a
  repetir código — `6535` é o `Pendente Ballon M` da página 38 e também o tricô
  náutico vendido por metro.

### DNA
- **Duas tabelas, um catálogo.** A DNA publica a geral e a de showroom em PDFs
  separados, e boa parte se repete: 104 códigos aparecem nos dois, com preço,
  folha de ouro e descrição idênticos. O extrator recebe os dois na mesma
  chamada, e onde repete **o primeiro vence**.
- **Página deslocada.** As páginas do segundo PDF continuam a numeração do
  primeiro (o showroom de 7 páginas vira 43-49). Sem isso as páginas 1-7 dos
  dois colidiriam e a checagem de buraco na sequência perderia o sentido.
  Consequência esperada: as páginas cujos produtos todos já vieram do primeiro
  PDF ficam sem nenhuma linha, e a carga avisa. Nas cargas de agosto/2026 são
  as 46 e 47 — conferido uma a uma.
- Imposto: **IPI por produto**, 9,75% em todas as linhas menos uma. A `P0501`
  vem com a célula vazia nos dois PDFs, e entra com 9,75% — omissão da fábrica,
  não alíquota zero.
- A coluna **ST** do PDF diz "Verificar índice da região". É nota, não
  alíquota: quem vale é o IPI.
- Referência: **sem formato único** — `A0209`, `ARA-003-ROCHA`,
  `ALQU-50-1`, `GAROA-RT100X60-2,0M`, `ESPECIAL-L1003-4`. O extrator copia a
  célula de código como está, sem validar por padrão.
- **Folha de ouro vira variante `FOLHA DE OURO`**, e só quando o preço dela
  está **impresso**: 390 dos 542 produtos. Nos outros 152 a sexta coluna ou
  não é folha de ouro (naquelas páginas ela é `OBS`) ou está vazia — a LINHA
  EISEN inteira é assim. **Não se calcula o que falta**: entre os preços
  impressos a folha de ouro é +15% em 382 casos, +0% em 6 e −30% em 1, então a
  regra não vale nem dentro do que a fábrica publicou, e um valor calculado
  entraria no PDF do cliente como se fosse preço de fábrica.
- `detalhes` recebe **só a nota da coluna `OBS`** ("ATÉ 2M DE CABO NÃO ALTERA
  VALOR"). Peso e acabamento ficam fora.
- **Página de continuação não repete o cabeçalho.** Sete páginas da geral
  (9, 17, 26, 32, 34, 36, 37) seguem a tabela da anterior sem cabeçalho
  nenhum. O papel da sexta coluna vale até o próximo cabeçalho, não até o fim
  da página — tratar por página descartava 120 produtos em silêncio.
- **As dez colunas são lidas por posição, nunca por nome.** Na página 4 dos
  dois PDFs o cabeçalho da coluna de descrição vem impresso "CÓDIGO DO
  PRODUTO"; mapear por nome faz o código daquelas linhas virar a descrição.

### Due Luci
- Imposto: **ST em todas as peças**, alíquota única de **16,60%** — mesma
  regra da Metal Domado. O rodapé da página 20 diz "Sem IPI, Substituição
  Tributária conforme estado".
- **Cada linha da grade é uma família, não um produto.** A célula de código
  traz N códigos, a de preço N preços e a de descrição N sub-rótulos, que
  são o que distingue um irmão do outro (`386DCU` interruptor na cúpula,
  `386DCA` na canopla, `386DRA` no rabicho). O sub-rótulo vira a variante.
- **A célula se lê caractere por caractere**, nunca pelo texto que o
  `extract_tables()` devolve. O PDF completa cada linha com centenas de
  espaços que invadem a coluna vizinha, e o agrupador do pdfplumber
  intercala esses espaços com as letras de baixo: 390 linhas — 15% da
  tabela, preços inclusive — saem como `P e n d e n t e V i d r o`. Lendo os
  caracteres e descartando o que for só espaço, não sobra nenhuma.
- **Código e preço casam pela ordem; o sub-rótulo, pela semelhança.** Alinhar
  por altura não funciona: a coluna de descrição é encostada no topo da
  célula e as de código e preço são centralizadas, cada uma com o seu
  espaçamento (11,2pt contra 10,1pt). O sub-rótulo sai dos **N últimos**
  parágrafos, e só cede quando outra janela de N consecutivos for
  nitidamente mais parecida consigo mesma — é o caso das peças 410 a 413 e
  das 810 a 817, em que a última linha ("Acompanha 4m de Cabo PP...") é
  nota comum a todos os códigos. São 12 linhas, e o relatório lista uma a
  uma para conferência.
- **A família entra como prefixo da descrição** (`PIX DIREITA E27 - Arandela
  Articulada Direita - Alumínio`). Ela está numa coluna própria e é o que
  distingue as dezenas de "Arandela Articulada" do catálogo; sem ela o nome
  no orçamento fica ambíguo. Em 46 das 514 linhas a família já aparece no
  nome e o prefixo repete — preço aceitável pelas outras 468.
- **Família cotada por um preço só** vira N referências pelo mesmo valor. São
  14 linhas da grade, 16 referências a mais que preços impressos.
- Quando os sub-rótulos ocupam a descrição inteira **não há nome comum**: o
  rótulo de cada código é o nome dele e a variante fica vazia. É a BOLA 10,
  em que `2314B` é "Pendente Vidro Bco" e `2314C` é "Pendente Vidro
  Cristal" — dois produtos, não duas variantes de um.
- **Código único não tem variante**: sem irmão não há o que distinguir, e o
  que vem depois do nome é ficha técnica.
- Referência: **sempre começa com dígito** — `386DCU`, `400-P`, `4233`,
  `811/5`, `2314B`. É o que separa produto de acessório.
- A parte de **acessórios** da página 20 (cabo PP, deslocador, trava cabo)
  fica **fora da carga**, como a da Metal Domado: ali a grade troca de
  sentido — o código (61, 62P, 63) vai para a coluna da família e o nome
  para a coluna do código — e o cabo é cotado por metro, por fração e por
  rolo, três preços para um item. São 5 quadros e 7 preços.
- **Quadro repetido idêntico sai em silêncio.** A página 18 imprime duas
  vezes o mesmo `2503`, com a mesma foto, a mesma descrição e os mesmos
  R$ 189,00. Código repetido em peças **diferentes** é outra coisa, e esse
  o relatório aponta.
## Exemplos

**Luminatti** (IPI por produto, preço da região escolhida):

```csv
referencia;variante;descricao;preco_unitario;porcentagem_imposto;pagina
LM3654;;LUMINARIA LED DE EMBUTIR DOT INFINITE 3 SPOTS 6W 2700K BC/BC;43.20;9.75;1
LM3829;;LUMINARIA DE LED 1 SPOT DE EMBUTIR DIRECIONÁVEL 2W 3000K PT/PT;0.00;0;2
LM3223;;PERFIL LIGHT MINI DE SOBREPOR, INTERNO ATÉ 5,7MM, BC/BC, TAM: 2M;14.70;0;22
```

**Metal Domado** (ST constante, variante quando o preço muda por cor). A
alíquota vai como **número**: a coluna é numérica e o carregador rejeita o CSV
inteiro se encontrar a sigla `ST` no lugar do valor.

```csv
referencia;variante;descricao;preco_unitario;porcentagem_imposto;pagina
9080;;Arandela Linê P;347.00;16.60;1
6609C;Travertino Bruto, Kouros e Verde Guatemala;Arandela Bolle Rock Axs M;924.95;16.60;7
6609C;Bronze Armani;Arandela Bolle Rock Axs M;1188.65;16.60;7
5522P;;Arandela Retrô Sextavada Pequena;637.61;16.60;21
5522P.C05;;Embalagem Combo 05 un - Arandela Retrô Sextavada Pequena;410.90;16.60;21
5522P.C10;;Embalagem Combo 10 un - Arandela Retrô Sextavada Pequena;367.90;16.60;21
```

**DNA** (folha de ouro como variante, só onde o preço está impresso):

```csv
referencia;variante;descricao;detalhes;preco_unitario;porcentagem_imposto;pagina
ARA-003-ROCHA;;ARANDELA 20CM - ROCHA SELENITA - FITA DE LED 3000K - 6W;;724.50;9.75;1
ARA-003-ROCHA;FOLHA DE OURO;ARANDELA 20CM - ROCHA SELENITA - FITA DE LED 3000K - 6W;;833.18;9.75;1
EISEN-001-ARA;;ARANDELA 20 X 20CM - 6W - CHAPA MARTELADA;;694.15;9.75;7
ALR-70-1-FIX;;ALIANÇA RED. Ø70 CM - 3000K - 28W (1,50M DE ALTURA) - FIX NO GESSO;ATÉ 2M DE CABO NÃO ALTERA VALOR;1746.14;9.75;28
```

A `EISEN-001-ARA` entra sem variante porque a célula de folha de ouro dela
está vazia no PDF — é o caso dos 152.

**Due Luci** (ST constante, sub-rótulo como variante, família no nome):

```csv
referencia;variante;descricao;detalhes;preco_unitario;porcentagem_imposto;pagina
386DCU;Interruptor na Cúpula;PIX DIREITA E27 - Arandela Articulada Direita - Alumínio;C31 x P28 x A24cm - Cúpula Ø5,3/Ø17 x A16cm;256.00;16.60;1
386DRA;Interruptor no Rabicho;PIX DIREITA E27 - Arandela Articulada Direita - Alumínio;C31 x P28 x A24cm - Cúpula Ø5,3/Ø17 x A16cm;271.00;16.60;1
2314B;;BOLA 10 - Pendente Vidro Bco Ø10 cm - 1 x G9 Led;;231.00;16.60;17
2314C;;BOLA 10 - Pendente Vidro Cristal Ø10 cm - 1 x G9 Led;;231.00;16.60;17
```

As duas BOLA saem pelo mesmo preço porque a página 17 imprime um valor só
para o par, e sem variante porque cada código tem o seu próprio nome.
## Contagens de referência

Servem para conferir a cobertura de cada extração:

| fabricante | tabela | produtos esperados |
|---|---|---|
| Luminatti | julho/2026 | 1.635 (44 páginas) |
| Luminatti | agosto/2026 | 1.718 (42 páginas) |
| Metal Domado | julho/2026 | 989, sendo 772 base + 217 combos (77 páginas) |
| Metal Domado | outubro/2026 | 779, sendo 589 base + 190 combos (61 páginas) |
| DNA | agosto/2026 | 932 linhas, sendo 542 base + 390 folha de ouro (42 + 7 páginas) |
| Due Luci | 2026/3 | 514 linhas, 514 referências, 177 com variante (20 páginas) |

A DNA fecha assim: **1.129 preços impressos** nos dois PDFs (646 base + 483
folha de ouro), menos **197 de códigos repetidos entre eles** (104 base + 93
folha de ouro), dão as 932 linhas. Cada linha do CSV foi conferida contra um
preço impresso — nenhuma sobra.

A Due Luci fecha assim: **506 preços impressos** na grade, menos **7 de
acessórios**, mais **16 de família cotada por um preço só**, menos **1
quadro repetido**, dão as 514 linhas. O extrator refaz essa conta página a
página a cada rodada e avisa em qual delas não fecha.
Divergência não significa erro automático — a fábrica pode ter incluído ou
retirado itens. Mas divergência grande sem explicação é sinal de extração
incompleta, e o diff contra o banco mostra exatamente quais linhas mudaram.

## A conferência que vale para catálogo em bloco

Contar produto num catálogo-álbum é discutível: uma peça com dois preços conta
como uma ou duas? A conferência que não depende de opinião é **uma linha por
preço impresso**. O extrator da Metal Domado fecha assim: 989 valores na coluna
de preço das páginas 1 a 77, 989 linhas no CSV. Sobra ou falta em alguma página
aponta o bloco exato para conferir no PDF.
