# -*- coding: utf-8 -*-
"""
Extrai a tabela de precos da DNA para o CSV de carga.

Uso:
    python scripts/extrair_dna.py tabelas/dna-geral-agosto2026.pdf \
                                  tabelas/dna-showroom-2026.pdf \
                                  csv/dna-agosto2026.csv

Recebe um ou mais PDFs e um CSV de saida. A ordem importa: o primeiro PDF
manda, e os seguintes entram so com o que for exclusivo deles.

Tres particularidades desta fabricante:

1. Sao DOIS PDFs que formam UMA tabela. 98 codigos aparecem nos dois, com
   preco, folha de ouro e descricao identicos — conferido linha a linha antes
   de escrever isto. Onde repete, o primeiro PDF vence e o segundo e ignorado.

2. A pagina de cada PDF seguinte e deslocada pelo total de paginas dos
   anteriores (o showroom de 7 paginas vira 43-49). A coluna `pagina` existe
   para o carregar.py achar buraco na sequencia e denunciar extracao fatiada;
   sem o deslocamento, as paginas 1-7 dos dois colidiriam e a trava perderia
   sentido.

3. Cada produto pode virar DUAS linhas: o preco base e a variante FOLHA DE
   OURO. A variante sai apenas quando o preco dela esta IMPRESSO — 291 dos
   428 produtos. Nos outros 137 a coluna ou nao existe (a sexta e OBS naquelas
   paginas) ou esta vazia, e calcular nao e opcao: entre os precos impressos a
   folha de ouro e +15% em 283 casos, +0% em 6 e -30% em 1. A regra nao vale
   nem dentro do que a fabrica publicou, entao um valor calculado seria
   invencao nossa indo para o PDF do cliente como preco de fabrica.

Diferente da Luminatti e da Metal Domado, aqui o PDF tem grade de verdade:
extract_tables() devolve celula por celula e ja resolve texto que ocupa varias
linhas. Nao ha faixa de coordenada para conferir contra o cabecalho.

As dez colunas sao lidas por POSICAO, nunca por nome. Na pagina 4 dos dois
arquivos o cabecalho da coluna de descricao vem impresso "CODIGO DO PRODUTO";
mapear por nome faz a chave duplicada sobrescrever e o codigo daquelas linhas
vira a descricao — errei exatamente assim no primeiro levantamento.
"""
import csv
import re
import sys
from collections import Counter, OrderedDict

import pdfplumber

# As dez colunas, na ordem em que o PDF as imprime.
IMAGEM, NOME, CODIGO, DESCRICAO, PRECO, SEXTA, PESO, ST, IPI, ACABAMENTO = range(10)
N_COLUNAS = 10

# A sexta coluna troca de papel entre paginas: numas e o preco da folha de
# ouro, noutras e um campo de observacao.
ROTULO_OURO = "FOLHA DE OURO"
ROTULO_OBS = "OBS"

# Marca do cabecalho. Aparece em toda pagina de produto e em nenhuma outra
# linha, entao serve para achar onde a tabela comeca.
MARCA_CABECALHO = "PREÇO S/ IMP."

VARIANTE_OURO = "FOLHA DE OURO"

# 524 das 526 linhas trazem 9,75%. A P0501 vem com a celula vazia nos dois
# PDFs — omissao da fabrica, nao aliquota zero.
IPI_PADRAO = "9.75"

# A fabrica escreve "-" onde nao ha observacao; vale o mesmo que vazio.
SEM_OBS = {"", "-", "--"}

PRECO_RE = re.compile(r"R\$\s*([\d.]+,\d{2})")
PERCENTUAL_RE = re.compile(r"([\d.,]+)\s*%")


def norm(celula):
    """Normaliza espaco preservando acento e caixa."""
    return " ".join((celula or "").split())


def ler_preco(txt):
    """'R$ 1.084,79' -> 1084.79. None quando nao ha preco na celula."""
    m = PRECO_RE.search(txt or "")
    if not m:
        return None
    return float(m.group(1).replace(".", "").replace(",", "."))


def ler_percentual(txt):
    """'9,75%' -> '9.75'. None quando a celula nao traz percentual."""
    m = PERCENTUAL_RE.search(txt or "")
    if not m:
        return None
    return m.group(1).replace(".", "").replace(",", ".")


def eh_secao(celulas):
    """Linha de titulo de linha/familia: uma celula preenchida e nada mais."""
    return len([c for c in celulas if c]) == 1


def extrair_pdf(caminho, deslocamento):
    """
    Devolve (produtos, anomalias, n_paginas, paginas_herdadas).

    produtos: lista de dicts na ordem em que aparecem no PDF.
    """
    produtos, anomalias = [], []
    paginas_herdadas = []

    # O papel da sexta coluna vale ATE O PROXIMO CABECALHO, e nao ate o fim da
    # pagina: a DNA nao repete o cabecalho em pagina de continuacao. Oito
    # paginas do geral (9, 17, 26, 32, 34, 36, 37) e uma do showroom seguem a
    # tabela da pagina anterior sem cabecalho nenhum, e reiniciar isto por
    # pagina fazia o extrator descartar 120 produtos em silencio. Foi a
    # conferencia de buraco na sequencia de paginas que denunciou.
    rotulo_sexta = None

    with pdfplumber.open(caminho) as pdf:
        n_paginas = len(pdf.pages)

        for n, pagina in enumerate(pdf.pages, start=1):
            numero = n + deslocamento
            viu_cabecalho = False
            produtos_antes = len(produtos)

            for tabela in pagina.extract_tables():
                for linha in tabela:
                    if len(linha) != N_COLUNAS:
                        continue

                    celulas = [norm(c) for c in linha]
                    juntas = " ".join(celulas).strip()
                    if not juntas:
                        continue

                    if MARCA_CABECALHO in juntas:
                        rotulo_sexta = celulas[SEXTA]
                        viu_cabecalho = True
                        continue

                    if eh_secao(celulas):
                        continue

                    # antes do primeiro cabecalho e capa e aviso, nao produto
                    if rotulo_sexta is None:
                        continue

                    codigo = celulas[CODIGO]
                    preco = ler_preco(celulas[PRECO])

                    if not codigo:
                        continue
                    if preco is None:
                        # tem codigo mas nao tem preco legivel: pode ser
                        # rodape ou linha partida, e precisa ser conferido
                        anomalias.append(
                            (numero, "sem preco legivel: %s | %s"
                             % (codigo[:28], celulas[DESCRICAO][:60])))
                        continue

                    descricao = celulas[DESCRICAO]
                    if not descricao:
                        anomalias.append(
                            (numero, "sem descricao: %s" % codigo[:28]))
                        continue

                    imposto = ler_percentual(celulas[IPI])
                    if imposto is None:
                        imposto = IPI_PADRAO
                        anomalias.append(
                            (numero, "IPI em branco, assumido %s%%: %s"
                             % (IPI_PADRAO, codigo[:28])))

                    e_ouro = ROTULO_OURO in rotulo_sexta.upper()
                    ouro = ler_preco(celulas[SEXTA]) if e_ouro else None

                    # detalhes recebe so a nota de OBS; peso e acabamento
                    # ficam fora por decisao de quem usa a tela
                    obs = "" if e_ouro else celulas[SEXTA]
                    detalhes = "" if obs in SEM_OBS else obs

                    if e_ouro and ouro is None:
                        anomalias.append(
                            (numero, "coluna de folha de ouro vazia: %s"
                             % codigo[:28]))

                    produtos.append({
                        "referencia": codigo,
                        "descricao": descricao,
                        "detalhes": detalhes,
                        "preco": preco,
                        "ouro": ouro,
                        "imposto": imposto,
                        "pagina": numero,
                    })

            if len(produtos) > produtos_antes and not viu_cabecalho:
                paginas_herdadas.append(numero)

    juntar_notas_partidas(produtos, anomalias)
    return produtos, anomalias, n_paginas, paginas_herdadas


def juntar_notas_partidas(produtos, anomalias):
    """
    Remonta observacao que a grade partiu entre duas linhas.

    A pagina 29 do geral traz uma nota que ocupa a altura de dois produtos:
    o extrator entrega 'SEM CANOPLA (FONTE EMBUTIDA' num e 'NO GESSO)' no
    seguinte, e sozinha nenhuma das duas metades quer dizer nada. Parentese
    aberto sem fechar e o sinal — junta as metades no produto onde a nota
    comecou e limpa a de baixo.
    """
    for i, p in enumerate(produtos[:-1]):
        nota = p["detalhes"]
        if not nota or nota.count("(") <= nota.count(")"):
            continue
        seguinte = produtos[i + 1]
        if not seguinte["detalhes"]:
            continue
        completa = "%s %s" % (nota, seguinte["detalhes"])
        anomalias.append(
            (p["pagina"], "nota partida remontada em %s: %r"
             % (p["referencia"], completa)))
        p["detalhes"] = completa
        seguinte["detalhes"] = ""


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)

    entradas, saida = sys.argv[1:-1], sys.argv[-1]

    # Primeiro PDF manda. Os seguintes entram so com o que e exclusivo, e com
    # a pagina deslocada para a sequencia seguir continua.
    por_codigo = OrderedDict()
    anomalias = []
    repetidos = []
    deslocamento = 0

    herdadas = []
    for caminho in entradas:
        produtos, anom, n_paginas, herdou = extrair_pdf(caminho, deslocamento)
        anomalias.extend(anom)
        herdadas.extend(herdou)

        novos = 0
        for p in produtos:
            if p["referencia"] in por_codigo:
                antes = por_codigo[p["referencia"]]
                # divergir aqui significa que os dois PDFs discordam sobre o
                # mesmo produto, e ai nao ha como escolher em silencio
                if (antes["preco"] != p["preco"]
                        or antes["ouro"] != p["ouro"]
                        or antes["descricao"] != p["descricao"]):
                    anomalias.append(
                        (p["pagina"],
                         "DIVERGENCIA entre PDFs em %s: %s/%s vs %s/%s"
                         % (p["referencia"], antes["preco"], antes["ouro"],
                            p["preco"], p["ouro"])))
                repetidos.append(p["referencia"])
                continue
            por_codigo[p["referencia"]] = p
            novos += 1

        print("%-44s %3d paginas, %4d linhas, %4d novos (paginas %d-%d)"
              % (caminho.split("/")[-1].split("\\")[-1], n_paginas,
                 len(produtos), novos, deslocamento + 1,
                 deslocamento + n_paginas))
        deslocamento += n_paginas

    # ------------------------------------------------------------ escrita
    linhas = []
    for p in por_codigo.values():
        base = {
            "referencia": p["referencia"],
            "variante": "",
            "descricao": p["descricao"],
            "detalhes": p["detalhes"],
            "preco_unitario": "%.2f" % p["preco"],
            "porcentagem_imposto": p["imposto"],
            "pagina": p["pagina"],
        }
        linhas.append(base)

        if p["ouro"] is not None:
            ouro = dict(base)
            ouro["variante"] = VARIANTE_OURO
            ouro["preco_unitario"] = "%.2f" % p["ouro"]
            linhas.append(ouro)

    campos = ["referencia", "variante", "descricao", "detalhes",
              "preco_unitario", "porcentagem_imposto", "pagina"]
    with open(saida, "w", encoding="utf-8", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=campos, delimiter=";")
        escritor.writeheader()
        escritor.writerows(linhas)

    # ---------------------------------------------------------- relatorio
    com_ouro = [p for p in por_codigo.values() if p["ouro"] is not None]
    sem_ouro = [p for p in por_codigo.values() if p["ouro"] is None]
    zerados = [p for p in por_codigo.values() if p["preco"] == 0]

    print()
    print("produtos distintos  : %d" % len(por_codigo))
    print("  com folha de ouro : %d  (viram 2 linhas)" % len(com_ouro))
    print("  sem folha de ouro : %d  (1 linha; preco nao impresso)" % len(sem_ouro))
    print("repetidos entre PDFs: %d (ignorados, o primeiro PDF vence)" % len(repetidos))
    print("com detalhes (OBS)  : %d"
          % sum(1 for p in por_codigo.values() if p["detalhes"]))
    print("preco zero          : %d %s"
          % (len(zerados), [p["referencia"] for p in zerados][:5]))
    print("linhas no CSV       : %d" % len(linhas))

    if herdadas:
        print("\npaginas de continuacao (sem cabecalho proprio, herdaram o"
              " papel da sexta coluna da pagina anterior):")
        print("  %s" % herdadas)

    if com_ouro:
        razoes = Counter(round(p["ouro"] / p["preco"], 4)
                         for p in com_ouro if p["preco"] > 0)
        print("\nrazao folha de ouro / preco base:")
        for razao, quantos in razoes.most_common():
            print("  %+.1f%%  em %d produto(s)" % ((razao - 1) * 100, quantos))
        fora = [p for p in com_ouro
                if p["preco"] > 0 and abs(p["ouro"] / p["preco"] - 1.15) > 0.001]
        if fora:
            print("  fora do +15%% (conferir com a fabrica):")
            for p in fora:
                print("    %-22s %9.2f -> %9.2f  (%+.1f%%)  p%d"
                      % (p["referencia"], p["preco"], p["ouro"],
                         (p["ouro"] / p["preco"] - 1) * 100, p["pagina"]))

    if anomalias:
        print("\nanomalias (%d):" % len(anomalias))
        for pagina, msg in anomalias[:25]:
            print("  p%-3d %s" % (pagina, msg))
        if len(anomalias) > 25:
            print("  ... e mais %d" % (len(anomalias) - 25))

    print("\narquivo: %s" % saida)


if __name__ == "__main__":
    main()
