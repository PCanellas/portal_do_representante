# -*- coding: utf-8 -*-
"""
Extrai a tabela de precos da Metal Domado para o CSV de carga.

Uso:
    python scripts/extrair_metaldomado.py tabelas/metaldomado-julho2026.pdf csv/metaldomado-julho2026.csv

O catalogo nao e uma tabela: e um album. Cada produto ocupa um bloco com foto,
nome, ficha tecnica, codigo e preco espalhados em coordenadas proprias, e as
paginas nao usam a mesma escala — o mesmo texto aparece com 9,5pt numa pagina e
6,8pt em outra. Por isso nada aqui depende de tamanho de fonte absoluto: o que
identifica cada campo e a COLUNA, medida como fracao da largura da pagina.

    0.00 .. 0.24   foto e a tira decorativa lateral ("CATALOGO", "ILUMINE")
    0.24 .. 0.38   codigo
    0.38 .. 0.70   nome do produto e ficha tecnica
    0.70 .. 1.00   preco e o rotulo da variante

Estrutura de um bloco:
  - o nome do produto e sempre a primeira linha; ele e que delimita o bloco
  - a ficha tecnica vem logo abaixo e vai para o campo `detalhes`
  - um codigo base e, opcionalmente, codigos de combo (sufixo .C05, .C20, ...)
  - um preco, ou dois. Dois com rotulo no canto direito e acabamento, e o
    rotulo vira a variante; dois sem rotulo e peca em duas versoes de
    lampada, e o codigo traz as duas letras (ver DUAS_LAMPADAS).

A conferencia que fecha esta extracao e uma linha por preco impresso: 989
valores na coluna de preco, 989 linhas no CSV. Sobra ou falta numa pagina
aponta o bloco exato para conferir no PDF.
"""
import sys, csv, re, unicodedata

import pdfplumber

# fracoes da largura da pagina — ver o desenho das colunas no topo do arquivo
COL_CODIGO = (0.24, 0.38)
COL_MEIO = (0.38, 0.70)
COL_DIREITA = 0.70

# referencia: numero com as letras que vierem coladas ('9080', '5520GG',
# '6609C', '11304', '5590G/L') e o combo com sufixo proprio ('5522P.C05').
# A caixa da letra distingue produto ('6020D' direta, '6020i' indireta), entao
# ela e preservada. O numero do combo aparece de tres jeitos no PDF — '.C05',
# '.C5' e '.05' sao o mesmo pacote de cinco —, e a referencia gravada
# padroniza em '.C05'.
COD = re.compile(r'^\d{2,6}[A-Za-z]{0,3}(?:/[A-Za-z]{1,2})?(?:\.C?\d{1,3})?$')
VALOR = re.compile(r'^\d{1,3}(?:\.\d{3})*,\d{2}$')
COMBO = re.compile(r'\.C?(\d{1,3})$')

# ST em todas as pecas, aliquota unica — a fabrica nao varia por produto
IMPOSTO = '16.60'

# 79 a 81 sao cartela de cores e amostras de material. A 78 e a lista de
# acessorios (cabo, corrente, canopla), fora da carga por decisao do
# representante: a numeracao dela e independente da dos produtos e chega a
# repetir codigo — o 6535 e o "Pendente Ballon M" da pagina 38 e tambem o
# tricô nautico vendido por metro.
PAGINAS_SEM_PRODUTO = {78, 79, 80, 81}

# Linhas em ArialRounded que caem na coluna do meio e nao sao nome de produto:
# cabecalho da pagina e a legenda de aplicacao no rodape de cada bloco.
NAO_E_NOME = {'Descrição', 'Código', 'Preço', 'Foto do Produto', 'Foto'}
PREFIXO_NAO_E_NOME = ('Interna', 'Externa', 'Embalagem Combo')

# Textos do canto direito que acompanham o preco sem serem acabamento: nota de
# acrescimo, observacao de vidro. Viram variante se nao forem barrados aqui.
NAO_E_VARIANTE = ('RABICHO', 'ACRÉSCIMO', 'DE R$', 'VIDROS:', 'Informar')

# Peca que existe em duas versoes de lampada tem um codigo so no PDF, com as
# duas letras juntas ('5590G/L'), e dois precos empilhados sem rotulo nenhum.
# G e o soquete (G-9, GU-10); L e a fita de Led ja embutida. Sao 22 pecas.
# Viram duas referencias, '5590G' e '5590L', que e como se pede na fabrica —
# e a ordem das letras no codigo segue a ordem dos precos: e por isso que a
# pagina 52 imprime 'L/G' e a 55 imprime 'G/L'.
DUAS_LAMPADAS = re.compile(r'^(\d+)([A-Za-z]+)/([A-Za-z]+)$')


def limpar(txt):
    """normaliza espacos; preserva acentuacao e caixa"""
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', txt)).strip()


def num(txt):
    """'1.755,84' -> '1755.84'"""
    return txt.replace('.', '').replace(',', '.')


def agrupar(palavras, tolerancia=2.5, por_tamanho=False):
    """
    Junta palavras em linhas pela coordenada vertical.

    Com por_tamanho, so entram na mesma linha palavras do mesmo corpo. O nome do
    produto e a legenda "Interna Uma Cor" do bloco anterior as vezes dividem a
    mesma altura, e a legenda vem com as palavras espacadas de tal forma que
    elas se intercalam com as do nome — separar por corpo (9,5pt contra 5,5pt)
    e o unico criterio que os desembaralha.
    """
    linhas = []
    for w in sorted(palavras, key=lambda w: (w['top'], w['x0'])):
        cabe = (linhas and abs(linhas[-1][0]['top'] - w['top']) <= tolerancia
                and (not por_tamanho
                     or abs(linhas[-1][0]['size'] - w['size']) < 0.6))
        if cabe:
            linhas[-1].append(w)
        else:
            linhas.append([w])
    return [(L[0]['top'], limpar(' '.join(w['text'] for w in L)), L[0]['size'])
            for L in linhas]


def embaralhada(txt):
    """
    Duas linhas da ficha impressas na mesma altura saem com as palavras
    picadas e intercaladas ('Bas M e: a G t - e 9 r i a l 0 : 1 A l - u L m',
    pagina 76). Nao da para separar depois; o sinal e a quantidade de pedacos
    de uma letra so, que uma linha inteira normal quase nao tem.
    """
    pedacos = [t for t in txt.split() if t != '|']
    if len(pedacos) < 8:
        return False
    soltos = sum(1 for t in pedacos if len(t) == 1)
    return soltos / len(pedacos) > 0.45


def sobreposta(txt):
    """
    Duas linhas impressas na mesma coordenada saem do extrator com os caracteres
    intercalados ('IInntteerrnnaa'). O texto e irrecuperavel automaticamente,
    entao vira anomalia para conferencia no PDF.
    """
    limpo = txt.replace(' ', '')
    if len(limpo) < 12:
        return False
    pares = sum(1 for i in range(0, len(limpo) - 1, 2) if limpo[i] == limpo[i + 1])
    return pares / (len(limpo) / 2) > 0.6


def ler_pagina(pagina, n_pagina, anomalias):
    """devolve (nomes, codigos, precos, rotulos, ficha) — cada um (top, texto)"""
    largura = pagina.width
    palavras = pagina.extract_words(extra_attrs=['fontname', 'size'])

    def frac(w):
        return w['x0'] / largura

    def arredondado(w):
        return w['fontname'].endswith('ArialRoundedMTBold')

    codigos = [(w['top'], w['text']) for w in palavras
               if arredondado(w) and COD.match(w['text'])
               and COL_CODIGO[0] <= frac(w) < COL_CODIGO[1]]

    # Preco e todo valor na coluna da direita. Exigir o 'R$' ao lado seria mais
    # seguro, mas o PDF as vezes esquece dele (o combo 7638C.60, pagina 50) — e
    # ali nao ha outro numero nessa coluna com que confundir.
    precos = [(w['top'], num(w['text'])) for w in palavras
              if VALOR.match(w['text']) and frac(w) >= COL_DIREITA]

    candidatos = []
    for top, texto, corpo in agrupar(
            [w for w in palavras if arredondado(w)
             and COL_MEIO[0] <= frac(w) < COL_MEIO[1]], por_tamanho=True):
        if texto in NAO_E_NOME or texto.startswith(PREFIXO_NAO_E_NOME):
            continue
        if sobreposta(texto):
            anomalias.append((n_pagina, 'linhas sobrepostas: ' + texto[:70]))
            continue
        candidatos.append((top, texto, corpo))

    # O nome da linha ("LINHA LINÊ", "UGO NTZ") ocupa a mesma coluna do nome do
    # produto e some por ser bem maior: 19 a 24pt contra 7 a 10. Caixa alta nao
    # serve de criterio — ha produto batizado em caixa alta ("ARANDELA WALL
    # FOCO 1", pagina 47). A pagina traz sua propria escala, dai a mediana.
    #
    # Abaixo da mediana vem o sub-rotulo: uma peca que se vende em duas versoes
    # abre um nome cheio e, sob ele, duas variacoes com codigo proprio
    # ("Arandela Thomas Cup" + "Cúpula Pequena" / "Cúpula Grande", pagina 25).
    # Cada variacao e um produto, e o nome dela so faz sentido com o do pai.
    nomes = []
    if candidatos:
        corpos = sorted(c[2] for c in candidatos)
        mediana = corpos[len(corpos) // 2]
        pai = ''
        for top, texto, corpo in candidatos:
            if corpo > mediana * 1.35:
                continue
            if corpo < mediana * 0.95 and pai:
                nomes.append((top, '%s %s' % (pai, texto), True))
            else:
                pai = texto
                nomes.append((top, texto, False))

    # A coluna da direita e agrupada com tolerancia apertada: o rotulo de uma
    # peca e o da peca seguinte chegam a dividir a mesma altura com 0,3pt de
    # diferenca (pagina 8), e juntos formariam uma variante que nao existe.
    rotulos = []
    for top, texto, _ in agrupar(
            [w for w in palavras if frac(w) >= COL_DIREITA], tolerancia=0.3):
        if any(t in texto for t in NAO_E_VARIANTE):
            continue
        if not re.sub(r'(?:R\$)?\s*[\d.,]+', '', texto).strip():
            continue                       # e o preco, nao rotulo dele
        if 'LAMPADA' in texto.upper():
            rotulos.append((top, 'Com lâmpada'))
        elif texto.upper() != 'PREÇO':
            rotulos.append((top, texto))

    # A ficha tecnica (medida, lampada, material, cartela de cores) sai em
    # Calibri na coluna do meio. Vai para o campo `detalhes` do produto — nao
    # para a descricao, que e so o nome da peca.
    ficha = []
    for top, texto, _ in agrupar([w for w in palavras if not arredondado(w)
                                  and COL_MEIO[0] <= frac(w) < COL_MEIO[1]]):
        if texto.startswith(PREFIXO_NAO_E_NOME) or embaralhada(texto):
            continue
        ficha.append((top, texto))

    return nomes, codigos, precos, rotulos, ficha


def extrair_blocos(pagina, n_pagina, anomalias, anterior):
    """
    Um bloco por nome de produto. Devolve (linhas do CSV, ultimo produto), com
    o ultimo servindo de contexto para a pagina seguinte: os combos de uma peca
    as vezes viram a pagina sem ela (o 536.C60 abre a pagina 48, e a peca 536
    fica na 47).
    """
    nomes, codigos, precos, rotulos, ficha = ler_pagina(
        pagina, n_pagina, anomalias)
    if not nomes:
        if codigos or precos:
            anomalias.append((n_pagina, 'pagina com codigo/preco e sem nome'))
        return [], anterior

    nomes.sort()
    herdar = None
    ficha_da_peca = ''
    if anterior and any(t < nomes[0][0] - 3 for t, _ in codigos):
        herdar, nome_anterior, ficha_da_peca = anterior
        nomes.insert(0, (0.0, nome_anterior, True))

    limites = [t for t, _, _ in nomes] + [pagina.height + 1]
    linhas = []
    ultimo = anterior

    for i, (topo, nome, sub) in enumerate(nomes):
        # a margem de 3pt absorve o desalinhamento entre o nome e o rotulo da
        # variante, impressos na mesma altura mas nao no mesmo baseline
        ini, fim = topo - 3, limites[i + 1] - 3
        no_bloco = lambda seq: [x for x in seq if ini <= x[0] < fim]

        cods = sorted(no_bloco(codigos))
        precs = sorted(no_bloco(precos))
        rots = sorted(no_bloco(rotulos))
        # A peca com duas cupulas tem a ficha impressa uma vez so, no bloco da
        # primeira: a segunda e uma linha solta com codigo e preco. Sub-rotulo
        # sem ficha herda a da peca; produto de nome proprio, nao — a pagina 71
        # tem spot GU-10 que o PDF publica sem ficha nenhuma, e copiar a do
        # vizinho seria inventar medida.
        detalhes = '\n'.join(x for _, x in sorted(no_bloco(ficha)))
        if detalhes:
            ficha_da_peca = detalhes
        elif sub:
            detalhes = ficha_da_peca

        base = [c for c in cods if not COMBO.search(c[1])]
        combos = [c for c in cods if COMBO.search(c[1])]

        if base:
            referencia = base[0][1]
            if len(base) > 1:
                anomalias.append((n_pagina, '%s: %d codigos base (%s)'
                                  % (nome, len(base),
                                     ', '.join(c[1] for c in base))))
        elif i == 0 and herdar:
            referencia = herdar
        else:
            # bloco vazio nao e produto perdido: e o nome cheio que precede um
            # sub-rotulo, ou a legenda de rodape que saiu com as letras
            # embaralhadas por sobreposicao de linhas
            if precs:
                anomalias.append((n_pagina, '%s: sem codigo' % nome))
            continue
        ultimo = (referencia, nome, detalhes)

        # combo: codigo e preco saem impressos na mesma linha
        precos_combo = {}
        for topo_c, cod in combos:
            perto = [p for p in precs if abs(p[0] - topo_c) <= 6]
            if not perto:
                anomalias.append((n_pagina, '%s: combo sem preco' % cod))
                continue
            precos_combo[cod] = min(perto, key=lambda p: abs(p[0] - topo_c))

        usados = set(id(p) for p in precos_combo.values())
        precos_base = [p for p in precs if id(p) not in usados]

        # a peca continuada ja foi gravada na pagina anterior; aqui so sobram
        # os combos dela
        continuacao = i == 0 and herdar is not None and not base
        if continuacao:
            if precos_base:
                anomalias.append((n_pagina, '%s: preco solto no topo da pagina'
                                  % referencia))
            precos_base = []
        elif not precos_base:
            anomalias.append((n_pagina, '%s (%s): sem preco' % (nome, referencia)))
            continue

        # Cada rotulo procura o preco mais proximo — na pagina 7 ele vem acima
        # do preco, na 76 vem abaixo —, e nunca rouba um preco ja rotulado. O
        # ultimo bloco da pagina costuma pegar emprestado o rotulo do primeiro
        # bloco da pagina seguinte; sem essa trava ele sobrescreveria um par
        # certo. Preco sem rotulo fica sem variante.
        variante = {id(p): '' for p in precos_base}
        livres = list(precos_base)
        for topo_r, texto in rots:
            if not livres:
                break
            alvo = min(livres, key=lambda p: abs(p[0] - topo_r))
            variante[id(alvo)] = texto
            livres.remove(alvo)

        # so um dos precos leva "Com lâmpada"; o outro e a peca sem ela, e dizer
        # isso e melhor do que deixar o campo vazio ao lado do que diz
        if any(v == 'Com lâmpada' for v in variante.values()):
            for p in precos_base:
                variante[id(p)] = variante[id(p)] or 'Sem lâmpada'

        duas = DUAS_LAMPADAS.match(referencia)
        if duas and len(precos_base) == 2:
            numero, primeira, segunda = duas.groups()
            referencias = [numero + primeira, numero + segunda]
        else:
            referencias = [referencia] * len(precos_base)
            if len(precos_base) > 1 and not rots:
                anomalias.append((n_pagina, '%s (%s): %d precos e nenhum rotulo'
                                  % (nome, referencia, len(precos_base))))

        for ref_linha, p in zip(referencias, precos_base):
            linhas.append({
                'referencia': ref_linha,
                'variante': variante[id(p)],
                'descricao': nome,
                'detalhes': detalhes,
                'preco_unitario': '%.2f' % float(p[1]),
                'porcentagem_imposto': IMPOSTO,
                'pagina': n_pagina,
            })

        for cod, (_, preco) in precos_combo.items():
            qtd = '%02d' % int(COMBO.search(cod).group(1))
            # o combo repete a referencia da peca, as vezes sem o sufixo de
            # acabamento ('5361.C20' para a peca '5361G/L'); vale a que o PDF
            # imprime na linha do combo, que e a que se usa no pedido
            prefixo = cod.split('.')[0]
            if not referencia.startswith(prefixo):
                anomalias.append((n_pagina, '%s: combo de outra peca (%s)'
                                  % (cod, referencia)))
            linhas.append({
                'referencia': '%s.C%s' % (prefixo, qtd),
                'variante': '',
                'descricao': 'Embalagem Combo %s un - %s' % (qtd, nome),
                # o combo e a mesma peca em pacote fechado: mesma ficha
                'detalhes': detalhes,
                'preco_unitario': '%.2f' % float(preco),
                'porcentagem_imposto': IMPOSTO,
                'pagina': n_pagina,
            })

    return linhas, ultimo


def extrair(caminho_pdf):
    produtos, anomalias = [], []
    anterior = None
    with pdfplumber.open(caminho_pdf) as pdf:
        for n, pagina in enumerate(pdf.pages, start=1):
            if n in PAGINAS_SEM_PRODUTO:
                continue
            linhas, anterior = extrair_blocos(pagina, n, anomalias, anterior)
            produtos += linhas
    return produtos, anomalias


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    entrada, saida = sys.argv[1], sys.argv[2]

    produtos, anomalias = extrair(entrada)

    campos = ['referencia', 'variante', 'descricao', 'detalhes',
              'preco_unitario', 'porcentagem_imposto', 'pagina']
    with open(saida, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=campos, delimiter=';')
        w.writeheader()
        w.writerows(produtos)

    combos = [p for p in produtos if COMBO.search(p['referencia'])]
    variantes = [p for p in produtos if p['variante']]
    zerados = [p for p in produtos if float(p['preco_unitario']) == 0]
    repetidos = len(produtos) - len({(p['referencia'], p['variante'])
                                     for p in produtos})

    print('linhas extraidas    : %d' % len(produtos))
    print('  produtos base     : %d' % (len(produtos) - len(combos)))
    print('  combos            : %d' % len(combos))
    print('  com variante      : %d' % len(variantes))
    print('  com ficha tecnica : %d' % sum(1 for p in produtos if p['detalhes']))
    print('preco zero          : %d' % len(zerados))
    print('chaves repetidas    : %d' % repetidos)
    print('paginas com produto : %d' % len({p['pagina'] for p in produtos}))
    print('arquivo             : %s' % saida)

    if anomalias:
        print('\nlinhas para conferencia manual (%d):' % len(anomalias))
        for pagina, texto in anomalias:
            print('  pag %-3d | %s' % (pagina, texto))


if __name__ == '__main__':
    main()
