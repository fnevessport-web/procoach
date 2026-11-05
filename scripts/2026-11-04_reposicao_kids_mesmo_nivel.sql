-- Link oficial de reposição: regras Kids (pedido do coordenador em 04/11/2026).
--
-- 1) Kids NÃO usam a regra "seu nível ou 1 abaixo" (por causa da idade): aluno Kids só enxerga
--    turmas do MESMO nível dele (Kids 7 a 10 só marca em Kids 7 a 10). Adulto continua podendo
--    o próprio nível ou 1 abaixo. Kids e adulto seguem sem se misturar.
-- 2) Turma Kids aceita no máximo 6 alunos no link (antes Kids 4 a 6 ia até 8).
--
-- Mantém as travas anteriores de repo_grade_base: feriado fora (repo_eh_feriado, script
-- 2026-10-30) e Kids Competitivo fora (repo_eh_competitivo, script 2026-10-30b).
-- repo_agendar revalida pela própria repo_grade_base, então a regra vale também na hora de gravar.
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.

create or replace function repo_capacidade(p text) returns int language sql immutable as $$
  select case
    when btrim(p) = 'Individual' then 1
    when btrim(p) not like 'Kids%' or btrim(p) like '%Competitivo%' then 4
    else 6 end                                                              -- todo Kids: até 6
$$;

create or replace function repo_grade_base(p_aluno_id uuid)
returns table (aula_id uuid, data_aula date, horario text, nivel text, formato text, professor text, professor_foto text,
               capacidade int, ocupadas int, vagas int, extra boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_agora timestamp := repo_agora();
  v_niveis text[] := repo_niveis_aluno(p_aluno_id);
  v_tem_ind boolean := exists (select 1 from repo_creditos_validos c where c.aluno_id = p_aluno_id and c.formato = 'individual');
begin
  return query
  with base as (
    select a.id, a.data_aula, t.horario_inicio, btrim(n.nome) as nivel, coalesce(t.eh_turma_reposicao, false) as extra,
           coalesce(a.professor_executou_id, t.professor_titular_id) as prof_id,
           (select count(*) from presencas p where p.aula_id = a.id
              and coalesce(p.status_presenca, 'presente') not in ('falta', 'falta_justificada'))::int as ocupadas,
           (select count(*) from presencas p where p.aula_id = a.id and p.tipo_participacao = 'mensalista'
              and coalesce(p.status_presenca, 'presente') not in ('falta', 'falta_justificada'))::int as fixos
      from aulas a
      join turmas t on t.id = a.turma_id and t.ativo
      join modalidades m on m.id = t.modalidade_id and m.nome = 'Tênis'
      join niveis n on n.id = t.nivel_id
     where a.data_aula between v_agora::date and v_agora::date + 6
       and not repo_eh_feriado(a.data_aula)
       and not repo_eh_competitivo(n.nome)
       and a.status_aula <> 'cancelada'
       and (a.data_aula + t.horario_inicio) >= v_agora + interval '2 hours'
       and coalesce(a.professor_executou_id, t.professor_titular_id) is not null
  )
  select b.id, b.data_aula, to_char(b.horario_inicio, 'HH24:MI'), b.nivel,
         case when b.nivel = 'Individual' then 'individual' else 'grupo' end,
         pf.nome, pf.foto_url,
         repo_capacidade(b.nivel), b.ocupadas, repo_capacidade(b.nivel) - b.ocupadas, b.extra
    from base b
    join professores pf on pf.id = b.prof_id
   where b.ocupadas < repo_capacidade(b.nivel)
     and not exists (select 1 from presencas p where p.aula_id = b.id and p.aluno_id = p_aluno_id)
     and not exists (select 1 from presencas p join aulas a2 on a2.id = p.aula_id left join turmas t2 on t2.id = a2.turma_id
                      where p.aluno_id = p_aluno_id and a2.data_aula = b.data_aula and t2.horario_inicio = b.horario_inicio
                        and a2.status_aula <> 'cancelada'
                        and coalesce(p.status_presenca, 'presente') not in ('falta', 'falta_justificada'))
     and (
       (b.nivel = 'Individual' and v_tem_ind and b.ocupadas = 0)
       or
       (b.nivel <> 'Individual' and (b.fixos > 0 or b.extra) and exists (
          select 1 from unnest(v_niveis) nv
           where (repo_nivel_cat(nv) = 'adulto' and repo_nivel_cat(b.nivel) = 'adulto'
                  and repo_nivel_rank(b.nivel) between repo_nivel_rank(nv) - 1 and repo_nivel_rank(nv))
              or (repo_nivel_cat(nv) = 'kids' and repo_nivel_cat(b.nivel) = 'kids'
                  and repo_nivel_rank(b.nivel) = repo_nivel_rank(nv))           -- Kids: só o mesmo nível
              or (repo_nivel_cat(nv) = 'especial' and b.nivel = nv)))
     );
end $$;

revoke all on function repo_grade_base(uuid) from public, anon;
