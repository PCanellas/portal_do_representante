-- ============================================================
-- 006 — Ficha técnica do produto
--
-- A tabela da Metal Domado não traz só o nome da peça: traz medida,
-- lâmpada, material e cartela de cores. É o que o lojista pergunta antes
-- de fechar, e sem um lugar para guardar isso a resposta continuava no PDF.
--
-- Coluna nova em vez de aproveitar `variante`, que era o caminho curto:
--   - `variante` faz parte da chave única (id_fabricante, referencia,
--     variante). Ficha técnica ali significa que qualquer mudança de
--     redação na tabela seguinte cria produto novo em vez de atualizar o
--     preço do que existe.
--   - `variante` é congelada no item do orçamento como o acabamento
--     escolhido. O orçamento sairia dizendo que o cliente escolheu
--     "Largura: 8cm | Altura: 40cm".
--
-- Fora do índice de busca de propósito. Toda peça lista "Cores: Sólidas e
-- Automotivas"; com a ficha indexada, procurar "automotiva" traria o
-- catálogo inteiro. A busca continua sendo por nome e código.
--
-- Não vai para orcamentos_itens: o item congela o que tem efeito
-- comercial (referência, descrição, preço, imposto). Ficha técnica é
-- consulta, e consulta lê o produto de hoje.
--
-- Fabricante que não publica ficha fica com string vazia, não NULL — o
-- mesmo tratamento que `variante` já recebe.
-- ============================================================

alter table public.produtos
  add column if not exists detalhes text not null default '';

comment on column public.produtos.detalhes is
  'Ficha técnica como o fabricante publica: medida, lâmpada, material, cartela de cores. Uma linha por item. Vazio quando não há.';


-- Conferência: quantos produtos têm ficha, por fabricante
select f.nome,
       count(*) filter (where p.detalhes <> '') as com_ficha,
       count(*)                                 as total
from public.produtos p
join public.fabricantes f on f.id = p.id_fabricante
group by f.nome
order by f.nome;
