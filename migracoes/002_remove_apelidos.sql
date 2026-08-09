-- ============================================================
-- MIGRAÇÃO 002 — remove a coluna apelidos
--
-- Motivo: as descrições dos fabricantes já usam o vocabulário
-- comercial que o representante procura ("SPOT", "Arandela",
-- "Pendente", "Plafon"), tornando o campo redundante.
-- Menos um campo para manter e um upsert mais simples.
-- ============================================================

-- o índice referencia a coluna, então cai primeiro
drop index if exists produtos_busca_idx;

alter table public.produtos drop column if exists apelidos;

create index produtos_busca_idx on public.produtos using gin (
  (f_unaccent(descricao) || ' ' || f_unaccent(variante)) gin_trgm_ops
);

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
-- CONFERÊNCIA
-- ============================================================
-- select column_name from information_schema.columns
--  where table_name = 'produtos' order by ordinal_position;
-- ============================================================
