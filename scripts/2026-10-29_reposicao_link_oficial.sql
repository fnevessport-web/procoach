-- Link oficial de reposição (/reposicao), integrado à grade REGULAR de Tênis.
--
-- O que muda em relação às rodadas de chuva (extras_*): o aluno agora agenda direto numa aula
-- da agenda oficial (aulas/presencas), consumindo os créditos de reposição que já existem em
-- `reposicoes` (gerados automaticamente quando uma aula é cancelada por Chuva).
--
-- Regras (todas conferidas aqui no banco, não só na tela):
--   * Só crédito de CHUVA, dentro do prazo (data_limite >= hoje). Outros casos: falar com a equipe.
--   * Identificação: telefone (do aluno ou dos responsáveis) + nome. O aluno confirma o nome completo.
--   * Grade: próximos 7 dias (hoje + 6), até 2h antes do início, só Tênis.
--   * Grupo: só turma que já tem aluno fixo naquele dia (sem turma "fantasma"), com professor,
--     respeitando a capacidade; nível igual ou 1 abaixo; Kids não entra em adulto e vice-versa.
--   * Individual: só turma individual existente, com professor, e vazia naquele dia (sem aluno
--     ou com o aluno fixo tendo avisado falta). Só pra quem tem crédito individual.
--   * Crédito individual pode ser usado em aula de grupo (a tela avisa); o de grupo não vira individual.
--   * Turma marcada como "turma de reposição" (eh_turma_reposicao) = grade extra (ex.: domingo de
--     reposição): entra mesmo vazia, com selo de "Aula extra".
--   * Presença com falta avisada (falta / falta_justificada) não ocupa vaga.
--
-- Como aplicar: rodar este arquivo inteiro no Supabase Dashboard → SQL Editor. É idempotente.
-- Segurança: o anon só acessa pelas funções SECURITY DEFINER abaixo; cada chamada revalida o
-- par aluno + telefone (não existe "sessão").

-- ---------------------------------------------------------------------------------------------
-- Colunas novas em reposicoes
-- ---------------------------------------------------------------------------------------------
alter table reposicoes add column if not exists agendado_via text;          -- 'link' quando veio do link público
alter table reposicoes add column if not exists agendado_em timestamptz;
-- Histórico do crédito: cada vez que a aula de reposição também é cancelada por chuva, o crédito
-- volta a ficar pendente e a aula perdida entra aqui ({aula_id, data_aula, motivo, em}).
alter table reposicoes add column if not exists historico jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------------------------
-- Lista de espera (ninguém achou horário na grade: a Procopio abre aula extra quando dá quórum)
-- ---------------------------------------------------------------------------------------------
create table if not exists reposicao_lista_espera (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references alunos(id) on delete set null,
  nome text not null,
  telefone text not null,
  nivel text,
  formato text,                                   -- 'grupo' / 'individual'
  dias text[] not null default '{}',              -- {'seg','ter',...}
  faixas text[] not null default '{}',            -- {'06-09','09-12','12-15','15-18','18-22'}
  observacao text,
  status text not null default 'aguardando' check (status in ('aguardando', 'atendido', 'cancelado')),
  criado_em timestamptz not null default now()
);
alter table reposicao_lista_espera enable row level security;
drop policy if exists "auth_reposicao_lista_espera" on reposicao_lista_espera;
create policy "auth_reposicao_lista_espera" on reposicao_lista_espera for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
create or replace function repo_norm(p text) returns text language sql immutable as $$
  select regexp_replace(
    translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z ]', ' ', 'g')
$$;

-- Últimos 8 dígitos do telefone (tolera com/sem 55, com/sem o 9 na frente).
create or replace function repo_tel8(p text) returns text language sql immutable as $$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 8
    then right(regexp_replace(p, '\D', '', 'g'), 8) end
$$;

create or replace function repo_tel_confere(p_aluno alunos, p_tel text) returns boolean language sql immutable as $$
  select repo_tel8(p_tel) is not null and repo_tel8(p_tel) in (
    repo_tel8(p_aluno.telefone), repo_tel8(p_aluno.telefone_responsavel), repo_tel8(p_aluno.telefone_responsavel_2))
$$;

-- Nome digitado combina com o cadastro: 1º nome igual e todas as outras palavras digitadas
-- aparecem no nome completo ("Joao Neves" → "João Ribeiro Neves").
create or replace function repo_nome_confere(p_cadastro text, p_digitado text) returns boolean language plpgsql immutable as $$
declare
  cad text[] := array(select x from unnest(string_to_array(repo_norm(p_cadastro), ' ')) x where length(x) > 0);
  dig text[] := array(select x from unnest(string_to_array(repo_norm(p_digitado), ' ')) x
                      where length(x) > 1 and x not in ('de', 'da', 'do', 'das', 'dos', 'e'));
begin
  if array_length(dig, 1) is null or array_length(cad, 1) is null then return false; end if;
  if dig[1] <> cad[1] then return false; end if;
  return dig <@ cad;
end $$;

-- Categoria e posição do nível na escada (pra regra "mesmo nível ou 1 abaixo").
create or replace function repo_nivel_cat(p text) returns text language sql immutable as $$
  select case
    when btrim(p) = 'Individual' then 'individual'
    when btrim(p) like 'Kids%' then 'kids'
    when btrim(p) in ('Iniciante', 'Iniciante 1', 'Iniciante 2', 'Intermediário', 'Intermediário 1', 'Intermediário 2', 'Avançado') then 'adulto'
    else 'especial' end                                                     -- Damas, Senior 60+
$$;

create or replace function repo_nivel_rank(p text) returns int language sql immutable as $$
  select case btrim(p)
    when 'Iniciante' then 1 when 'Iniciante 1' then 1 when 'Iniciante 2' then 2
    when 'Intermediário' then 3 when 'Intermediário 1' then 3 when 'Intermediário 2' then 4 when 'Avançado' then 5
    when 'Kids 1 - 4 a 6 anos' then 1 when 'Kids 2 - 7 a 10 anos' then 2
    when 'Kids Iniciante' then 3 when 'Kids Iniciante - 11 a 13 anos' then 3
    when 'Kids Intermediário' then 4 when 'Kids Intermediário - 11 a 13 anos' then 4
    when 'Kids Competitivo' then 5
    else null end
$$;

-- Mesma regra de capacidadeDoNivel (src/constants/modalidades.js).
create or replace function repo_capacidade(p text) returns int language sql immutable as $$
  select case
    when btrim(p) = 'Individual' then 1
    when btrim(p) not like 'Kids%' or btrim(p) like '%Competitivo%' then 4
    when btrim(p) like '%4 a 6%' then 8
    else 6 end
$$;

create or replace function repo_agora() returns timestamp language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')
$$;

-- Nível de referência do aluno: o mais alto entre as turmas de GRUPO ativas dele no Tênis;
-- sem turma de grupo, cai pro campo alunos.nivel.
create or replace function repo_nivel_aluno(p_aluno_id uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select btrim(n.nome) from turmas_alunos ta
       join turmas t on t.id = ta.turma_id and t.ativo
       join niveis n on n.id = t.nivel_id
       join modalidades m on m.id = t.modalidade_id and m.nome = 'Tênis'
      where ta.aluno_id = p_aluno_id and ta.ativo and btrim(n.nome) <> 'Individual'
      order by repo_nivel_rank(n.nome) desc nulls last limit 1),
    (select nivel from alunos where id = p_aluno_id))
$$;

-- Créditos de chuva válidos do aluno.
create or replace view repo_creditos_validos as
  select r.id, r.aluno_id, r.data_limite, r.historico, a.data_aula as data_origem,
         coalesce(to_char(t.horario_inicio, 'HH24:MI'), a.horario::text) as horario_origem,
         case when btrim(coalesce(n.nome, '')) = 'Individual' or a.observacoes ilike '%Individual%' then 'individual' else 'grupo' end as formato,
         btrim(n.nome) as nivel_origem
    from reposicoes r
    join aulas a on a.id = r.aula_origem_id
    left join turmas t on t.id = a.turma_id
    left join niveis n on n.id = t.nivel_id
   where r.status = 'pendente'
     and a.status_aula = 'cancelada' and a.motivo_cancelamento = 'Chuva'
     and (r.data_limite is null or r.data_limite >= (repo_agora())::date);
revoke all on repo_creditos_validos from anon;

-- ---------------------------------------------------------------------------------------------
-- 1) Identificação
-- ---------------------------------------------------------------------------------------------
-- Devolve só os cadastros cujo telefone E nome combinam (nunca lista nome de quem não bate).
create or replace function repo_identificar(p_nome text, p_telefone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_tel_bate int;
  v_lista jsonb;
begin
  if repo_tel8(p_telefone) is null or length(btrim(coalesce(p_nome, ''))) < 3 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;

  select count(*) into v_tel_bate from alunos al where al.ativo and repo_tel_confere(al, p_telefone);
  if v_tel_bate = 0 then
    return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado');
  end if;

  select jsonb_agg(jsonb_build_object('id', al.id, 'nome', btrim(al.nome)) order by al.nome) into v_lista
    from alunos al
   where al.ativo and repo_tel_confere(al, p_telefone) and repo_nome_confere(al.nome, p_nome);

  if v_lista is null then
    return jsonb_build_object('ok', false, 'codigo', 'nome_nao_confere');
  end if;
  return jsonb_build_object('ok', true, 'candidatos', v_lista);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2) Painel do aluno (turmas, créditos, agendadas, frequência do mês anterior + atual)
-- ---------------------------------------------------------------------------------------------
create or replace function repo_painel(p_aluno_id uuid, p_telefone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_aluno alunos;
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
    'outros_pendentes', (
      select count(*) from reposicoes r join aulas a on a.id = r.aula_origem_id
       where r.aluno_id = v_aluno.id and r.status = 'pendente'
         and not (a.status_aula = 'cancelada' and a.motivo_cancelamento = 'Chuva')),
    'agendadas', coalesce((
      select jsonb_agg(jsonb_build_object('aula_id', a.id, 'data', a.data_aula, 'horario', to_char(t.horario_inicio, 'HH24:MI'),
               'nivel', btrim(n.nome), 'professor', p.nome) order by a.data_aula, t.horario_inicio)
        from reposicoes r
        join aulas a on a.id = r.aula_reposicao_id and a.data_aula >= v_hoje and a.status_aula <> 'cancelada'
        join turmas t on t.id = a.turma_id
        left join niveis n on n.id = t.nivel_id
        left join professores p on p.id = coalesce(a.professor_executou_id, t.professor_titular_id)
       where r.aluno_id = v_aluno.id and r.status = 'agendada'), '[]'::jsonb),
    'frequencia', coalesce((
      select jsonb_agg(jsonb_build_object('data', a.data_aula,
               'horario', coalesce(to_char(t.horario_inicio, 'HH24:MI'), a.horario::text),
               'nivel', btrim(n.nome), 'tipo', pr.tipo_participacao,
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
       where pr.aluno_id = v_aluno.id and coalesce(m.nome, 'Tênis') = 'Tênis'), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3) Grade dos próximos 7 dias (só o que esse aluno pode agendar)
-- ---------------------------------------------------------------------------------------------
create or replace function repo_grade_base(p_aluno_id uuid)
returns table (aula_id uuid, data_aula date, horario text, nivel text, formato text, professor text, professor_foto text,
               capacidade int, ocupadas int, vagas int, extra boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_agora timestamp := repo_agora();
  v_nivel text := repo_nivel_aluno(p_aluno_id);
  v_cat text := repo_nivel_cat(v_nivel);
  v_rank int := repo_nivel_rank(v_nivel);
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
     -- não está já na aula, nem em outra aula ocupando o mesmo horário
     and not exists (select 1 from presencas p where p.aula_id = b.id and p.aluno_id = p_aluno_id)
     and not exists (select 1 from presencas p join aulas a2 on a2.id = p.aula_id left join turmas t2 on t2.id = a2.turma_id
                      where p.aluno_id = p_aluno_id and a2.data_aula = b.data_aula and t2.horario_inicio = b.horario_inicio
                        and a2.status_aula <> 'cancelada'
                        and coalesce(p.status_presenca, 'presente') not in ('falta', 'falta_justificada'))
     and (
       -- individual vazia, só pra quem tem crédito individual
       (b.nivel = 'Individual' and v_tem_ind and b.ocupadas = 0)
       or
       -- grupo: turma com aluno fixo naquele dia (ou grade extra), nível igual ou 1 abaixo
       (b.nivel <> 'Individual' and (b.fixos > 0 or b.extra) and (
          (v_cat in ('adulto', 'kids') and repo_nivel_cat(b.nivel) = v_cat
             and repo_nivel_rank(b.nivel) between v_rank - 1 and v_rank)
          or (v_cat = 'especial' and b.nivel = v_nivel)))
     );
end $$;

create or replace function repo_grade(p_aluno_id uuid, p_telefone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_aluno alunos;
begin
  select * into v_aluno from alunos where id = p_aluno_id and ativo;
  if v_aluno.id is null or not repo_tel_confere(v_aluno, p_telefone) then
    return jsonb_build_object('ok', false, 'codigo', 'nao_autorizado');
  end if;
  return jsonb_build_object('ok', true, 'aulas', coalesce((
    select jsonb_agg(to_jsonb(g) order by g.data_aula, g.horario, g.nivel) from repo_grade_base(p_aluno_id) g), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4) Agendar (grava na agenda oficial e dá baixa no crédito mais antigo)
-- ---------------------------------------------------------------------------------------------
create or replace function repo_agendar(p_aluno_id uuid, p_telefone text, p_aula_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_aluno alunos;
  v_aula_id uuid;
  v_g record;
  v_cred uuid;
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

  -- Serializa agendamentos do mesmo aluno e das mesmas aulas (dois cliques / duas pessoas).
  perform pg_advisory_xact_lock(hashtext('repo_aluno_' || p_aluno_id::text));
  perform 1 from aulas where id = any(p_aula_ids) order by id for update;

  if (select count(*) from repo_creditos_validos where aluno_id = p_aluno_id) < array_length(p_aula_ids, 1) then
    return jsonb_build_object('ok', false, 'codigo', 'sem_saldo');
  end if;

  foreach v_aula_id in array p_aula_ids loop
    select * into v_g from repo_grade_base(p_aluno_id) g where g.aula_id = v_aula_id;
    if v_g.aula_id is null then
      v_esgotadas := v_esgotadas || v_aula_id;
      continue;
    end if;

    -- individual usa crédito individual; grupo usa o de grupo e, se não tiver, o individual.
    select c.id into v_cred from repo_creditos_validos c
     where c.aluno_id = p_aluno_id
       and (c.formato = v_g.formato or (v_g.formato = 'grupo' and c.formato = 'individual'))
     order by (c.formato = v_g.formato) desc, c.data_limite nulls last, c.data_origem
     limit 1;
    if v_cred is null then
      return jsonb_build_object('ok', false, 'codigo', 'sem_saldo');
    end if;

    select coalesce(max(vaga_numero), 0) + 1 into v_vaga from presencas where aula_id = v_aula_id;
    insert into presencas (aula_id, aluno_id, presente, status_presenca, tipo_participacao, vaga_numero, criado_por_nome)
    values (v_aula_id, p_aluno_id, false, 'presente', 'reposicao', v_vaga, 'Link de reposição');

    update reposicoes set status = 'agendada', aula_reposicao_id = v_aula_id, agendado_via = 'link', agendado_em = now()
     where id = v_cred;

    v_feitos := v_feitos || jsonb_build_object('aula_id', v_aula_id, 'data', v_g.data_aula, 'horario', v_g.horario,
                  'nivel', v_g.nivel, 'professor', v_g.professor, 'extra', v_g.extra);
  end loop;

  if array_length(v_esgotadas, 1) is not null then
    -- Tudo ou nada: se algum horário lotou/saiu do ar, desfaz e devolve pra escolha.
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

-- ---------------------------------------------------------------------------------------------
-- 5) Lista de espera
-- ---------------------------------------------------------------------------------------------
create or replace function repo_lista_espera(p_aluno_id uuid, p_telefone text, p_dias text[], p_faixas text[], p_observacao text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_aluno alunos; v_id uuid;
begin
  select * into v_aluno from alunos where id = p_aluno_id and ativo;
  if v_aluno.id is null or not repo_tel_confere(v_aluno, p_telefone) then
    return jsonb_build_object('ok', false, 'codigo', 'nao_autorizado');
  end if;
  if coalesce(array_length(p_dias, 1), 0) = 0 or coalesce(array_length(p_faixas, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;
  insert into reposicao_lista_espera (aluno_id, nome, telefone, nivel, formato, dias, faixas, observacao)
  values (v_aluno.id, btrim(v_aluno.nome), p_telefone, repo_nivel_aluno(v_aluno.id),
          case when exists (select 1 from repo_creditos_validos c where c.aluno_id = v_aluno.id and c.formato = 'grupo') then 'grupo' else 'individual' end,
          p_dias, p_faixas, nullif(btrim(coalesce(p_observacao, '')), ''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

revoke all on function repo_grade_base(uuid) from public, anon;
revoke all on function repo_nivel_aluno(uuid) from public, anon;
grant execute on function repo_identificar(text, text) to anon, authenticated;
grant execute on function repo_painel(uuid, text) to anon, authenticated;
grant execute on function repo_grade(uuid, text) to anon, authenticated;
grant execute on function repo_agendar(uuid, text, uuid[]) to anon, authenticated;
grant execute on function repo_lista_espera(uuid, text, text[], text[], text) to anon, authenticated;
