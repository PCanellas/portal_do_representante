# Rogério Innecco Representações

Consulta de preços e orçamentos para representação comercial de iluminação.
Um representante, no celular, dentro da loja do cliente — muitas vezes sem
sinal.

## O que é

App web instalável (PWA) em Next.js 16 + Supabase. O catálogo inteiro é
baixado uma vez e fica no aparelho: a busca roda local, sem rede, e responde a
cada tecla. Orçamento fechado sem sinal entra numa fila e sobe sozinho.

```
web/         aplicação Next.js
scripts/     extração dos PDFs de tabela e carga no banco (Python)
migracoes/   alterações de schema, numeradas e aplicadas em ordem
tabelas/     PDFs originais dos fabricantes
csv/         saída da extração, conferida antes de subir
schema.sql   o banco inteiro, com as políticas de RLS
```

## Rodar

```bash
cd web && npm install && npm run dev
```

Precisa de `web/.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Sem sinal

O que funciona sem internet, e por quê:

| situação | comportamento |
|---|---|
| sinal cai com o app aberto | segue funcionando: catálogo e busca são locais |
| montar e fechar orçamento | entra na fila do aparelho e sobe quando a rede volta |
| trocar de tela | tela de "sem conexão" com botão de tentar de novo |
| abrir o app sem sinal | abre em `/offline`, com o catálogo para consulta |

Três peças, independentes entre si:

- **`lib/carrinho.ts`** grava o rascunho no aparelho. O iOS descarrega o app da
  memória quando ele fica em segundo plano, e sem isso os itens sumiam.
- **`lib/fila-orcamentos.ts`** guarda o orçamento fechado sem sinal. O id sai do
  aparelho, e é ele que torna o reenvio seguro: sem isso cada retentativa
  criaria um orçamento novo.
- **`public/sw.js`** faz uma coisa só — abrir o app sem sinal em `/offline`, em
  vez da página de erro do navegador.

Duas armadilhas que já custaram caro e estão anotadas no código:

1. `<Link>` no App Router **não pede a página**, pede o payload RSC ao servidor.
   Sem rede a requisição falha e o roteador lança. Quem trata é
   `app/(interno)/error.tsx`, não o service worker — ele não tem como responder
   um payload que nunca viu.
2. Service worker **não pode devolver o conteúdo de uma página no endereço de
   outra**. O Next hidrata com a árvore errada e o roteador estoura. Por isso
   `/offline` é entregue por redirecionamento, não por substituição.

Testar offline exige build de produção — em `dev` o service worker fica
desligado, senão brigaria com o recarregamento a quente:

```bash
cd web && npm run build && npm run start
```

E só em `localhost` ou HTTPS: service worker exige contexto seguro, então pelo
IP da rede local (`http://192.168.x.x`) ele nem registra. **Testar com clique
de verdade num link** — recarregar a página não exercita o caminho que quebra.

## Carregar uma tabela de preços nova

O caminho é sempre o mesmo, e o passo 3 nunca se pula.

```bash
# 1. extrair o PDF para CSV
python scripts/extrair_metaldomado.py tabelas/metaldomado-julho2026.pdf csv/metaldomado-julho2026.csv

# 2. conferir o relatório: linhas extraídas, combos, anomalias
#    A conferência que fecha é uma linha por preço impresso.

# 3. simular a carga — mostra o diff contra o banco, não grava nada
python scripts/carregar.py csv/metaldomado-julho2026.csv --fabricante "Metal Domado"

# 4. efetivar
python scripts/carregar.py csv/metaldomado-julho2026.csv --fabricante "Metal Domado" --confirmar
```

A simulação avisa quando algum preço varia mais de 50% ou quando mais de 10%
do catálogo some — os dois costumam indicar extração incompleta, não decisão
da fábrica.

O formato do CSV e as regras de cada fabricante estão em
[formato-csv.md](formato-csv.md). Fabricante novo pede um extrator novo; o
`carregar.py` serve para todos.

Credenciais dos scripts vêm de um `.env` na raiz (ver `.env.exemplo`). A
`SUPABASE_SERVICE_KEY` ignora RLS por completo: só nos scripts, nunca no app.

**Carregar tabela congela os orçamentos anteriores a ela.** É a regra: um
orçamento é regravado com os preços de hoje, então reeditar um antigo mudaria
o valor combinado com o cliente. Eles continuam abrindo para consulta e PDF.

## Migrações

Arquivos numerados em `migracoes/`, aplicados à mão no SQL Editor do Supabase,
em ordem. Cada um explica no cabeçalho por que existe e traz uma consulta de
conferência no fim. `schema.sql` é o retrato do estado atual e deve ser
atualizado junto.

## Segurança

- Todo acesso a dado passa por RLS. Cliente e orçamento são visíveis apenas ao
  representante dono; catálogo é leitura para quem está autenticado.
- Preço quem decide é o banco: a gravação do orçamento ignora os valores que o
  aparelho manda e relê tudo do banco antes de calcular.
- O `proxy.ts` barra rota privada, mas é checagem otimista — cada página e
  cada action confirmam a sessão por conta própria.
- Falta uma Content-Security-Policy. É o próximo ganho de segurança e precisa
  de nonce por requisição, porque o Next injeta script inline para hidratar.
