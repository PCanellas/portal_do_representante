-- ============================================================
-- 004 — Condição de pagamento no orçamento
--
-- Existe na planilha que ele usa hoje ("30 d") e é a informação que o
-- cliente lê depois do preço. Fica no orçamento, e não no cadastro do
-- cliente, porque muda de negociação para negociação.
--
-- Texto livre de propósito: o prazo é combinado caso a caso e uma lista
-- fechada só travaria o que ele já resolve numa conversa. O app oferece
-- os prazos comuns em atalhos, sem impedir os outros.
-- ============================================================

alter table public.orcamentos
  add column if not exists condicao_pagamento text not null default '';

comment on column public.orcamentos.condicao_pagamento is
  'Prazo combinado, texto livre. Ex.: "30 dias", "30/60", "à vista". Vazio quando não informado.';


-- Conferência
select condicao_pagamento, count(*)
from public.orcamentos
group by condicao_pagamento;
