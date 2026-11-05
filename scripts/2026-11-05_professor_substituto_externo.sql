-- Professor substituto de fora da grade (pedido do coordenador em 05/11/2026).
--
-- Existe um perfil genérico "Professor Substituto" em professores. Quando a aula é dada por
-- alguém que não é da equipe, a agenda coloca esse perfil como professor da aula e grava aqui
-- QUEM deu a aula e QUANTO foi combinado. O financeiro paga essa aula pelo valor combinado
-- (não pela tabela por número de alunos).
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.

alter table aulas add column if not exists substituto_nome text;
alter table aulas add column if not exists substituto_valor numeric(10,2);

notify pgrst, 'reload schema';
