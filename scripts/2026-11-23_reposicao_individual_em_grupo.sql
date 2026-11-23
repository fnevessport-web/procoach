-- Reposição: aluno só de aula INDIVIDUAL pode repor em turma EM GRUPO (pedido de 23/11/2026,
-- caso da Roberta Beatriz Donato, individual de sexta 8h).
--
-- Antes: quem só tem turma individual não tem "nível de grupo", então a grade do link só mostrava
-- aulas individuais vazias. Agora o link pergunta "qual é o seu nível?" e mostra as turmas em grupo
-- desse nível + 1 abaixo (Kids: só o mesmo nível), avisando que usa um crédito de aula individual.
--
-- O que muda:
--   * repo_grade_base(uuid, text)  -> versão nova com o nível informado pelo aluno (p_nivel_declarado).
--     Só vale para quem tem crédito individual válido e para nível de adulto ou Kids (nunca
--     Competitivo, Individual, Damas, Senior). A versão antiga repo_grade_base(uuid) vira atalho
--     para a nova com nível nulo (comportamento igual ao de antes).
--   * repo_grade(uuid, text, text) e repo_agendar(uuid, text, uuid[], text) -> versões novas que
--     recebem o nível. As antigas continuam existindo e funcionando igual.
--   * Presença criada com crédito individual numa aula em grupo fica marcada em criado_por_nome
--     ("Link de reposição · crédito individual em grupo") para a equipe identificar.
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.

-- ---------------------------------------------------------------------------------------------
-- 1) Grade base com nível informado
-- ---------------------------------------------------------------------------------------------
create or replace function repo_grade_base(p_aluno_id uuid, p_nivel_declarado text)
returns table (aula_id uuid, data_aula date, horario text, nivel text, formato text, professor text, professor_foto text,
               capacidade int, ocupadas int, vagas int, extra boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_agora timestamp := repo_agora();
  v_niveis text[] := repo_niveis_aluno(p_aluno_id);
  v_tem_ind boolean := exists (select 1 from repo_creditos_validos c where c.aluno_id = p_aluno_id and c.formato = 'individual');
  v_decl text := nullif(btrim(coalesce(p_nivel_declarado, '')), '');
begin
  if v_decl is not null and v_tem_ind
     and repo_nivel_cat(v_decl) in ('adulto', 'kids')
     and not repo_eh_competitivo(v_decl)
     and repo_nivel_rank(v_decl) is not null then
    v_niveis := array_append(v_niveis, v_decl);
  end if;

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

revoke all on function repo_grade_base(uuid, text) from public, anon;

-- A versão antiga (sem nível) passa a ser só um atalho, com o mesmo resultado de antes.
create or replace function repo_grade_base(p_aluno_id uuid)
returns table (aula_id uuid, data_aula date, horario text, nivel text, formato text, professor text, professor_foto text,
               capacidade int, ocupadas int, vagas int, extra boolean)
language sql stable security definer set search_path = public as $$
  select * from repo_grade_base(p_aluno_id, null::text)
$$;

revoke all on function repo_grade_base(uuid) from public, anon;

-- ---------------------------------------------------------------------------------------------
-- 2) Grade (chamada pela página) com nível informado
-- ---------------------------------------------------------------------------------------------
create or replace function repo_grade(p_aluno_id uuid, p_telefone text, p_nivel_declarado text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_aluno alunos;
begin
  select * into v_aluno from alunos where id = p_aluno_id and ativo;
  if v_aluno.id is null or not repo_tel_confere(v_aluno, p_telefone) then
    return jsonb_build_object('ok', false, 'codigo', 'nao_autorizado');
  end if;
  return jsonb_build_object('ok', true, 'aulas', coalesce((
    select jsonb_agg(to_jsonb(g) order by g.data_aula, g.horario, g.nivel)
      from repo_grade_base(p_aluno_id, p_nivel_declarado) g), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3) Agendar com nível informado (mesma lógica do repo_agendar original)
-- ---------------------------------------------------------------------------------------------
create or replace function repo_agendar(p_aluno_id uuid, p_telefone text, p_aula_ids uuid[], p_nivel_declarado text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_aluno alunos;
  v_aula_id uuid;
  v_g record;
  v_cred uuid;
  v_cred_formato text;
  v_vaga int;
  v_feitos jsonb := '[]'::jsonb;
  v_esgotadas uuid[] := '{}';
begin
  select * into v_aluno from alunos where id = p_aluno_id and ativo;
  if v_aluno.id is null or not repo_tel_confere(v_aluno, p_telefone) then
    return jsonb_build_object('ok', false, 'codigo', 'nao_autorizado');
  end if;
  if p_aula_ids is null or array_length(p_aula_ids, 1) is null then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;

  perform pg_advisory_xact_lock(hashtext('repo_aluno_' || p_aluno_id::text));
  perform 1 from aulas where id = any(p_aula_ids) order by id for update;

  if (select count(*) from repo_creditos_validos where aluno_id = p_aluno_id) < array_length(p_aula_ids, 1) then
    return jsonb_build_object('ok', false, 'codigo', 'sem_saldo');
  end if;

  foreach v_aula_id in array p_aula_ids loop
    select * into v_g from repo_grade_base(p_aluno_id, p_nivel_declarado) g where g.aula_id = v_aula_id;
    if v_g.aula_id is null then
      v_esgotadas := v_esgotadas || v_aula_id;
      continue;
    end if;

    -- individual usa crédito individual; grupo usa o de grupo e, se não tiver, o individual.
    select c.id, c.formato into v_cred, v_cred_formato from repo_creditos_validos c
     where c.aluno_id = p_aluno_id
       and (c.formato = v_g.formato or (v_g.formato = 'grupo' and c.formato = 'individual'))
     order by (c.formato = v_g.formato) desc, c.data_limite nulls last, c.data_origem
     limit 1;
    if v_cred is null then
      return jsonb_build_object('ok', false, 'codigo', 'sem_saldo');
    end if;

    select coalesce(max(vaga_numero), 0) + 1 into v_vaga from presencas where aula_id = v_aula_id;
    insert into presencas (aula_id, aluno_id, presente, status_presenca, tipo_participacao, vaga_numero, criado_por_nome)
    values (v_aula_id, p_aluno_id, false, 'presente', 'reposicao', v_vaga,
            case when v_g.formato = 'grupo' and v_cred_formato = 'individual'
                 then 'Link de reposição · crédito individual em grupo' else 'Link de reposição' end);

    update reposicoes set status = 'agendada', aula_reposicao_id = v_aula_id, agendado_via = 'link', agendado_em = now()
     where id = v_cred;

    v_feitos := v_feitos || jsonb_build_object('aula_id', v_aula_id, 'data', v_g.data_aula, 'horario', v_g.horario,
                  'nivel', v_g.nivel, 'professor', v_g.professor, 'extra', v_g.extra);
  end loop;

  if array_length(v_esgotadas, 1) is not null then
    raise exception using errcode = 'P0001', message = 'repo_esgotado:' || array_to_string(v_esgotadas, ',');
  end if;

  return jsonb_build_object('ok', true, 'agendadas', v_feitos,
    'saldo', (select count(*) from repo_creditos_validos where aluno_id = p_aluno_id));
exception when sqlstate 'P0001' then
  if sqlerrm like 'repo_esgotado:%' then
    return jsonb_build_object('ok', false, 'codigo', 'esgotado',
      'aula_ids', to_jsonb(string_to_array(substr(sqlerrm, 15), ',')));
  end if;
  raise;
end $$;

grant execute on function repo_grade(uuid, text, text) to anon, authenticated;
grant execute on function repo_agendar(uuid, text, uuid[], text) to anon, authenticated;

notify pgrst, 'reload schema';
