# -*- coding: utf-8 -*-
"""
Valida um CSV de tabela de precos e carrega no Supabase.

    # so mostra o que mudaria (padrao)
    python scripts/carregar.py csv/luminatti-julho2026.csv --fabricante Luminatti

    # efetiva
    python scripts/carregar.py csv/luminatti-julho2026.csv --fabricante Luminatti --confirmar

Credenciais vem do ambiente (ou de um .env na raiz):
    SUPABASE_URL
    SUPABASE_SERVICE_KEY   <- service_role; ignora RLS, nunca vai para o frontend

Comportamento da carga:
  - produto novo               -> inserido
  - produto ja existente       -> preco, descricao e imposto atualizados
  - produto ausente do CSV     -> situacao = 0 (inativo), nunca apagado
  - preco zero                 -> situacao = 0 (ainda sem circulacao)
  - produto com situacao = 2   -> ignorado (exclusao e decisao manual)
"""
import argparse, csv, io, os, sys
from collections import Counter
from decimal import Decimal, InvalidOperation

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from supabase import create_client

CAMPOS = ['referencia', 'variante', 'descricao',
          'preco_unitario', 'porcentagem_imposto', 'pagina']

LOTE = 500                  # linhas por requisicao
ALERTA_VARIACAO = Decimal('0.50')   # 50% de variacao de preco chama atencao
ALERTA_AUSENTES = 0.10              # 10% do catalogo sumindo chama atencao


# ----------------------------------------------------------------- leitura

def ler_csv(caminho):
    """Le e valida o CSV. Devolve (linhas, erros)."""
    linhas, erros = [], []
    vistos = set()

    with io.open(caminho, encoding='utf-8', newline='') as f:
        leitor = csv.DictReader(f, delimiter=';')

        faltando = [c for c in CAMPOS if c not in (leitor.fieldnames or [])]
        if faltando:
            return [], ['colunas ausentes no cabecalho: %s' % ', '.join(faltando)]

        for n, linha in enumerate(leitor, start=2):   # linha 1 e o cabecalho
            ref = (linha['referencia'] or '').strip()
            var = (linha['variante'] or '').strip()
            desc = ' '.join((linha['descricao'] or '').split())

            if not ref:
                erros.append('linha %d: referencia vazia' % n); continue
            if not desc:
                erros.append('linha %d: descricao vazia (%s)' % (n, ref)); continue

            chave = (ref, var)
            if chave in vistos:
                erros.append('linha %d: %s/%s repetido no CSV' % (n, ref, var or '-'))
                continue
            vistos.add(chave)

            try:
                preco = Decimal(linha['preco_unitario'])
                imposto = Decimal(linha['porcentagem_imposto'])
            except (InvalidOperation, TypeError):
                erros.append('linha %d: numero invalido (%s)' % (n, ref)); continue

            if preco < 0:
                erros.append('linha %d: preco negativo (%s)' % (n, ref)); continue
            if not (0 <= imposto <= 100):
                erros.append('linha %d: imposto fora de 0-100 (%s)' % (n, ref)); continue

            try:
                pagina = int(linha['pagina'])
            except (ValueError, TypeError):
                erros.append('linha %d: pagina invalida (%s)' % (n, ref)); continue

            linhas.append({
                'referencia': ref,
                'variante': var,
                'descricao': desc,
                'preco_unitario': preco,
                'porcentagem_imposto': imposto,
                'pagina': pagina,
            })

    return linhas, erros


def conferir_paginas(linhas):
    """Buraco na sequencia de paginas denuncia extracao incompleta."""
    paginas = sorted({l['pagina'] for l in linhas})
    if not paginas:
        return []
    faltando = [p for p in range(paginas[0], paginas[-1] + 1) if p not in paginas]
    return faltando


# -------------------------------------------------------------------- diff

def calcular_diff(csv_linhas, banco):
    """banco: {(referencia, variante): registro}"""
    novos, alterados, iguais = [], [], 0

    for l in csv_linhas:
        atual = banco.get((l['referencia'], l['variante']))
        if atual is None:
            novos.append(l)
        elif (Decimal(str(atual['preco_unitario'])) != l['preco_unitario']
              or Decimal(str(atual['porcentagem_imposto'])) != l['porcentagem_imposto']
              or atual['descricao'] != l['descricao']):
            alterados.append((l, atual))
        else:
            iguais += 1

    no_csv = {(l['referencia'], l['variante']) for l in csv_linhas}
    ausentes = [r for k, r in banco.items()
                if k not in no_csv and r['situacao'] == 1]

    return novos, alterados, iguais, ausentes


def relatar(novos, alterados, iguais, ausentes, total_banco):
    print('\n--- diferencas ---')
    print('  inalterados : %d' % iguais)
    print('  novos       : %d' % len(novos))
    print('  alterados   : %d' % len(alterados))
    print('  a inativar  : %d' % len(ausentes))

    if alterados:
        variacoes = []
        for novo, atual in alterados:
            antes = Decimal(str(atual['preco_unitario']))
            if antes > 0:
                variacoes.append((novo['preco_unitario'] - antes) / antes)
        if variacoes:
            media = sum(variacoes) / len(variacoes)
            print('  variacao media de preco: %+.1f%%' % (media * 100))

        bruscas = [(n, a) for n, a in alterados
                   if Decimal(str(a['preco_unitario'])) > 0
                   and abs(n['preco_unitario'] - Decimal(str(a['preco_unitario'])))
                   / Decimal(str(a['preco_unitario'])) > ALERTA_VARIACAO]
        if bruscas:
            print('\n  ATENCAO: %d precos variaram mais de %d%%:'
                  % (len(bruscas), ALERTA_VARIACAO * 100))
            for n, a in bruscas[:10]:
                print('    %-10s %10s -> %10s  | %s'
                      % (n['referencia'], a['preco_unitario'],
                         n['preco_unitario'], n['descricao'][:45]))
            if len(bruscas) > 10:
                print('    ... e mais %d' % (len(bruscas) - 10))

    if total_banco and len(ausentes) > total_banco * ALERTA_AUSENTES:
        print('\n  ATENCAO: %d produtos (%.0f%% do catalogo) sumiram da tabela.'
              % (len(ausentes), 100.0 * len(ausentes) / total_banco))
        print('  Isso costuma indicar extracao incompleta, nao decisao da fabrica.')


# ------------------------------------------------------------------ carga

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('csv')
    ap.add_argument('--fabricante', required=True, help='nome exato do fabricante')
    ap.add_argument('--arquivo', help='nome do PDF de origem (registro da carga)')
    ap.add_argument('--confirmar', action='store_true',
                    help='efetiva; sem esta flag apenas mostra o diff')
    args = ap.parse_args()

    # 1. CSV — validado antes de qualquer acesso a rede
    linhas, erros = ler_csv(args.csv)
    if erros:
        print('CSV invalido (%d problemas):' % len(erros))
        for e in erros[:20]:
            print('  ' + e)
        sys.exit(1)

    faltando = conferir_paginas(linhas)
    if faltando:
        print('ATENCAO: sem nenhum produto nas paginas %s.' % faltando)
        print('Se o PDF tem conteudo nelas, a extracao perdeu um trecho.\n')

    print('CSV: %d produtos, paginas %d a %d'
          % (len(linhas), min(l['pagina'] for l in linhas),
             max(l['pagina'] for l in linhas)))

    # 2. fabricante
    url = os.environ.get('SUPABASE_URL')
    chave = os.environ.get('SUPABASE_SERVICE_KEY')
    if not url or not chave:
        sys.exit('defina SUPABASE_URL e SUPABASE_SERVICE_KEY (ambiente ou .env)')

    sb = create_client(url, chave)
    fab = sb.table('fabricantes').select('id,nome,tipo_imposto') \
            .eq('nome', args.fabricante).execute().data
    if not fab:
        sys.exit('fabricante "%s" nao encontrado' % args.fabricante)
    fab = fab[0]
    print('fabricante: %s (%s)' % (fab['nome'], fab['tipo_imposto']))

    # 3. estado atual
    banco, pagina, tamanho = {}, 0, 1000
    while True:
        lote = sb.table('produtos') \
                 .select('id,referencia,variante,descricao,preco_unitario,'
                         'porcentagem_imposto,situacao') \
                 .eq('id_fabricante', fab['id']) \
                 .range(pagina * tamanho, (pagina + 1) * tamanho - 1).execute().data
        if not lote:
            break
        for r in lote:
            if r['situacao'] != 2:          # excluido nao participa
                banco[(r['referencia'], r['variante'])] = r
        if len(lote) < tamanho:
            break
        pagina += 1
    print('no banco  : %d produtos' % len(banco))

    # 4. diff
    novos, alterados, iguais, ausentes = calcular_diff(linhas, banco)
    relatar(novos, alterados, iguais, ausentes, len(banco))

    if not args.confirmar:
        print('\n(simulacao — rode com --confirmar para gravar)')
        return

    # 5. registro da carga
    tabela = sb.table('tabelas_precos').insert({
        'id_fabricante': fab['id'],
        'nome_arquivo': args.arquivo or os.path.basename(args.csv),
    }).execute().data[0]

    # 6. upsert
    registros = [{
        'id_fabricante': fab['id'],
        'id_tabela': tabela['id'],
        'referencia': l['referencia'],
        'variante': l['variante'],
        'descricao': l['descricao'],
        'preco_unitario': str(l['preco_unitario']),
        'porcentagem_imposto': str(l['porcentagem_imposto']),
        'situacao': 0 if l['preco_unitario'] == 0 else 1,
    } for l in linhas]

    for i in range(0, len(registros), LOTE):
        sb.table('produtos').upsert(
            registros[i:i + LOTE],
            on_conflict='id_fabricante,referencia,variante').execute()
        print('  gravados %d/%d' % (min(i + LOTE, len(registros)), len(registros)))

    # 7. inativa os que sumiram
    if ausentes:
        ids = [r['id'] for r in ausentes]
        for i in range(0, len(ids), LOTE):
            sb.table('produtos').update({'situacao': 0}) \
              .in_('id', ids[i:i + LOTE]).execute()
        print('  inativados %d' % len(ids))

    zerados = sum(1 for r in registros if r['situacao'] == 0)
    print('\ncarga concluida — tabela %s' % tabela['id'])
    print('  %d produtos gravados (%d inativos por preco zero)'
          % (len(registros), zerados))


if __name__ == '__main__':
    main()
