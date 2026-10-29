-- Correções do link oficial de reposição (rodar DEPOIS de 2026-10-29_reposicao_link_oficial.sql).
--
-- 1) Identificação: nome certo basta. Se o telefone digitado não bater com nenhum dos cadastrados
--    (aluno, responsável 1 e 2), o aluno entra pelo nome mesmo e a tela pergunta se o telefone
--    do cadastro (mascarado, só os 4 últimos dígitos) continua certo, com opção de informar o
--    novo. O número novo vai pra fila `repo_telefone_atualizacoes` e a equipe aplica no
--    cadastro pela tela interna (/extra-reposicao → Link oficial → Telefones).
--    Como o telefone deixou de ser a "senha", repo_identificar agora devolve uma chave de sessão
--    (repo_sessoes, vale 12h) por candidato; as funções repo_painel/grade/agendar/lista_espera
--    continuam com o mesmo parâmetro p_telefone, que passa a receber essa chave (ou o telefone,
--    que segue funcionando).
-- 2) Segurança: repo_tel_confere devolvia NULL (e não false) quando o telefone não batia, e o
--    "if ... or not repo_tel_confere(...)" deixava passar. Agora sempre true/false.
-- 3) Nível: aluno com turmas em mais de uma categoria (ex.: Kids Iniciante + Iniciante 2 adulto)
--    só via a grade de uma delas. Agora vale cada turma de grupo dele (nível igual ou 1 abaixo
--    de qualquer uma).
--
-- Como aplicar: rodar este arquivo inteiro no Supabase → SQL Editor. Idempotente.

-- ---------------------------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------------------------
create table if not exists repo_sessoes (
  chave uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(id) on delete cascade,
  telefone_digitado text,
  telefone_confere boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table repo_sessoes enable row level security;              -- sem policy: só as funções acessam
revoke all on repo_sessoes from anon, authenticated;

create table if not exists repo_telefone_atualizacoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(id) on delete cascade,
  nome text not null,
  telefone_novo text not null,
  telefones_cadastrados jsonb not null default '{}'::jsonb,      -- foto do cadastro na hora do pedido
  status text not null default 'pendente' check (status in ('pendente', 'aplicado', 'descartado')),
  criado_em timestamptz not null default now()
);
alter table repo_telefone_atualizacoes enable row level security;
drop policy if exists "auth_repo_telefone_atualizacoes" on repo_telefone_atualizacoes;
create policy "auth_repo_telefone_atualizacoes" on repo_telefone_atualizacoes for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
-- Só telefone: o digitado bate com algum dos cadastrados? (sempre true/false, nunca NULL)
create or replace function repo_tel_bate(p_aluno alunos, p_tel text) returns boolean language sql immutable as $$
  select coalesce(repo_tel8(p_tel) is not null and repo_tel8(p_tel) in (
    coalesce(repo_tel8(p_aluno.telefone), '-'), coalesce(repo_tel8(p_aluno.telefone_responsavel), '-'),
    coalesce(repo_tel8(p_aluno.telefone_responsavel_2), '-')), false)
$$;

-- Credencial das funções públicas: chave de sessão do repo_identificar (12h) ou o próprio telefone.
create or replace function repo_tel_confere(p_aluno alunos, p_tel text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if p_aluno.id is null or p_tel is null then return false; end if;
  if p_tel ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return exists (select 1 from repo_sessoes s where s.chave = p_tel::uuid and s.aluno_id = p_aluno.id
                     and s.criado_em > now() - interval '12 hours');
  end if;
  return repo_tel_bate(p_aluno, p_tel);
end $$;

-- "(11) •••••-1234": mostra só DDD e os 4 últimos dígitos.
create or replace function repo_tel_mascara(p text) returns text language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if length(d) >= 12 and left(d, 2) = '55' then d := substr(d, 3); end if;
  if length(d) < 8 then return null; end if;
  if length(d) >= 10 then return '(' || left(d, 2) || ') ' || repeat('•', length(d) - 6) || '-' || right(d, 4); end if;
  return repeat('•', length(d) - 4) || '-' || right(d, 4);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 1) Identificação
-- ---------------------------------------------------------------------------------------------
-- Primeiro tenta nome + telefone. Sem nenhum, cai pra só o nome (até 5 cadastros; mais que isso
-- pede o nome completo). Cada candidato volta com a chave de sessão e os telefones mascarados.
create or replace function repo_identificar(p_nome text, p_telefone text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_ids uuid[];
  v_tel_confere boolean := true;
  v_al alunos;
  v_chave uuid;
  v_lista jsonb := '[]'::jsonb;
begin
  if repo_tel8(p_telefone) is null or length(btrim(coalesce(p_nome, ''))) < 3 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;

  delete from repo_sessoes where criado_em < now() - interval '2 days';

  select array_agg(al.id order by al.nome) into v_ids
    from alunos al where al.ativo and repo_tel_bate(al, p_telefone) and repo_nome_confere(al.nome, p_nome);

  if v_ids is null then
    v_tel_confere := false;
    select array_agg(al.id order by al.nome) into v_ids
      from alunos al where al.ativo and repo_nome_confere(al.nome, p_nome);
    if v_ids is null then
      return jsonb_build_object('ok', false, 'codigo', 'nao_encontrado');
    end if;
    if array_length(v_ids, 1) > 5 then
      return jsonb_build_object('ok', false, 'codigo', 'nome_ambiguo');
    end if;
  end if;

  for v_al in select * from alunos where id = any(v_ids) order by nome loop
    insert into repo_sessoes (aluno_id, telefone_digitado, telefone_confere)
    values (v_al.id, regexp_replace(p_telefone, '\D', '', 'g'), v_tel_confere) returning chave into v_chave;
    v_lista := v_lista || jsonb_build_object(
      'id', v_al.id, 'nome', btrim(v_al.nome), 'chave', v_chave, 'telefone_confere', v_tel_confere,
      'telefones', coalesce((select jsonb_agg(jsonb_build_object('tipo', x.tipo, 'mascara', x.m) order by x.ord)
         from (select 1 ord, 'aluno' tipo, repo_tel_mascara(v_al.telefone) m
               union all select 2, 'responsável', repo_tel_mascara(v_al.telefone_responsavel)
               union all select 3, 'responsável 2', repo_tel_mascara(v_al.telefone_responsavel_2)) x
        where x.m is not null), '[]'::jsonb));
  end loop;
  return jsonb_build_object('ok', true, 'telefone_confere', v_tel_confere, 'candidatos', v_lista);
end $$;

-- Aluno informa telefone novo: entra na fila pra equipe conferir e aplicar no cadastro.
create or replace function repo_atualizar_telefone(p_aluno_id uuid, p_telefone text, p_telefone_novo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_aluno alunos; v_novo text := regexp_replace(coalesce(p_telefone_novo, ''), '\D', '', 'g');
begin
  select * into v_aluno from alunos where id = p_aluno_id and ativo;
  if v_aluno.id is null or not repo_tel_confere(v_aluno, p_telefone) then
    return jsonb_build_object('ok', false, 'codigo', 'nao_autorizado');
  end if;
  if length(v_novo) < 10 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;
  if repo_tel_bate(v_aluno, v_novo) then
    return jsonb_build_object('ok', true, 'codigo', 'ja_cadastrado');
  end if;
  if not exists (select 1 from repo_telefone_atualizacoes
                  where aluno_id = v_aluno.id and status = 'pendente' and repo_tel8(telefone_novo) = repo_tel8(v_novo)) then
    insert into repo_telefone_atualizacoes (aluno_id, nome, telefone_novo, telefones_cadastrados)
    values (v_aluno.id, btrim(v_aluno.nome), v_novo, jsonb_build_object(
      'telefone', v_aluno.telefone, 'telefone_responsavel', v_aluno.telefone_responsavel,
      'telefone_responsavel_2', v_aluno.telefone_responsavel_2));
  end if;
  return jsonb_build_object('ok', true, 'codigo', 'registrado');
end $$;

-- Lista de espera: grava o telefone digitado (não a chave de sessão).
create or replace function repo_lista_espera(p_aluno_id uuid, p_telefone text, p_dias text[], p_faixas text[], p_observacao text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_aluno alunos; v_id uuid; v_tel text;
begin
  select * into v_aluno from alunos where id = p_aluno_id and ativo;
  if v_aluno.id is null or not repo_tel_confere(v_aluno, p_telefone) then
    return jsonb_build_object('ok', false, 'codigo', 'nao_autorizado');
  end if;
  if coalesce(array_length(p_dias, 1), 0) = 0 or coalesce(array_length(p_faixas, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;
  v_tel := p_telefone;
  if p_telefone ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select s.telefone_digitado into v_tel from repo_sessoes s where s.chave = p_telefone::uuid;
  end if;
  insert into reposicao_lista_espera (aluno_id, nome, telefone, nivel, formato, dias, faixas, observacao)
  values (v_aluno.id, btrim(v_aluno.nome), coalesce(v_tel, v_aluno.telefone, v_aluno.telefone_responsavel, ''), repo_nivel_aluno(v_aluno.id),
          case when exists (select 1 from repo_creditos_validos c where c.aluno_id = v_aluno.id and c.formato = 'grupo') then 'grupo' else 'individual' end,
          p_dias, p_faixas, nullif(btrim(coalesce(p_observacao, '')), ''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3) Nível: todas as turmas de grupo do aluno
-- ---------------------------------------------------------------------------------------------
-- Todos os níveis de referência do aluno: cada turma de GRUPO ativa no Tênis; sem nenhuma,
-- cai pro campo alunos.nivel.
create or replace function repo_niveis_aluno(p_aluno_id uuid) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(array(select distinct btrim(n.nome) from turmas_alunos ta
       join turmas t on t.id = ta.turma_id and t.ativo
       join niveis n on n.id = t.nivel_id
       join modalidades m on m.id = t.modalidade_id and m.nome = 'Tênis'
      where ta.aluno_id = p_aluno_id and ta.ativo and btrim(n.nome) <> 'Individual'), '{}'),
    array(select btrim(nivel) from alunos where id = p_aluno_id and nivel is not null))
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
           where (repo_nivel_cat(nv) in ('adulto', 'kids') and repo_nivel_cat(b.nivel) = repo_nivel_cat(nv)
                  and repo_nivel_rank(b.nivel) between repo_nivel_rank(nv) - 1 and repo_nivel_rank(nv))
              or (repo_nivel_cat(nv) = 'especial' and b.nivel = nv)))
     );
end $$;

-- ---------------------------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------------------------
revoke all on function repo_grade_base(uuid) from public, anon;
revoke all on function repo_niveis_aluno(uuid) from public, anon;
revoke all on function repo_tel_confere(alunos, text) from public, anon;
revoke all on function repo_tel_bate(alunos, text) from public, anon;
grant execute on function repo_identificar(text, text) to anon, authenticated;
grant execute on function repo_atualizar_telefone(uuid, text, text) to anon, authenticated;
grant execute on function repo_lista_espera(uuid, text, text[], text[], text) to anon, authenticated;
