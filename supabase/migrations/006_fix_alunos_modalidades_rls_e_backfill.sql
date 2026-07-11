-- A tabela `alunos_modalidades` tem RLS habilitada mas, assim como `reposicoes` (ver migração
-- 005), nunca teve uma policy funcional pra `authenticated` — confirmado direto no banco: a
-- tabela tem ZERO linhas no sistema inteiro, apesar de existirem pelo menos 3 fluxos no código
-- que gravam nela (Cadastros > Alunos, cadastro rápido em Aulas, e a partir de agora também
-- toda vez que uma presença é salva numa aula de turma). Todo INSERT/UPSERT vinha falhando
-- silenciosamente (ou com "new row violates row-level security policy") desde sempre.
--
-- Efeito visível: o Card do Aluno mostrava "Nenhuma modalidade matriculada" pra qualquer aluno,
-- mesmo jogando toda semana havia meses — porque a seção "Modalidades" do card lê dessa tabela,
-- não de turmas_alunos/presencas (que continuam corretas e são o que de fato roda a grade).
do $$
declare
  pol record;
begin
  for pol in select polname from pg_policy where polrelid = 'alunos_modalidades'::regclass loop
    execute format('drop policy %I on alunos_modalidades', pol.polname);
  end loop;
end $$;

alter table alunos_modalidades enable row level security;
create policy "auth_alunos_modalidades" on alunos_modalidades for all to authenticated using (true) with check (true);

-- Precisa de uma unique constraint em (aluno_id, modalidade_id) pro upsert com onConflict do
-- app funcionar (evita duplicar a mesma modalidade pro mesmo aluno a cada presença salva).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'alunos_modalidades_aluno_modalidade_uniq'
  ) then
    alter table alunos_modalidades
      add constraint alunos_modalidades_aluno_modalidade_uniq unique (aluno_id, modalidade_id);
  end if;
end $$;

-- Backfill: como a tabela nunca gravou nada, reconstrói a partir do que já é verdade na grade —
-- toda matrícula ativa em turma (turmas_alunos) e toda presença já registrada numa aula de
-- turma (cobre também quem só fez aula avulsa/reposição sem nunca ter virado mensalista).
insert into alunos_modalidades (aluno_id, modalidade_id)
select distinct ta.aluno_id, t.modalidade_id
from turmas_alunos ta
join turmas t on t.id = ta.turma_id
where ta.ativo = true and t.modalidade_id is not null
on conflict (aluno_id, modalidade_id) do nothing;

insert into alunos_modalidades (aluno_id, modalidade_id)
select distinct p.aluno_id, t.modalidade_id
from presencas p
join aulas a on a.id = p.aula_id
join turmas t on t.id = a.turma_id
where t.modalidade_id is not null
on conflict (aluno_id, modalidade_id) do nothing;

-- Backfill de reposicoes.modalidade_id: o fluxo principal (falta justificada marcada na aula,
-- em useSalvarPresencas) nunca preencheu essa coluna até agora — aparecia "Modalidade não
-- identificada" no painel de reposições do aluno. Recupera a partir da turma da aula de origem.
update reposicoes r
set modalidade_id = t.modalidade_id
from aulas a
join turmas t on t.id = a.turma_id
where r.aula_origem_id = a.id and r.modalidade_id is null and t.modalidade_id is not null;

-- data_limite ausente nas reposições pendentes mais antigas (criadas antes da Fase 2) — 60 dias
-- a partir de hoje, só pra não ficar "sem prazo" pra sempre. Não mexe em agendada/expirada.
update reposicoes
set data_limite = current_date + interval '60 days'
where data_limite is null and status = 'pendente';
