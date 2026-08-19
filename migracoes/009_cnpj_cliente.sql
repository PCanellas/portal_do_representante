-- ============================================================
-- 009 — CNPJ no cliente
--
-- Mesmo critério do whatsapp: grava só dígitos, a tela formata na hora de
-- mostrar. Opcional e sem índice único de propósito — nem todo cliente é
-- pessoa jurídica, e matriz/filial podem legitimamente repetir o número.
-- ============================================================

alter table public.clientes
  add column if not exists cnpj text;

comment on column public.clientes.cnpj is
  'CNPJ em dígitos, sem formatação. Opcional — nem todo cliente é pessoa jurídica.';


-- Conferência
select cnpj, count(*)
from public.clientes
group by cnpj
order by cnpj;
