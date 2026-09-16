-- Turma especial de reposição: turma criada só pra colocar alunos que têm reposição
-- pendente (ex: turma extra de domingo pra escoar reposições de Tênis/Saibro, única
-- modalidade que fica sem aula quando chove).
--
-- Ao gerar as aulas de uma turma marcada assim (useGerarAulas, src/hooks/useAulas.js), os
-- alunos fixos dela entram com tipo_participacao='reposicao' (em vez de 'mensalista') e
-- cada presença já baixa a falta pendente mais antiga do aluno (resolverReposicaoFIFO).
-- O professor recebe 50% do valor da tabela por quantidade de alunos (calcularValorAula,
-- src/constants/modalidades.js), contando todos os alunos não-cortesia da aula.

alter table turmas add column if not exists eh_turma_reposicao boolean not null default false;
