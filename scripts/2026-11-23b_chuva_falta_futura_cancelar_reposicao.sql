-- Pacote de 23/11/2026 (rodar DEPOIS de 2026-11-23_reposicao_individual_em_grupo.sql).
--
-- 1) CHUVA AUTOMÁTICA NO BANCO. Aula cancelada por Chuva, por qualquer tela:
--      * todos os alunos da aula ficam com falta justificada;
--      * quem é fixo/avulso ganha o crédito de reposição (30 dias a partir da aula);
--      * quem estava REPONDO nessa aula recebe o crédito de volta (pendente), com a aula cancelada
--        registrada no histórico do crédito ("marcou dia X e também choveu").
--    Corrige 2 falhas que existiam: salvar a lista de presença de uma aula já cancelada voltava
--    os alunos pra "presente" e prendia de novo o crédito devolvido na aula cancelada.
-- 2) FALTA AVISADA COM RASTRO. presencas ganha quem avisou, quando e o motivo (ex.: "viagem").
-- 3) VAGA DE FALTA AVISADA. Na grade do link, turma em grupo continua aparecendo mesmo se todos
--    os fixos avisaram falta (antes sumia por "não ter aluno fixo naquele dia").
-- 4) KLEBER (salário fixo). Professor com libera_vagas_reposicao = true: as aulas dele SEM
--    ALUNO ("inativas" na agenda) entram na grade do link. Turma em grupo vazia aparece pelo
--    nível dela; individual vazia aparece também pra quem só tem crédito de grupo.
-- 5) ALUNO CANCELA A REPOSIÇÃO PELO LINK até 2h antes da aula; o crédito volta na hora.
-- 6) AULA SEM PROFESSOR não aparece no link, nem quando a turma tem titular mas a aula do dia está
--    sem professor (como a agenda mostra "sem professor").
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.
-- No final ele corrige as aulas de chuva de novembro que ficaram inconsistentes e mostra o resumo.

-- ---------------------------------------------------------------------------------------------
-- Colunas
-- ---------------------------------------------------------------------------------------------
alter table presencas add column if not exists falta_avisada_em timestamptz;
alter table presencas add column if not exists falta_avisada_por text;          -- e-mail de quem marcou
alter table presencas add column if not exists falta_avisada_por_nome text;
alter table presencas add column if not exists falta_motivo text;

alter table professores add column if not exists libera_vagas_reposicao boolean not null default false;
update professores set libera_vagas_reposicao = true where id = '385cea4d-51e0-4705-81d6-0785191e06c4';  -- Kleber

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
create or replace function repo_aula_chuva(p_aula_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from aulas where id = p_aula_id and status_aula = 'cancelada' and motivo_cancelamento = 'Chuva')
$$;

-- Devolve o crédito que o aluno estava usando nesta aula (status volta a pendente), anotando a
-- aula no histórico. Usado pela chuva, pelo cancelamento no link e pela falta avisada de quem
-- estava repondo. Devolve o id do crédito (ou null se não tinha nenhum agendado aqui).
create or replace function repo_devolver_credito(p_aula_id uuid, p_aluno_id uuid, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_aula aulas;
  v_id uuid;
begin
  select * into v_aula from aulas where id = p_aula_id;
  update reposicoes r set
      status = 'pendente',
      aula_reposicao_id = null,
      agendado_via = null,
      agendado_em = null,
      historico = case
        when coalesce(r.historico, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('aula_id', p_aula_id)) then r.historico
        else coalesce(r.historico, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'aula_id', p_aula_id, 'data_aula', v_aula.data_aula, 'motivo', p_motivo, 'em', now())) end,
      -- chuva renova o prazo (30 dias a partir da aula que choveu); cancelamento do aluno não
      data_limite = case when p_motivo = 'Chuva'
                         then greatest(coalesce(r.data_limite, v_aula.data_aula + 30), v_aula.data_aula + 30)
                         else r.data_limite end
   where r.id = (select id from reposicoes where aula_reposicao_id = p_aula_id and aluno_id = p_aluno_id
                   and status = 'agendada' order by agendado_em desc nulls last limit 1)
  returning r.id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 1) Chuva: tudo o que acontece quando uma aula é cancelada por Chuva (idempotente)
-- ---------------------------------------------------------------------------------------------
create or replace function repo_aplicar_cancelamento_chuva(p_aula_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_aula aulas;
  v_mod uuid;
  v_p record;
  v_r record;
  v_devolvidos int := 0;
  v_novos int := 0;
  v_justif int := 0;
begin
  select * into v_aula from aulas where id = p_aula_id;
  if v_aula.id is null or v_aula.status_aula <> 'cancelada' or coalesce(v_aula.motivo_cancelamento, '') <> 'Chuva' then
    return jsonb_build_object('ok', false, 'codigo', 'nao_e_chuva');
  end if;
  select t.modalidade_id into v_mod from turmas t where t.id = v_aula.turma_id;

  update presencas set status_presenca = 'falta_justificada', presente = false
   where aula_id = p_aula_id and (status_presenca is distinct from 'falta_justificada' or presente);
  get diagnostics v_justif = row_count;

  -- quem estava repondo aqui (mesmo que já tenha saído da lista): o crédito volta
  for v_r in select distinct aluno_id from reposicoes where aula_reposicao_id = p_aula_id and status = 'agendada' loop
    if repo_devolver_credito(p_aula_id, v_r.aluno_id, 'Chuva') is not null then
      v_devolvidos := v_devolvidos + 1;
    end if;
  end loop;

  for v_p in select aluno_id, tipo_participacao from presencas where aula_id = p_aula_id loop
    -- já recebeu de volta o crédito que usou aqui: não ganha outro
    if exists (select 1 from reposicoes r where r.aluno_id = v_p.aluno_id
                 and r.historico @> jsonb_build_array(jsonb_build_object('aula_id', p_aula_id))) then
      continue;
    end if;
    insert into reposicoes (aluno_id, aula_origem_id, modalidade_id, status, data_limite)
    values (v_p.aluno_id, p_aula_id, v_mod, 'pendente', v_aula.data_aula + 30)
    on conflict (aluno_id, aula_origem_id) do nothing;
    if found then v_novos := v_novos + 1; end if;
  end loop;

  return jsonb_build_object('ok', true, 'justificadas', v_justif, 'creditos_novos', v_novos, 'creditos_devolvidos', v_devolvidos);
end $$;

-- Trigger em aulas: virou "cancelada por Chuva" -> aplica.
create or replace function trg_aulas_chuva() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status_aula = 'cancelada' and new.motivo_cancelamento = 'Chuva'
     and (old.status_aula is distinct from 'cancelada' or old.motivo_cancelamento is distinct from 'Chuva') then
    perform repo_aplicar_cancelamento_chuva(new.id);
  end if;
  return null;
end $$;
drop trigger if exists aulas_chuva on aulas;
create trigger aulas_chuva after update of status_aula, motivo_cancelamento on aulas
  for each row execute function trg_aulas_chuva();

-- Trigger em presencas: em aula cancelada por chuva ninguém volta a "presente" (a tela salvava o
-- estado antigo por cima) e quem entra depois também ganha o crédito.
create or replace function trg_presencas_chuva_antes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if repo_aula_chuva(new.aula_id) then
    new.status_presenca := 'falta_justificada';
    new.presente := false;
  end if;
  return new;
end $$;
drop trigger if exists presencas_chuva_antes on presencas;
create trigger presencas_chuva_antes before insert or update of status_presenca, presente on presencas
  for each row execute function trg_presencas_chuva_antes();

create or replace function trg_presencas_chuva_depois() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if repo_aula_chuva(new.aula_id) then
    perform repo_aplicar_cancelamento_chuva(new.aula_id);
  end if;
  return null;
end $$;
drop trigger if exists presencas_chuva_depois on presencas;
create trigger presencas_chuva_depois after insert on presencas
  for each row execute function trg_presencas_chuva_depois();

-- Trigger em reposicoes: crédito nunca fica "agendado" numa aula cancelada por chuva, e quem já
-- recebeu o crédito de volta de uma aula não ganha um segundo crédito com origem nela.
create or replace function trg_reposicoes_guarda() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'agendada' and new.aula_reposicao_id is not null and repo_aula_chuva(new.aula_reposicao_id) then
    if tg_op = 'UPDATE' and old.status = 'pendente' then
      return old;                                   -- tentativa de prender o crédito de novo: ignora
    end if;
    new.status := 'pendente';
    new.aula_reposicao_id := null;
  end if;
  if tg_op = 'INSERT' and exists (select 1 from reposicoes r where r.aluno_id = new.aluno_id
        and r.historico @> jsonb_build_array(jsonb_build_object('aula_id', new.aula_origem_id))) then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists reposicoes_guarda on reposicoes;
create trigger reposicoes_guarda before insert or update on reposicoes
  for each row execute function trg_reposicoes_guarda();

-- ---------------------------------------------------------------------------------------------
-- 3) e 4) Grade do link: vaga de falta avisada + aulas vazias do Kleber
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
  v_tem_grupo boolean := exists (select 1 from repo_creditos_validos c where c.aluno_id = p_aluno_id and c.formato = 'grupo');
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
           a.professor_executou_id as prof_id,
           (select count(*) from presencas p where p.aula_id = a.id
              and coalesce(p.status_presenca, 'presente') not in ('falta', 'falta_justificada'))::int as ocupadas,
           -- turma "real" naquele dia: tem aluno fixo, mesmo que ele tenha avisado falta
           (select count(*) from presencas p where p.aula_id = a.id and p.tipo_participacao = 'mensalista')::int as matriculados
      from aulas a
      join turmas t on t.id = a.turma_id and t.ativo
      join modalidades m on m.id = t.modalidade_id and m.nome = 'Tênis'
      join niveis n on n.id = t.nivel_id
     where a.data_aula between v_agora::date and v_agora::date + 6
       and not repo_eh_feriado(a.data_aula)
       and not repo_eh_competitivo(n.nome)
       and a.status_aula <> 'cancelada'
       and (a.data_aula + t.horario_inicio) >= v_agora + interval '2 hours'
       -- só aula com professor definido NA AULA (igual à agenda: sem professor = não abre vaga),
       -- mesmo que a turma tenha titular
       and a.professor_executou_id is not null
  ), base2 as (
    select b.*, pf.nome as prof_nome, pf.foto_url as prof_foto, coalesce(pf.libera_vagas_reposicao, false) as libera
      from base b join professores pf on pf.id = b.prof_id
  )
  select b.id, b.data_aula, to_char(b.horario_inicio, 'HH24:MI'), b.nivel,
         -- individual vazia do Kleber pra quem só tem crédito de grupo: entra como "grupo" de 1 vaga
         case when b.nivel = 'Individual' and (v_tem_ind or not b.libera) then 'individual'
              when b.nivel = 'Individual' then 'grupo'
              else 'grupo' end,
         b.prof_nome, b.prof_foto,
         repo_capacidade(b.nivel), b.ocupadas, repo_capacidade(b.nivel) - b.ocupadas, b.extra
    from base2 b
   where b.ocupadas < repo_capacidade(b.nivel)
     and not exists (select 1 from presencas p where p.aula_id = b.id and p.aluno_id = p_aluno_id)
     and not exists (select 1 from presencas p join aulas a2 on a2.id = p.aula_id left join turmas t2 on t2.id = a2.turma_id
                      where p.aluno_id = p_aluno_id and a2.data_aula = b.data_aula and t2.horario_inicio = b.horario_inicio
                        and a2.status_aula <> 'cancelada'
                        and coalesce(p.status_presenca, 'presente') not in ('falta', 'falta_justificada'))
     and (
       (b.nivel = 'Individual' and b.ocupadas = 0 and (v_tem_ind or (b.libera and v_tem_grupo)))
       or
       (b.nivel <> 'Individual' and (b.matriculados > 0 or b.extra or b.libera) and exists (
          select 1 from unnest(v_niveis) nv
           where (repo_nivel_cat(nv) = 'adulto' and repo_nivel_cat(b.nivel) = 'adulto'
                  and repo_nivel_rank(b.nivel) between repo_nivel_rank(nv) - 1 and repo_nivel_rank(nv))
              or (repo_nivel_cat(nv) = 'kids' and repo_nivel_cat(b.nivel) = 'kids'
                  and repo_nivel_rank(b.nivel) = repo_nivel_rank(nv))
              or (repo_nivel_cat(nv) = 'especial' and b.nivel = nv)))
     );
end $$;
revoke all on function repo_grade_base(uuid, text) from public, anon;

-- ---------------------------------------------------------------------------------------------
-- 5) Painel: reposições agendadas com "pode cancelar"
-- ---------------------------------------------------------------------------------------------
create or replace function repo_painel(p_aluno_id uuid, p_telefone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_aluno alunos;
  v_agora timestamp := repo_agora();
  v_hoje date := (repo_agora())::date;
  v_ini date := (date_trunc('month', (repo_agora())::date) - interval '1 month')::date;
  v_fim date := (date_trunc('month', (repo_agora())::date) + interval '1 month' - interval '1 day')::date;
begin
  select * into v_aluno from alunos where id = p_aluno_id and ativo;
  if v_aluno.id is null or not repo_tel_confere(v_aluno, p_telefone) then
    return jsonb_build_object('ok', false, 'codigo', 'nao_autorizado');
  end if;

  return jsonb_build_object(
    'ok', true,
    'aluno', jsonb_build_object('id', v_aluno.id, 'nome', btrim(v_aluno.nome), 'menor', coalesce(v_aluno.menor_idade, false),
                                'nivel', repo_nivel_aluno(v_aluno.id)),
    'turmas', coalesce((
      select jsonb_agg(jsonb_build_object('dia', t.horario_dia_semana, 'horario', to_char(t.horario_inicio, 'HH24:MI'),
               'nivel', btrim(n.nome), 'professor', p.nome) order by t.horario_dia_semana, t.horario_inicio)
        from turmas_alunos ta
        join turmas t on t.id = ta.turma_id and t.ativo
        join modalidades m on m.id = t.modalidade_id and m.nome = 'Tênis'
        left join niveis n on n.id = t.nivel_id
        left join professores p on p.id = t.professor_titular_id
       where ta.aluno_id = v_aluno.id and ta.ativo), '[]'::jsonb),
    'creditos', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'data_origem', c.data_origem, 'horario_origem', c.horario_origem,
               'formato', c.formato, 'nivel_origem', c.nivel_origem, 'data_limite', c.data_limite, 'historico', c.historico)
               order by c.data_limite nulls last, c.data_origem)
        from repo_creditos_validos c where c.aluno_id = v_aluno.id), '[]'::jsonb),
    'creditos_competitivo', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'data_origem', c.data_origem, 'horario_origem', c.horario_origem,
               'nivel_origem', c.nivel_origem, 'data_limite', c.data_limite)
               order by c.data_limite nulls last, c.data_origem)
        from repo_creditos_competitivo c where c.aluno_id = v_aluno.id), '[]'::jsonb),
    'outros_pendentes', (
      select count(*) from reposicoes r join aulas a on a.id = r.aula_origem_id
       where r.aluno_id = v_aluno.id and r.status = 'pendente'
         and not (a.status_aula = 'cancelada' and a.motivo_cancelamento = 'Chuva')),
    'agendadas', coalesce((
      select jsonb_agg(jsonb_build_object('aula_id', a.id, 'data', a.data_aula, 'horario', to_char(t.horario_inicio, 'HH24:MI'),
               'nivel', btrim(n.nome), 'professor', p.nome, 'data_limite', r.data_limite,
               'pode_cancelar', (a.data_aula + t.horario_inicio) >= v_agora + interval '2 hours')
               order by a.data_aula, t.horario_inicio)
        from reposicoes r
        join aulas a on a.id = r.aula_reposicao_id and a.data_aula >= v_hoje and a.status_aula <> 'cancelada'
        join turmas t on t.id = a.turma_id
        left join niveis n on n.id = t.nivel_id
        left join professores p on p.id = coalesce(a.professor_executou_id, t.professor_titular_id)
       where r.aluno_id = v_aluno.id and r.status = 'agendada'), '[]'::jsonb),
    'frequencia', coalesce((
      select jsonb_agg(jsonb_build_object('data', a.data_aula,
               'horario', coalesce(to_char(t.horario_inicio, 'HH24:MI'), a.horario::text),
               'nivel', btrim(n.nome), 'tipo', pr.tipo_participacao, 'professor', pf.nome,
               'motivo', case when a.status_aula = 'cancelada' then a.motivo_cancelamento end,
               'status', case
                 when a.status_aula = 'cancelada' and a.motivo_cancelamento = 'Chuva' then 'chuva'
                 when a.status_aula = 'cancelada' then 'cancelada'
                 when a.data_aula > v_hoje then 'agendada'
                 when pr.status_presenca in ('falta', 'falta_justificada') then pr.status_presenca
                 when a.data_aula = v_hoje and coalesce(pr.status_presenca, '') <> 'presente' then 'agendada'
                 else 'presente' end) order by a.data_aula, t.horario_inicio)
        from presencas pr
        join aulas a on a.id = pr.aula_id and a.data_aula between v_ini and v_fim
        left join turmas t on t.id = a.turma_id
        left join niveis n on n.id = t.nivel_id
        left join modalidades m on m.id = t.modalidade_id
        left join professores pf on pf.id = coalesce(a.professor_executou_id, t.professor_titular_id)
       where pr.aluno_id = v_aluno.id and coalesce(m.nome, 'Tênis') = 'Tênis'), '[]'::jsonb)
  );
end $$;

-- Aluno cancela uma reposição agendada (até 2h antes): sai da aula e o crédito volta.
create or replace function repo_cancelar_agendamento(p_aluno_id uuid, p_telefone text, p_aula_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_aluno alunos;
  v_inicio timestamp;
  v_cred uuid;
begin
  select * into v_aluno from alunos where id = p_aluno_id and ativo;
  if v_aluno.id is null or not repo_tel_confere(v_aluno, p_telefone) then
    return jsonb_build_object('ok', false, 'codigo', 'nao_autorizado');
  end if;

  perform pg_advisory_xact_lock(hashtext('repo_aluno_' || p_aluno_id::text));
  select a.data_aula + t.horario_inicio into v_inicio
    from aulas a join turmas t on t.id = a.turma_id
   where a.id = p_aula_id and a.status_aula <> 'cancelada'
   for update of a;
  if v_inicio is null then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrada');
  end if;
  if v_inicio < repo_agora() + interval '2 hours' then
    return jsonb_build_object('ok', false, 'codigo', 'fora_do_prazo');
  end if;

  v_cred := repo_devolver_credito(p_aula_id, p_aluno_id, 'Cancelada pelo aluno');
  if v_cred is null then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrada');
  end if;
  delete from presencas where aula_id = p_aula_id and aluno_id = p_aluno_id and tipo_participacao = 'reposicao';

  return jsonb_build_object('ok', true,
    'saldo', (select count(*) from repo_creditos_validos where aluno_id = p_aluno_id));
end $$;

revoke all on function repo_devolver_credito(uuid, uuid, text) from public, anon;
revoke all on function repo_aula_chuva(uuid) from public, anon;
revoke all on function repo_aplicar_cancelamento_chuva(uuid) from public, anon;
grant execute on function repo_devolver_credito(uuid, uuid, text) to authenticated;
grant execute on function repo_aplicar_cancelamento_chuva(uuid) to authenticated;
grant execute on function repo_cancelar_agendamento(uuid, text, uuid) to anon, authenticated;
grant execute on function repo_painel(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------------------------
-- Correção das aulas de chuva de novembro (alunos que voltaram pra "presente" e créditos presos
-- em aula cancelada). Mostra o que mudou em cada aula.
-- ---------------------------------------------------------------------------------------------
select a.data_aula, to_char(t.horario_inicio, 'HH24:MI') as horario, btrim(n.nome) as nivel,
       repo_aplicar_cancelamento_chuva(a.id) as resultado
  from aulas a
  left join turmas t on t.id = a.turma_id
  left join niveis n on n.id = t.nivel_id
 where a.status_aula = 'cancelada' and a.motivo_cancelamento = 'Chuva' and a.data_aula >= '2026-11-01'
 order by a.data_aula, t.horario_inicio;
