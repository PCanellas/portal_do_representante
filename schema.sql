-- ============================================================
-- ROGÉRIO INNECCO REPRESENTAÇÕES
-- Schema do banco (Supabase / PostgreSQL)
--
-- Convenções:
--   ids em uuid (gen_random_uuid), permitindo geração no cliente / offline
--   situacao : 0 = inativo, 1 = ativo, 2 = excluído
--     o app enxerga 0 e 1 (inativo aparece, mas não pode entrar em orçamento);
--     2 é invisível para o app — filtrado por RLS, não pelo frontend
--   valores monetários em numeric(12,2) — nunca float
--   timestamps em timestamptz (UTC no banco, exibição em America/Sao_Paulo)
-- ============================================================


-- ============================================================
-- 1. EXTENSÕES E FUNÇÕES AUXILIARES
-- ============================================================

create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() não é IMMUTABLE, então não pode ir direto num índice.
-- Este wrapper resolve isso.
create or replace function public.f_unaccent(text)
returns text language sql immutable parallel safe strict
set search_path = '' as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

create or replace function public.set_atualizado_em()
returns trigger language plpgsql
set search_path = '' as $$
begin
  new.atualizado_em = now();
  return new;
end $$;


-- ============================================================
-- 2. TABELAS
-- ============================================================

create table public.representantes (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null,
  whatsapp      text,
  email         text not null,
  situacao      smallint not null default 1 check (situacao in (0,1,2)),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.fabricantes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  tipo_imposto  text not null check (tipo_imposto in ('ST','IPI')),
  situacao      smallint not null default 1 check (situacao in (0,1,2)),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.tabelas_precos (
  id            uuid primary key default gen_random_uuid(),
  id_fabricante uuid not null references public.fabricantes(id),
  nome_arquivo  text not null,
  arquivo_path  text,
  situacao      smallint not null default 1 check (situacao in (0,1,2)),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.produtos (
  id                  uuid primary key default gen_random_uuid(),
  id_fabricante       uuid not null references public.fabricantes(id),
  id_tabela           uuid references public.tabelas_precos(id),
  referencia          text not null,
  variante            text not null default '',   -- cor/acabamento; '' quando não há
  descricao           text not null,
  preco_unitario      numeric(12,2) not null,
  porcentagem_imposto numeric(5,2) not null default 0,
  situacao            smallint not null default 1 check (situacao in (0,1,2)),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  unique (id_fabricante, referencia, variante)
);

create table public.clientes (
  id               uuid primary key default gen_random_uuid(),
  id_representante uuid not null references public.representantes(id),
  nome             text not null,
  whatsapp         text,
  email            text,
  situacao         smallint not null default 1 check (situacao in (0,1,2)),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

create table public.orcamentos (
  id                  uuid primary key default gen_random_uuid(),
  numero              bigint generated always as identity unique,  -- legível: "orçamento 342"
  id_representante    uuid not null references public.representantes(id),
  id_cliente          uuid not null references public.clientes(id),
  id_fabricante       uuid not null references public.fabricantes(id),
  status              text not null default 'rascunho'
                        check (status in ('rascunho','enviado','aprovado','recusado')),
  -- prazo de pagamento em dias: 30 a 150, de 15 em 15
  prazo_pagamento     smallint not null default 30
                        check (prazo_pagamento between 30 and 150
                               and prazo_pagamento % 15 = 0),
  quantidade_total    numeric(12,2) not null default 0,
  valor_sub_total     numeric(12,2) not null default 0,
  percentual_desconto numeric(5,2)  not null default 0,
  valor_desconto      numeric(12,2) not null default 0,
  valor_imposto       numeric(12,2) not null default 0,
  valor_total         numeric(12,2) not null default 0,
  situacao            smallint not null default 1 check (situacao in (0,1,2)),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create table public.orcamentos_itens (
  id                  uuid primary key default gen_random_uuid(),
  id_orcamento        uuid not null references public.orcamentos(id) on delete cascade,
  id_produto          uuid not null references public.produtos(id),
  referencia          text not null,            -- congelada
  variante            text not null default '', -- congelada
  descricao           text not null,            -- congelada
  preco_unitario      numeric(12,2) not null,   -- congelado
  porcentagem_imposto numeric(5,2)  not null,   -- congelada
  quantidade          numeric(12,2) not null,
  percentual_desconto numeric(5,2)  not null default 0,
  valor_desconto      numeric(12,2) not null default 0,
  valor_imposto       numeric(12,2) not null default 0,
  total               numeric(12,2) not null,
  situacao            smallint not null default 1 check (situacao in (0,1,2)),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);


-- ============================================================
-- 3. ÍNDICES
-- ============================================================

-- busca por descrição e variante — sem acento e tolerante a erro de digitação
create index produtos_busca_idx on public.produtos using gin (
  (f_unaccent(descricao) || ' ' || f_unaccent(variante)) gin_trgm_ops
);
create index produtos_referencia_idx on public.produtos (referencia);
create index produtos_visiveis_idx   on public.produtos (id_fabricante) where situacao <> 2;

-- Postgres não indexa FK automaticamente
create index tabelas_precos_fabricante_idx  on public.tabelas_precos (id_fabricante);
create index produtos_fabricante_idx        on public.produtos (id_fabricante);
create index produtos_tabela_idx            on public.produtos (id_tabela);
create index clientes_representante_idx     on public.clientes (id_representante);
create index orcamentos_representante_idx   on public.orcamentos (id_representante);
create index orcamentos_cliente_idx         on public.orcamentos (id_cliente);
create index orcamentos_fabricante_idx      on public.orcamentos (id_fabricante);
create index orcamentos_itens_orcamento_idx on public.orcamentos_itens (id_orcamento);
create index orcamentos_itens_produto_idx   on public.orcamentos_itens (id_produto);


-- ============================================================
-- 4. TRIGGERS DE atualizado_em
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['representantes','fabricantes','tabelas_precos',
                           'produtos','clientes','orcamentos','orcamentos_itens']
  loop
    execute format(
      'create trigger trg_%1$s_atualizado_em before update on public.%1$I
         for each row execute function public.set_atualizado_em()', t);
  end loop;
end $$;


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

alter table public.representantes    enable row level security;
alter table public.fabricantes       enable row level security;
alter table public.tabelas_precos    enable row level security;
alter table public.produtos          enable row level security;
alter table public.clientes          enable row level security;
alter table public.orcamentos        enable row level security;
alter table public.orcamentos_itens  enable row level security;

-- perfil: cada representante só enxerga o próprio
create policy rep_le_proprio    on public.representantes
  for select to authenticated using (auth.uid() = id);
create policy rep_edita_proprio on public.representantes
  for update to authenticated using (auth.uid() = id);

-- catálogo: leitura para logados, escrita só via service_role (script Python).
-- Ativos e inativos são visíveis; excluídos (2) nunca chegam ao app.
create policy cat_le_fabricantes on public.fabricantes
  for select to authenticated using (situacao <> 2);
create policy cat_le_tabelas     on public.tabelas_precos
  for select to authenticated using (situacao <> 2);
create policy cat_le_produtos    on public.produtos
  for select to authenticated using (situacao <> 2);

-- o app cria e edita produtos para corrigir erro de carga; a tabela do
-- fabricante segue como fonte de verdade e a carga seguinte sobrescreve.
-- Sem política de DELETE: remover é marcar situacao = 2.
create policy cat_cria_produtos  on public.produtos
  for insert to authenticated with check (situacao <> 2);
create policy cat_edita_produtos on public.produtos
  for update to authenticated using (situacao <> 2) with check (true);

-- dados comerciais: só do próprio representante
create policy cli_do_rep on public.clientes
  for all to authenticated
  using (id_representante = auth.uid())
  with check (id_representante = auth.uid());

create policy orc_do_rep on public.orcamentos
  for all to authenticated
  using (id_representante = auth.uid())
  with check (id_representante = auth.uid());

create policy item_do_rep on public.orcamentos_itens
  for all to authenticated
  using (exists (select 1 from public.orcamentos o
                 where o.id = id_orcamento and o.id_representante = auth.uid()))
  with check (exists (select 1 from public.orcamentos o
                      where o.id = id_orcamento and o.id_representante = auth.uid()));


-- ============================================================
-- 6. BUSCA DE PRODUTOS
-- ============================================================
-- Chamada pelo app via RPC: supabase.rpc('buscar_produtos', { termo, limite })
-- SECURITY INVOKER (padrão): respeita o RLS de quem chamou.

-- Nota: o limiar é comparado explicitamente (>= 0.35) em vez de via
-- pg_trgm.word_similarity_threshold, porque o role do Supabase não é
-- superusuário e não pode declarar SET dessa GUC numa função.

create or replace function public.buscar_produtos(
  termo   text,
  limite  int  default 30,
  minimo  real default 0.35
)
returns setof public.produtos
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.produtos p
  where p.situacao <> 2
    and (
      p.referencia ilike '%' || termo || '%'
      or extensions.word_similarity(
           public.f_unaccent(termo),
           public.f_unaccent(p.descricao) || ' ' || public.f_unaccent(p.variante)
         ) >= minimo
    )
  order by extensions.word_similarity(
             public.f_unaccent(termo),
             public.f_unaccent(p.descricao) || ' ' || public.f_unaccent(p.variante)
           ) desc
  limit limite;
$$;


-- ============================================================
-- REGRA DE CÁLCULO DO ORÇAMENTO (referência para a aplicação)
-- ============================================================
--
-- item:  bruto    = preco_unitario × quantidade
--        desconto = bruto × percentual_desconto / 100
--        base     = bruto − desconto
--        imposto  = base × porcentagem_imposto / 100
--        total    = base + imposto
--
-- orçamento:
--        valor_sub_total   = Σ bruto dos itens
--        desconto_itens    = Σ desconto dos itens
--        valor_imposto     = Σ imposto dos itens
--        total_com_imposto = Σ total dos itens
--        desconto_global   = total_com_imposto × percentual_desconto / 100
--        valor_desconto    = desconto_itens + desconto_global
--        valor_total       = total_com_imposto − desconto_global
--
-- Conferência: valor_total = valor_sub_total − valor_desconto + valor_imposto
-- Arredondar a 2 casas por item e somar os arredondados.
-- ============================================================
