-- A migração 006 fez o backfill de reposicoes.modalidade_id via join com turmas — mas aulas
-- avulsas não têm turma_id (a modalidade delas é inferida em tempo de execução pela quadra,
-- via getModalidadeDaAula/QUADRA_MODALIDADE em src/constants/modalidades.js), então esse join
-- não encontrava nada e 19 reposições nascidas de falta numa aula avulsa continuaram com
-- modalidade_id nulo ("Modalidade não identificada" no painel do aluno). Reproduz aqui em SQL
-- o mesmo mapeamento quadra → modalidade que o app já usa.
with quadra_modalidade(quadra, modalidade) as (
  values
    ('Quadra 1', 'Tênis'), ('Quadra 2', 'Tênis'), ('Quadra 3', 'Tênis'), ('Quadra 4', 'Tênis'),
    ('Quadra de Padel', 'Padel'),
    ('Quadra 1 Areia', 'Beach Tennis'), ('Quadra 3 Areia', 'Futevôlei'), ('Quadra 5 Areia', 'Vôlei de Praia')
)
update reposicoes r
set modalidade_id = m.id
from aulas a
join quadra_modalidade qm on trim(split_part(a.observacoes, '·', 2)) = qm.quadra
join modalidades m on m.nome = qm.modalidade
where r.aula_origem_id = a.id
  and r.modalidade_id is null
  and a.turma_id is null
  and a.observacoes is not null;
