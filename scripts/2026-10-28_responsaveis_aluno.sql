-- Contato dos responsáveis do aluno menor de idade: até dois responsáveis, cada um com nome e
-- telefone. `nome_responsavel` já existia (só o nome, sem telefone); este script acrescenta o
-- telefone dele e a segunda "lacuna" (nome + telefone), pros casos de pai e mãe com contatos
-- diferentes. Preenchido a partir do relatório de inscritos do clube (Multiclubes) e editável
-- no cadastro do aluno.
--
-- Como aplicar: rodar no Supabase Dashboard → SQL Editor. Idempotente.

alter table alunos add column if not exists telefone_responsavel text;
alter table alunos add column if not exists nome_responsavel_2 text;
alter table alunos add column if not exists telefone_responsavel_2 text;
