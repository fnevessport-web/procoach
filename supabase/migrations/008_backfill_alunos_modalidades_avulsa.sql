-- As migrações 006/007 cobriram alunos_modalidades e reposicoes.modalidade_id só pra quem
-- tem pelo menos uma presença/matrícula numa aula de TURMA (join por turma_id). Alunos que só
-- jogaram aula avulsa (ex.: Diogo Soares — Beach Tennis, Padel e Tênis, tudo avulso, nunca
-- virou mensalista de turma) continuaram de fora, porque a modalidade dessas aulas só existe
-- inferida pela quadra (mesmo mapeamento usado na 007 e em getModalidadeDaAula no app).
with quadra_modalidade(quadra, modalidade) as (
  values
    ('Quadra 1', 'Tênis'), ('Quadra 2', 'Tênis'), ('Quadra 3', 'Tênis'), ('Quadra 4', 'Tênis'),
    ('Quadra de Padel', 'Padel'),
    ('Quadra 1 Areia', 'Beach Tennis'), ('Quadra 3 Areia', 'Futevôlei'), ('Quadra 5 Areia', 'Vôlei de Praia')
)
insert into alunos_modalidades (aluno_id, modalidade_id)
select distinct p.aluno_id, m.id
from presencas p
join aulas a on a.id = p.aula_id
join quadra_modalidade qm on trim(split_part(a.observacoes, '·', 2)) = qm.quadra
join modalidades m on m.nome = qm.modalidade
where a.turma_id is null and a.observacoes is not null
on conflict (aluno_id, modalidade_id) do nothing;
