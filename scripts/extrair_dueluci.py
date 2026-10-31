# -*- coding: utf-8 -*-
"""
Extrai a tabela de precos da Due Luci para o CSV de carga.

Uso:
    python scripts/extrair_dueluci.py tabelas/dueluci-2026-3.pdf csv/dueluci-2026-3.csv

A Due Luci publica uma grade de verdade — 5 colunas, linhas fechadas por
regua —, mas cada linha da grade descreve uma FAMILIA, nao um produto:

    +-------+----------+----------+------------------------------------+-----------+
    | foto  | familia  | codigos  | descricao / ficha / sub-rotulos    | precos    |
    +-------+----------+----------+------------------------------------+-----------+
    |       | PIX      | 386DCU   | Arandela Articulada Direita        | R$ 256,00 |
    |       | DIREITA  | 386DCA   | C31 x P28 x A24cm - Cupula ...     | R$ 256,00 |
    |       | E27      | 386DRA   | LED: 1 x E27 Bolinha Nao Inclusa   | R$ 271,00 |
    |       |          |          | Interruptor na Cupula              |           |
    |       |          |          | Interruptor na Canopla             |           |
    |       |          |          | Interruptor no Rabicho             |           |
    +-------+----------+----------+------------------------------------+-----------+

Sao tres codigos, tres precos e tres sub-rotulos: tres produtos, iguais em
tudo menos onde fica o interruptor. O sub-rotulo e a variante.

Duas decisoes carregam este extrator.

**A celula se le caractere por caractere, nunca por extract_tables().** O PDF
alinha cada linha preenchendo o resto dela com centenas de espacos, e esses
espacos invadem a coluna vizinha. O codigo '2314B' da pagina 17 fica na
altura 128,9 e se estende ate x=395, dentro da coluna de descricao, onde a
129,7 esta 'Pendente Vidro Bco'. Como o pdfplumber junta tudo que esteja a
menos de 3 pontos na vertical e depois ordena por x, os espacos de uma linha
se intercalam com as letras da outra e a celula sai 'P e n d e n t e V i d r
o'. Eram 390 linhas assim — 15% da tabela, precos inclusive. Lendo os chars,
agrupando por altura com tolerancia apertada e descartando o que for so
espaco, nao sobra nenhuma: o texto do PDF sempre esteve intacto.

**Codigo e preco se pareiam pela ORDEM; o sub-rotulo, pela semelhanca.** A
altura nao serve de guia aqui, por mais que pareca servir: medindo as
celulas, a coluna de descricao e encostada no topo e as de codigo e de preco
sao centralizadas, e cada uma tem o seu proprio espacamento entre linhas —
11,2pt nos codigos e 10,1pt na descricao. Dois blocos que comecam em alturas
diferentes e andam em passos diferentes nunca ficam alinhados: na pagina 4 o
codigo '449E' esta 4,3pt ACIMA do paragrafo errado e 5,8pt ABAIXO do certo.
O que de fato vale e que codigo e preco tem a mesma contagem e o mesmo
passo, entao casam na ordem em que estao impressos.

Para o sub-rotulo sobra a semelhanca, e ela e um bom guia justamente porque
rotulo e rotulo de irmao se parecem: 'Interruptor na Cupula' / 'na Canopla' /
'no Rabicho', ou '1 x O18 - 1 x E27' / '3 x O18 - 3 x E27'. A regra e pegar
os N ULTIMOS paragrafos, e so abrir mao disso quando outra janela de N
paragrafos consecutivos for nitidamente mais parecida consigo mesma. E o que
salva as pecas 410 a 413 da pagina 3, em que a ultima linha ('Acompanha 4m
de Cabo PP...') e nota comum aos tres codigos e os rotulos ficam no meio. O
relatorio lista toda linha em que a excecao disparou.

Dai sai a leitura de cada linha da grade:

  - o rotulo de cada codigo vira a variante dele
  - o que sobra antes dos rotulos: o primeiro paragrafo e o nome do produto
    e os demais sao ficha tecnica (campo `detalhes`)
  - o que sobra depois dos rotulos e ficha tecnica tambem
  - se os rotulos ocupam a descricao inteira, nao ha nome comum: o rotulo de
    cada codigo E o nome dele e a variante fica vazia. E o caso da BOLA 10,
    em que 'Pendente Vidro Bco' e 'Pendente Vidro Cristal' sao dois produtos,
    nao duas variantes de um
  - codigo unico nao tem variante: com um codigo so nao existe irmao para
    distinguir, e o que vem depois do nome e ficha

A conferencia que fecha esta extracao e uma linha por preco impresso, e ela
roda ao fim de toda extracao, pagina por pagina.
"""
import sys, csv, re, unicodedata

import pdfplumber

# ST em todas as pecas, aliquota unica: o rodape da pagina 20 diz "Sem IPI,
# Substituicao Tributaria conforme estado". Mesma regra da Metal Domado.
IMPOSTO = '16.60'

PRECO = re.compile(r'R\s*\$\s*([\d.]+,\d\d)')

# Duas alturas pertencem ao mesmo paragrafo se diferirem menos que isto. O
# espacamento entre paragrafos e de ~10pt na descricao e ~11pt no codigo, e o
# desencontro dentro de um mesmo paragrafo nao passa de 1pt.
TOL_PARAGRAFO = 2.0

# Dentro de um paragrafo, o vao que vale por espaco, como fracao do corpo da
# fonte. O glifo de espaco mede 0,23 do corpo e o vao entre letras da mesma
# palavra fica em 0,01: 0,12 passa no meio dos dois.
RAZAO_ESPACO = 0.12

# Quanto a janela candidata precisa ser mais parecida consigo mesma que a dos
# ultimos N paragrafos para tomar o lugar dela. Abaixo disso a diferenca e
# ruido de texto e o padrao prevalece.
MARGEM_ROTULO = 0.10

# Produto da Due Luci tem codigo comecando por digito ('386DCU', '400-P',
# '4233', '811/5'). A pagina 20 termina em ACESSORIOS, e ali a grade troca de
# sentido: o codigo (61, 62P, 63) vai para a coluna da familia e o nome
# ('DESLOCADOR', 'CABO PP') para a coluna do codigo, com o cabo cotado por
# metro, por rolo e por fracao — tres precos para um item. Nao e produto de
# orcamento e fica fora da carga, como a pagina de acessorios da Metal
# Domado. O relatorio lista o que ficou de fora.
CODIGO = re.compile(r'^\d')


def limpar(txt):
    """normaliza espacos; preserva acentuacao e caixa"""
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', txt)).strip()


def paragrafos(chars, celula):
    """
    Le a celula direto dos caracteres e devolve [(altura, texto), ...].

    Descarta espaco antes de agrupar — e o espaco de preenchimento da linha
    vizinha que embaralhava a celula — e recompoe o vao entre palavras pela
    distancia horizontal.
    """
    if celula is None:
        return []
    x0, topo, x1, base = celula
    dentro = [c for c in chars
              if c['x0'] >= x0 - 0.5 and c['x1'] <= x1 + 0.5
              and c['top'] >= topo - 0.5 and c['bottom'] <= base + 0.5
              and c['text'].strip()]

    grupos, atual, altura = [], [], None
    for c in sorted(dentro, key=lambda c: (c['top'], c['x0'])):
        if altura is None:
            altura = c['top']
        elif c['top'] - altura > TOL_PARAGRAFO:
            grupos.append((altura, atual))
            atual, altura = [], c['top']
        atual.append(c)
    if atual:
        grupos.append((altura, atual))

    saida = []
    for altura, grupo in grupos:
        grupo = sorted(grupo, key=lambda c: c['x0'])
        texto = grupo[0]['text']
        for antes, c in zip(grupo, grupo[1:]):
            if c['x0'] - antes['x1'] > RAZAO_ESPACO * antes['size']:
                texto += ' '
            texto += c['text']
        texto = limpar(texto)
        if texto:
            saida.append((altura, texto))
    return saida


def parecenca(a, b):
    """o quanto dois textos se parecem, de 0 a 1: prefixo + sufixo em comum"""
    limite = min(len(a), len(b))
    prefixo = 0
    while prefixo < limite and a[prefixo] == b[prefixo]:
        prefixo += 1
    sufixo = 0
    while sufixo < limite - prefixo and a[-1 - sufixo] == b[-1 - sufixo]:
        sufixo += 1
    return (prefixo + sufixo) / float(max(len(a), len(b)))


def janela_de_rotulos(descricao, n):
    """
    Onde comecam os N sub-rotulos dentro da descricao.

    Padrao: os N ultimos paragrafos. Outra janela so toma o lugar se for
    MARGEM_ROTULO mais parecida consigo mesma — rotulos de irmaos se parecem,
    e e isso que distingue um rotulo de uma nota comum a todos. Devolve
    (inicio, cedeu_o_padrao).
    """
    padrao = len(descricao) - n
    if n < 2 or padrao < 0:
        return padrao, False

    def nota(inicio):
        janela = descricao[inicio:inicio + n]
        pares = [parecenca(janela[a], janela[b])
                 for a in range(n) for b in range(a + 1, n)]
        return sum(pares) / len(pares)

    nota_padrao = nota(padrao)
    melhor = max(range(padrao + 1), key=nota)
    if melhor != padrao and nota(melhor) - nota_padrao > MARGEM_ROTULO:
        return melhor, True
    return padrao, False


def ler_linha(celulas, n_pagina, anomalias, fora, cederam, balanco):
    """uma linha da grade -> os produtos dela"""
    familia, codigos, descricao, precos = (celulas[1], celulas[2],
                                           celulas[3], celulas[4])
    codigos = [t for _, t in sorted(codigos)]
    descricao = [t for _, t in sorted(descricao)]
    valores = [v for _, texto in sorted(precos) for v in PRECO.findall(texto)]
    if not codigos and not valores:
        return []

    nome_familia = ' '.join(t for _, t in sorted(familia))
    if not codigos:
        anomalias.append((n_pagina, 'preco sem codigo: %s (%s)'
                          % ('/'.join(valores), nome_familia)))
        return []
    if not all(CODIGO.match(t) for t in codigos):
        fora.append((n_pagina, '/'.join(codigos),
                     descricao[0] if descricao else ''))
        balanco.setdefault(n_pagina, [0, 0, 0])[0] += len(valores)
        return []
    if not descricao:
        anomalias.append((n_pagina, 'sem descricao: %s' % '/'.join(codigos)))
        return []

    # codigo e preco casam na ordem. Quando a familia inteira sai por um
    # preco so, a fabrica imprime um valor para todos — confirmado com o
    # representante.
    if len(valores) == len(codigos):
        precos_por_codigo = valores
    elif len(valores) == 1:
        precos_por_codigo = valores * len(codigos)
        balanco.setdefault(n_pagina, [0, 0, 0])[1] += len(codigos) - 1
    else:
        anomalias.append((n_pagina, '%d codigos x %d precos: %s'
                          % (len(codigos), len(valores), '/'.join(codigos))))
        return []

    um_codigo = len(codigos) == 1
    if um_codigo:
        # sem irmao nao existe variante: o nome e a primeira linha, o resto e ficha
        rotulos = [None]
        nome, ficha = descricao[0], descricao[1:]
    else:
        inicio, cedeu = janela_de_rotulos(descricao, len(codigos))
        if inicio < 0:
            anomalias.append((n_pagina, '%d codigos para %d linhas de'
                              ' descricao: %s' % (len(codigos), len(descricao),
                                                  '/'.join(codigos))))
            return []
        if cedeu:
            cederam.append((n_pagina, '/'.join(codigos), descricao,
                            inicio, len(codigos)))
        rotulos = descricao[inicio:inicio + len(codigos)]
        antes, depois = descricao[:inicio], descricao[inicio + len(codigos):]
        if antes:
            nome, ficha = antes[0], antes[1:] + depois
        else:
            # os rotulos ocupam tudo: cada codigo traz o proprio nome
            nome, ficha = None, depois

    linhas = []
    for codigo, preco, rotulo in zip(codigos, precos_por_codigo, rotulos):
        if nome is None:
            texto_descricao, variante = rotulo, ''
        else:
            texto_descricao, variante = nome, (rotulo or '')
        if nome_familia:
            texto_descricao = '%s - %s' % (nome_familia, texto_descricao)

        linhas.append({
            'referencia': codigo,
            'variante': variante,
            'descricao': texto_descricao,
            'detalhes': '\n'.join(ficha),
            'preco_unitario': preco.replace('.', '').replace(',', '.'),
            'porcentagem_imposto': IMPOSTO,
            'pagina': n_pagina,
        })
    return linhas


def extrair(caminho_pdf):
    produtos, anomalias, fora, cederam, balanco = [], [], [], [], {}
    impressos = {}
    with pdfplumber.open(caminho_pdf) as pdf:
        for n, pagina in enumerate(pdf.pages, start=1):
            chars = pagina.chars
            for tabela in pagina.find_tables():
                for linha in tabela.rows:
                    celulas = [paragrafos(chars, c) for c in linha.cells]
                    if len(celulas) != 5:
                        anomalias.append((n, 'linha de grade com %d colunas'
                                          % len(celulas)))
                        continue
                    impressos[n] = impressos.get(n, 0) + sum(
                        len(PRECO.findall(t)) for _, t in celulas[4])
                    produtos += ler_linha(celulas, n, anomalias, fora,
                                          cederam, balanco)
    return produtos, anomalias, fora, cederam, impressos, balanco


def resolver_repetidos(produtos, balanco):
    """
    Tira do CSV a chave (referencia, variante) repetida, que o carregar.py
    recusa — e recusa o arquivo inteiro, nao so a linha.

    Na tabela 2026/3 a pagina 18 imprime a mesma peca duas vezes: dois
    quadros com a mesma foto, o mesmo 2503, a mesma descricao e os mesmos
    R$ 189,00. Repeticao identica nao tem informacao a perder, entao fica a
    primeira e o relatorio so conta quantas foram. Ja o mesmo codigo em pecas
    diferentes e erro da fabrica, e esse sai apontado: quem resolve e a Due
    Luci.
    """
    vistos, saida, conflitos, identicas = {}, [], [], 0

    for p in produtos:
        chave = (p['referencia'], p['variante'])
        antes = vistos.get(chave)
        if antes is None:
            vistos[chave] = p
            saida.append(p)
        elif (antes['preco_unitario'] == p['preco_unitario']
              and antes['descricao'] == p['descricao']):
            identicas += 1
            balanco.setdefault(p['pagina'], [0, 0, 0])[2] += 1
        else:
            conflitos.append((p['pagina'], p['referencia'],
                              antes['descricao'], antes['preco_unitario'],
                              p['descricao'], p['preco_unitario']))

    return saida, conflitos, identicas


def conferir(produtos, impressos, balanco):
    """
    A conferencia que vale: uma linha do CSV por preco impresso na grade.

    Duas diferencas sao esperadas e entram na conta em vez de virar ruido:
    preco que ficou de fora junto com os acessorios, linha a mais de cada
    familia que a fabrica cotou por um preco so, e quadro que o catalogo
    imprimiu duas vezes. Devolve, por pagina, (impressos, fora, a_mais,
    repetidas, linhas, fecha).
    """
    do_csv = {}
    for p in produtos:
        do_csv[p['pagina']] = do_csv.get(p['pagina'], 0) + 1

    saldo = []
    for n in sorted(impressos):
        de_fora, a_mais, repetidas = balanco.get(n, [0, 0, 0])
        linhas = do_csv.get(n, 0)
        previsto = impressos[n] - de_fora + a_mais - repetidas
        saldo.append((n, impressos[n], de_fora, a_mais, repetidas, linhas,
                      previsto == linhas))
    return saldo


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    entrada, saida = sys.argv[1], sys.argv[2]

    produtos, anomalias, fora, cederam, impressos, balanco = extrair(entrada)
    produtos, conflitos, identicas = resolver_repetidos(produtos, balanco)

    campos = ['referencia', 'variante', 'descricao', 'detalhes',
              'preco_unitario', 'porcentagem_imposto', 'pagina']
    with open(saida, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=campos, delimiter=';')
        w.writeheader()
        w.writerows(produtos)

    variantes = [p for p in produtos if p['variante']]
    zerados = [p for p in produtos if float(p['preco_unitario']) == 0]

    print('linhas extraidas    : %d' % len(produtos))
    print('  referencias       : %d' % len({p['referencia'] for p in produtos}))
    print('  com variante      : %d' % len(variantes))
    print('  com ficha tecnica : %d' % sum(1 for p in produtos if p['detalhes']))
    print('preco zero          : %d' % len(zerados))
    print('quadro repetido     : %d' % identicas)
    print('paginas com produto : %d' % len({p['pagina'] for p in produtos}))
    print('arquivo             : %s' % saida)

    saldo = conferir(produtos, impressos, balanco)
    print('')
    print('UMA LINHA POR PRECO IMPRESSO')
    print('  precos impressos na grade    : %d' % sum(s[1] for s in saldo))
    print('  menos os dos acessorios      : %d' % sum(s[2] for s in saldo))
    print('  mais a familia de preco unico: %d' % sum(s[3] for s in saldo))
    print('  menos o quadro repetido      : %d' % sum(s[4] for s in saldo))
    print('  = linhas no CSV              : %d' % sum(s[5] for s in saldo))
    falhas = [s for s in saldo if not s[6]]
    if falhas:
        print('  NAO FECHA em %d pagina(s):' % len(falhas))
        for n, imp, de_fora, a_mais, repetidas, linhas, _ in falhas:
            print('    pag %-3d %d impresso(s) - %d + %d - %d != %d linha(s)'
                  % (n, imp, de_fora, a_mais, repetidas, linhas))
    else:
        print('  fecha em todas as %d paginas' % len(saldo))

    if conflitos:
        print('')
        print('CODIGO REPETIDO EM PECAS DIFERENTES (%d) — erro da fabrica,'
              ' e preciso confirmar com ela:' % len(conflitos))
        for pagina, ref, d1, p1, d2, p2 in conflitos:
            print('  pag %-3d | %s' % (pagina, ref))
            print('          ficou: %-38s R$ %s' % (d1[:38], p1))
            print('          saiu : %-38s R$ %s' % (d2[:38], p2))

    if cederam:
        print('')
        print('SUB-ROTULO FORA DO FIM (%d) — aqui os rotulos nao sao os'
              ' ultimos paragrafos; confira um a um:' % len(cederam))
        for pagina, codigos, descricao, inicio, quantos in cederam:
            print('  pag %-3d %s' % (pagina, codigos))
            for i, texto in enumerate(descricao):
                marca = 'rotulo' if inicio <= i < inicio + quantos else '      '
                print('          %s %s' % (marca, texto[:62]))

    if fora:
        print('')
        print('FORA DA CARGA (%d) — codigo que nao comeca com digito; na'
              ' pagina de acessorios a grade troca de sentido:' % len(fora))
        for pagina, codigo, descricao in fora:
            print('  pag %-3d %-18s %s' % (pagina, codigo, descricao[:46]))

    if anomalias:
        print('')
        print('linhas para conferencia manual (%d):' % len(anomalias))
        for pagina, texto in anomalias:
            print('  pag %-3d | %s' % (pagina, texto))


if __name__ == '__main__':
    main()
