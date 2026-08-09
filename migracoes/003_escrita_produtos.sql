-- ============================================================
-- MIGRAÇÃO 003 — o app passa a criar e editar produtos
--
-- Motivo: a edição existe para corrigir erro de carga. A tabela do
-- fabricante continua sendo a fonte de verdade — a carga seguinte
-- sobrescreve qualquer ajuste manual, por decisão de projeto.
--
-- Não existe política de DELETE: remover é marcar situacao = 2.
-- ============================================================

create policy cat_cria_produtos on public.produtos
  for insert to authenticated
  with check (situacao <> 2);

create policy cat_edita_produtos on public.produtos
  for update to authenticated
  using (situacao <> 2)
  with check (true);   -- permite marcar como excluído (situacao = 2)


-- ============================================================
-- CONFERÊNCIA
-- ============================================================
-- select policyname, cmd from pg_policies
--  where tablename = 'produtos' order by cmd;
-- esperado: cat_cria_produtos (INSERT), cat_edita_produtos (UPDATE),
--           cat_le_produtos (SELECT)
-- ============================================================
