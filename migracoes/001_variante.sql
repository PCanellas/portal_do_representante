-- ============================================================
-- MIGRAÇÃO 001 — variante (cor/acabamento) em produtos
--
-- Motivo: o catálogo Metal Domado traz o mesmo código com preços
-- diferentes por cor (ex.: 6609C "Bronze Armani" R$ 1.188,65 e
-- 6609C "Travertino Bruto, Kouros e Verde Guatemala" R$ 924,95).
-- A chave única passa a incluir a variante.
--
-- Aplicar apenas em bancos criados ANTES desta mudança.
-- Bancos novos já nascem corretos pelo schema.sql.
-- ============================================================

-- 1. nova coluna (not null default '' — nulo quebraria a unicidade,
--    porque NULL nunca é igual a NULL numa constraint unique)
alter table public.produtos
  add column if not exists variante text not null default '';

alter table public.orcamentos_itens
  add column if not exists variante text not null default '';


-- 2. troca da chave única: (fabricante, referencia) -> (fabricante, referencia, variante)
do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'public.produtos'::regclass
     and contype  = 'u';
  if c is not null then
    execute format('alter table public.produtos drop constraint %I', c);
  end if;
end $$;

alter table public.produtos
  add constraint produtos_referencia_variante_key
  unique (id_fabricante, referencia, variante);


-- 3. índice de busca passa a cobrir a variante
drop index if exists produtos_busca_idx;

create index produtos_busca_idx on public.produtos using gin (
  (f_unaccent(descricao) || ' ' || f_unaccent(variante) || ' ' || f_unaccent(coalesce(apelidos,'')))
  gin_trgm_ops
);


-- 4. função de busca considerando a variante
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
           public.f_unaccent(p.descricao) || ' ' || public.f_unaccent(p.variante) || ' '
             || public.f_unaccent(coalesce(p.apelidos,''))
         ) >= minimo
    )
  order by extensions.word_similarity(
             public.f_unaccent(termo),
             public.f_unaccent(p.descricao) || ' ' || public.f_unaccent(p.variante) || ' '
             || public.f_unaccent(coalesce(p.apelidos,''))
           ) desc
  limit limite;
$$;


-- ============================================================
-- CONFERÊNCIA
-- ============================================================
-- select column_name, is_nullable, column_default
--   from information_schema.columns
--  where table_name = 'produtos' and column_name = 'variante';
--
-- select conname from pg_constraint
--  where conrelid = 'public.produtos'::regclass and contype = 'u';
-- ============================================================
