-- ============================================================
-- 007 — Observações no orçamento e prazo à vista
--
-- Duas mudanças pedidas juntas:
--
-- 1. `obs`: campo de texto livre para o representante anotar algo que não
--    cabe em nenhum outro campo — um combinado com o cliente, uma condição
--    especial, uma ressalva. Sem estrutura de propósito: é anotação, não
--    dado que o app vá calcular ou agrupar.
--
-- 2. Prazo de pagamento à vista: a 005 fechou o domínio em 30–150 dias, de
--    15 em 15, e deixou de fora o caso mais simples. À vista entra como 0,
--    fora da escada de 15 em 15 — não é "um prazo mais curto", é ausência
--    de prazo, e o app mostra "à vista" em vez de "0 dias".
-- ============================================================

alter table public.orcamentos
  add column if not exists obs text not null default '';

comment on column public.orcamentos.obs is
  'Observação livre do representante. Vazia quando não informada.';

alter table public.orcamentos
  drop constraint if exists orcamentos_prazo_pagamento_check;

alter table public.orcamentos
  add constraint orcamentos_prazo_pagamento_check
    check (prazo_pagamento = 0
           or (prazo_pagamento between 30 and 150 and prazo_pagamento % 15 = 0));

comment on column public.orcamentos.prazo_pagamento is
  'Prazo de pagamento em dias: 0 (à vista) ou 30 a 150, de 15 em 15. Obrigatório.';


-- Conferência: deve listar só valores válidos
select prazo_pagamento, count(*)
from public.orcamentos
group by prazo_pagamento
order by prazo_pagamento;

-- Conferência: o check recusa o que está fora da regra (deve dar erro)
-- update public.orcamentos set prazo_pagamento = 15;
