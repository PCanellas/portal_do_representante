# -*- coding: utf-8 -*-
"""
Extrai a tabela de precos da Luminatti para o CSV de carga.

Uso:
    python scripts/extrair_luminatti.py tabelas/luminatti-julho2026.pdf csv/luminatti-julho2026.csv

A tabela tem 5 colunas de preco por regiao. Usamos Sul/MG/RJ, que e a
segunda delas. As faixas de x abaixo foram conferidas contra as
coordenadas do cabecalho do PDF.
"""
import sys, csv, re, unicodedata
from collections import OrderedDict

import pdfplumber

# faixas horizontais das colunas (conferidas no cabecalho da pagina 1)
X_DESCRICAO = (120, 555)
X_IPI       = (555, 588)
X_PRECO_RJ  = (612, 660)   # Sul/MG/RJ

# o catalogo tem duas linhas de produto: LM (principal) e OR (paginas finais)
COD = re.compile(r'^(LM|OR)\d{3,5}$')

# Produtos que o PDF imprime em coordenadas sobrepostas, saindo do extrator com
# os caracteres intercalados. Decifrados a mao a partir de
# 'LLMM33883312 LLUUMMIINNAARRIIAA ... PBTC//PBTC ...' (pagina 2).
# O script avisa quando encontra uma sobreposicao que nao esteja nesta lista.
CORRECOES = [
    ('LM3831', 'LUMINARIA DE LED 3 SPOTS DE EMBUTIR DIRECIONÁVEL 6W 3000K PT/PT '
               'DOT-LIGHT CONCENTRADO', '0.00', '0.00', 2),
    ('LM3832', 'LUMINARIA DE LED 3 SPOTS DE EMBUTIR DIRECIONÁVEL 6W 3000K BC/BC '
               'DOT-LIGHT CONCENTRADO', '0.00', '0.00', 2),
]
NUM = re.compile(r'^[\d.]*\d(,\d+)?$')   # aceita '43,20' e tambem '0'


def num(txt):
    """'1.755,84' -> Decimal-friendly '1755.84'"""
    return txt.replace('.', '').replace(',', '.')


def sobreposta(txt):
    """
    Detecta duas linhas impressas na mesma coordenada, que o extrator entrega
    com os caracteres intercalados ('LLMM33883312...'). Sao produtos reais que
    passariam despercebidos, entao precisam ser reportados.
    """
    limpo = txt.replace(' ', '')
    if len(limpo) < 20:
        return False
    pares = sum(1 for i in range(0, len(limpo) - 1, 2) if limpo[i] == limpo[i + 1])
    return pares / (len(limpo) / 2) > 0.6


def limpar(txt):
    """normaliza espacos; preserva acentuacao e caixa"""
    txt = unicodedata.normalize('NFC', txt)
    return re.sub(r'\s+', ' ', txt).strip()


def agrupar_linhas(pagina, tolerancia=3):
    """agrupa palavras da pagina em linhas pela coordenada vertical"""
    linhas = []
    for w in sorted(pagina.extract_words(), key=lambda w: (w['top'], w['x0'])):
        if linhas and abs(linhas[-1][0]['top'] - w['top']) <= tolerancia:
            linhas[-1].append(w)
        else:
            linhas.append([w])
    return linhas


def ler_linha(palavras):
    """devolve (codigo, descricao, ipi, preco) ou None se nao for produto"""
    codigo = descricao = ipi = preco = None
    partes = []
    for w in palavras:
        t, x = w['text'], w['x0']
        if COD.match(t) and x < X_DESCRICAO[0]:
            codigo = t
        elif X_DESCRICAO[0] <= x < X_DESCRICAO[1]:
            partes.append(t)
        elif X_IPI[0] <= x < X_IPI[1] and t.endswith('%'):
            ipi = num(t[:-1])
        elif X_PRECO_RJ[0] <= x < X_PRECO_RJ[1] and NUM.match(t):
            preco = num(t)
    descricao = limpar(' '.join(partes))
    if codigo and ipi is not None and preco is not None:
        return codigo, descricao, ipi, preco
    return None


def extrair(caminho_pdf):
    produtos = OrderedDict()   # (referencia) -> linha; dedup por codigo
    anomalias = []
    duplicados = 0

    with pdfplumber.open(caminho_pdf) as pdf:
        for n_pagina, pagina in enumerate(pdf.pages, start=1):
            linhas = agrupar_linhas(pagina)
            for i, palavras in enumerate(linhas):
                lido = ler_linha(palavras)
                if not lido:
                    # linha com codigo mas sem casar tudo: registra para conferencia
                    texto = ' '.join(w['text'] for w in palavras)
                    if sobreposta(texto):
                        anomalias.append(
                            (n_pagina, 'LINHAS SOBREPOSTAS: ' + limpar(texto)[:110]))
                    elif re.search(r'\b(LM|OR)\d{3,5}', texto) and 'TABELA' not in texto:
                        anomalias.append((n_pagina, limpar(texto)[:120]))
                    continue

                codigo, descricao, ipi, preco = lido

                # alguns produtos trazem a descricao na linha imediatamente acima
                if not descricao and i > 0:
                    acima = ler_linha(linhas[i - 1])
                    if acima is None:
                        descricao = limpar(' '.join(
                            w['text'] for w in linhas[i - 1]
                            if X_DESCRICAO[0] <= w['x0'] < X_DESCRICAO[1]))

                if not descricao:
                    anomalias.append((n_pagina, '%s sem descricao' % codigo))
                    continue

                if codigo in produtos:
                    duplicados += 1
                    continue

                produtos[codigo] = {
                    'referencia': codigo,
                    'variante': '',
                    'descricao': descricao,
                    'preco_unitario': '%.2f' % float(preco),
                    'porcentagem_imposto': '%.2f' % float(ipi),
                    'pagina': n_pagina,
                }

    for ref, desc, preco, ipi, pagina in CORRECOES:
        if ref not in produtos:
            produtos[ref] = {
                'referencia': ref, 'variante': '', 'descricao': desc,
                'preco_unitario': preco, 'porcentagem_imposto': ipi,
                'pagina': pagina,
            }

    return list(produtos.values()), anomalias, duplicados


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    entrada, saida = sys.argv[1], sys.argv[2]

    produtos, anomalias, duplicados = extrair(entrada)

    campos = ['referencia', 'variante', 'descricao',
              'preco_unitario', 'porcentagem_imposto', 'pagina']
    with open(saida, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=campos, delimiter=';')
        w.writeheader()
        w.writerows(produtos)

    zerados = [p for p in produtos if float(p['preco_unitario']) == 0]
    paginas = {p['pagina'] for p in produtos}

    print('produtos extraidos : %d' % len(produtos))
    print('duplicados ignorados: %d' % duplicados)
    print('preco zero          : %d  (%s)'
          % (len(zerados), ', '.join(p['referencia'] for p in zerados)))
    print('paginas com produto : %d' % len(paginas))
    print('arquivo             : %s' % saida)

    if anomalias:
        print('\nlinhas para conferencia manual (%d):' % len(anomalias))
        for pagina, texto in anomalias:
            print('  pag %-3d | %s' % (pagina, texto))


if __name__ == '__main__':
    main()
