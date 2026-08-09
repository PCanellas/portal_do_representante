-- ============================================================
-- 005 — Prazo de pagamento: de texto livre para dias
--
-- Substitui a 004. Na 004 o campo era texto porque a regra ainda não
-- estava clara; agora está: 30 a 150 dias, de 15 em 15, e obrigatório.
--
-- Sendo um domínio fechado e numérico, texto era o tipo errado — deixava
-- passar "trinta dias", "30d" e "30 dais", que nenhuma consulta agruparia.
-- Com smallint + check, valor fora da regra não entra nem por erro de
-- código: o banco recusa antes de gravar.
--
-- A 004 rodou há pouco e só gravou string vazia, então não há o que
-- preservar. As linhas existentes ficam com 30, o prazo mais comum.
-- ============================================================

alter table public.orcamentos
  drop column if exists condicao_pagamento;

alter table public.orcamentos
  add column if not exists prazo_pagamento smallint not null default 30
    check (prazo_pagamento between 30 and 150 and prazo_pagamento % 15 = 0);

comment on column public.orcamentos.prazo_pagamento is
  'Prazo de pagamento em dias: 30 a 150, de 15 em 15. Obrigatório.';


-- Conferência: deve listar só valores válidos
select prazo_pagamento, count(*)
from public.orcamentos
group by prazo_pagamento
order by prazo_pagamento;

-- Conferência: o check recusa o que está fora da regra (deve dar erro)
-- update public.orcamentos set prazo_pagamento = 40;
