-- 2º professor numa aula (pedido do coordenador em 04/11/2026).
--
-- Turmas Kids cheias (acima de 4 alunos, ex.: Kids 4 a 6 e Kids 7 a 10) passam a poder ter um
-- segundo professor naquela aula. Regra de pagamento: os DOIS professores recebem a tabela
-- cheia da aula, calculada pelo total de alunos (mesmo calcularValorAula de sempre, uma vez
-- para cada professor). O app soma a aula na folha de quem está em professor_executou_id E de
-- quem está em professor_auxiliar_id.
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.

alter table aulas
  add column if not exists professor_auxiliar_id uuid references professores(id) on delete set null;

create index if not exists idx_aulas_professor_auxiliar_id on aulas(professor_auxiliar_id);

-- faz a API enxergar a coluna nova na hora
notify pgrst, 'reload schema';
