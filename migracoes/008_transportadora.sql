-- ============================================================
-- 008 — Transportadora no orçamento
--
-- Texto livre, como `obs`: quem define a transportadora e o representante
-- na negociação, caso a caso. Sem cadastro à parte porque não há nada para
-- reaproveitar entre orçamentos — nome, e às vezes nem isso.
-- ============================================================

alter table public.orcamentos
  add column if not exists transportadora text not null default '';

comment on column public.orcamentos.transportadora is
  'Transportadora combinada, texto livre. Vazia quando não informada.';


-- Conferência
select transportadora, count(*)
from public.orcamentos
group by transportadora;
