-- =============================================================================================
-- Reposição pelo link: aluno sem turma ativa usa o nível da ÚLTIMA turma dele
-- ---------------------------------------------------------------------------------------------
-- Caso Cauê Macris (24/11): saiu das turmas, mas ainda tem créditos de reposição válidos.
-- Sem turma ativa o link não sabia o nível dele e só mostrava a individual vazia do Kleber.
--
-- Ordem para descobrir o nível do aluno:
--   1) turmas de Tênis ATIVAS dele (como sempre foi);
--   2) nível cadastrado na ficha (alunos.nivel), como já era;
--   3) NOVO: a última turma de Tênis em grupo que ele teve (vínculo mais recente, mesmo inativo,
--      mesmo que a turma tenha sido desativada).
-- O agendamento continua exigindo crédito válido, então só quem tem reposição para usar vê horários.
-- =============================================================================================

-- nível da última turma (vínculo mais recente) de Tênis em grupo, ativo ou não
create or replace function repo_nivel_ultima_turma(p_aluno_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select btrim(n.nome)
    from turmas_alunos ta
    join turmas t on t.id = ta.turma_id
    join niveis n on n.id = t.nivel_id
    join modalidades m on m.id = t.modalidade_id and m.nome = 'Tênis'
   where ta.aluno_id = p_aluno_id and btrim(n.nome) <> 'Individual'
   order by ta.criado_em desc nulls last, repo_nivel_rank(n.nome) desc nulls last
   limit 1
$$;
revoke all on function repo_nivel_ultima_turma(uuid) from public, anon;

create or replace function repo_niveis_aluno(p_aluno_id uuid) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(array(select distinct btrim(n.nome) from turmas_alunos ta
       join turmas t on t.id = ta.turma_id and t.ativo
       join niveis n on n.id = t.nivel_id
       join modalidades m on m.id = t.modalidade_id and m.nome = 'Tênis'
      where ta.aluno_id = p_aluno_id and ta.ativo and btrim(n.nome) <> 'Individual'), '{}'),
    nullif(array(select btrim(nivel) from alunos where id = p_aluno_id and nullif(btrim(nivel), '') is not null), '{}'),
    nullif(array(select x from (select repo_nivel_ultima_turma(p_aluno_id) as x) s where x is not null), '{}'),
    '{}'::text[])
$$;
revoke all on function repo_niveis_aluno(uuid) from public, anon;

create or replace function repo_nivel_aluno(p_aluno_id uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select btrim(n.nome) from turmas_alunos ta
       join turmas t on t.id = ta.turma_id and t.ativo
       join niveis n on n.id = t.nivel_id
       join modalidades m on m.id = t.modalidade_id and m.nome = 'Tênis'
      where ta.aluno_id = p_aluno_id and ta.ativo and btrim(n.nome) <> 'Individual'
      order by repo_nivel_rank(n.nome) desc nulls last limit 1),
    (select nullif(btrim(nivel), '') from alunos where id = p_aluno_id),
    repo_nivel_ultima_turma(p_aluno_id))
$$;
revoke all on function repo_nivel_aluno(uuid) from public, anon;

-- conferência: deve mostrar Intermediário 2 para o Cauê
select repo_nivel_aluno('ef9bf5c9-3180-4c35-a6c7-5511a7a98043') as nivel_caue,
       repo_niveis_aluno('ef9bf5c9-3180-4c35-a6c7-5511a7a98043') as niveis_caue;
