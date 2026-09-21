-- Aulas extras por causa da chuva: página pública /reposicao (sem login).
--   1) Reposição de Tênis — até 2 aulas por pessoa neste primeiro momento.
--   2) Presente — 1 aula gratuita em cada uma das outras modalidades (1 por modalidade).
--
-- Fica DELIBERADAMENTE separado da agenda oficial (aulas/presencas/reposicoes): as grades extras
-- e os agendamentos moram só nestas tabelas, pra não misturar com as turmas oficiais. A equipe
-- confere os inscritos (aluno ativo? nome batendo?) e ajusta o saldo de reposição por fora.
--
-- Como aplicar: rodar este arquivo inteiro no Supabase Dashboard → SQL Editor (não há conexão
-- direta com o Postgres neste ambiente). É idempotente — pode rodar de novo sem quebrar.
--
-- Segurança: as tabelas ficam com RLS ligado e SEM policy pra anon — a página pública só
-- enxerga/escreve pelas funções SECURITY DEFINER lá embaixo (mesmo padrão de inscrever_evento).

-- ---------------------------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------------------------

-- Grade de horários oferecidos (carregada a partir da planilha do clube).
create table if not exists extras_slots (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('reposicao', 'presente')),
  modalidade text not null check (modalidade in ('Tênis', 'Beach Tennis', 'Futevôlei', 'Vôlei de Praia', 'Squash', 'Padel')),
  data_aula date not null,
  horario_inicio time not null,
  horario_fim time,
  quadra text,
  professor text,
  publico text not null default 'adulto' check (publico in ('adulto', 'kids')),
  nivel text,                                            -- Iniciante / Intermediário / Avançado (texto livre, só exibição)
  formato text check (formato in ('grupo', 'individual')),
  capacidade int not null check (capacidade > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists idx_extras_slots_tipo_data on extras_slots(tipo, data_aula);

-- Uma linha por envio do formulário. `chave` (nome normalizado + final do telefone) é o que
-- identifica "a mesma pessoa" entre envios — sem CPF/login, é a base dos limites.
create table if not exists extras_inscricoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  chave text not null,
  turma_atual jsonb not null,                            -- [{dias:['seg','qua'], horario:'19:00', formato:'grupo', nivel:'Iniciante 1'}]
  declaracao_em timestamptz,                             -- quando marcou "as informações são verdadeiras"
  conferencia text not null default 'pendente' check (conferencia in ('pendente', 'confirmado', 'nao_localizado')),
  observacao text,                                       -- anotação da equipe na conferência
  criado_em timestamptz not null default now()
);
create index if not exists idx_extras_inscricoes_chave on extras_inscricoes(chave);

create table if not exists extras_agendamentos (
  id uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references extras_inscricoes(id) on delete cascade,
  slot_id uuid not null references extras_slots(id),
  chave text not null,
  tipo text not null check (tipo in ('reposicao', 'presente')),
  modalidade text not null,
  status text not null default 'confirmado' check (status in ('confirmado', 'cancelado')),
  criado_em timestamptz not null default now()
);
create index if not exists idx_extras_agend_slot on extras_agendamentos(slot_id, status);
create index if not exists idx_extras_agend_chave on extras_agendamentos(chave, status);

-- Rede de segurança no banco: 1 aula de presente por modalidade por pessoa, mesmo que a
-- validação da função falhe ou alguém edite dados na mão.
create unique index if not exists uq_extras_presente_modalidade
  on extras_agendamentos(chave, modalidade)
  where tipo = 'presente' and status = 'confirmado';

alter table extras_slots enable row level security;
alter table extras_inscricoes enable row level security;
alter table extras_agendamentos enable row level security;

drop policy if exists "auth_extras_slots" on extras_slots;
create policy "auth_extras_slots" on extras_slots for all to authenticated using (true) with check (true);
drop policy if exists "auth_extras_inscricoes" on extras_inscricoes;
create policy "auth_extras_inscricoes" on extras_inscricoes for all to authenticated using (true) with check (true);
drop policy if exists "auth_extras_agendamentos" on extras_agendamentos;
create policy "auth_extras_agendamentos" on extras_agendamentos for all to authenticated using (true) with check (true);

revoke all on extras_slots, extras_inscricoes, extras_agendamentos from anon;

-- ---------------------------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------------------------

-- Nome sem acento/caixa/pontuação e com espaços colapsados — "João  da Silva" e "joao da silva"
-- viram a mesma chave.
create or replace function extras_norm(t text) returns text
language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(
    translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- Devolve a descrição do 1º choque de horário (ou null): entre os slots novos, contra o que a
-- pessoa já agendou (qualquer inscrição da mesma chave) e contra a turma atual dela (recorrente
-- por dia da semana — a aula original de Tênis). Aula sem horario_fim conta como 1h.
create or replace function extras_conflito(p_chave text, p_turma jsonb, p_slot_ids uuid[])
returns text language plpgsql stable as $$
declare
  v_msg text;
begin
  -- novo x novo e novo x já agendado
  select format('Você já tem %s no dia %s às %s, no mesmo horário de %s.',
                e.modalidade, to_char(e.data_aula, 'DD/MM'), left(e.horario_inicio::text, 5), n.modalidade)
    into v_msg
  from (
    select s.id, s.modalidade, s.data_aula, s.horario_inicio,
           coalesce(s.horario_fim, s.horario_inicio + interval '1 hour') as fim
    from extras_slots s where s.id = any(p_slot_ids)
  ) n
  join (
    select s.id, s.modalidade, s.data_aula, s.horario_inicio,
           coalesce(s.horario_fim, s.horario_inicio + interval '1 hour') as fim
    from extras_slots s where s.id = any(p_slot_ids)
    union all
    select s.id, s.modalidade, s.data_aula, s.horario_inicio,
           coalesce(s.horario_fim, s.horario_inicio + interval '1 hour')
    from extras_agendamentos a join extras_slots s on s.id = a.slot_id
    where a.chave = p_chave and a.status = 'confirmado'
  ) e on e.id <> n.id and e.data_aula = n.data_aula
     and e.horario_inicio < n.fim and n.horario_inicio < e.fim
  limit 1;
  if v_msg is not null then return v_msg; end if;

  -- novo x turma atual (aula semanal original)
  select format('O horário de %s do dia %s às %s coincide com a sua aula atual das %s.',
                n.modalidade, to_char(n.data_aula, 'DD/MM'), left(n.horario_inicio::text, 5),
                left((b ->> 'horario'), 5))
    into v_msg
  from (
    select s.modalidade, s.data_aula, s.horario_inicio,
           coalesce(s.horario_fim, s.horario_inicio + interval '1 hour') as fim
    from extras_slots s where s.id = any(p_slot_ids)
  ) n,
  jsonb_array_elements(p_turma) b,
  jsonb_array_elements_text(b -> 'dias') d
  where (case d when 'seg' then 1 when 'ter' then 2 when 'qua' then 3 when 'qui' then 4
                when 'sex' then 5 when 'sab' then 6 when 'dom' then 0 end) = extract(dow from n.data_aula)
    and (b ->> 'horario')::time < n.fim
    and n.horario_inicio < (b ->> 'horario')::time + interval '1 hour'
  limit 1;
  return v_msg;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Leitura pública: grade com vagas em tempo real (sem expor nenhuma inscrição)
-- ---------------------------------------------------------------------------------------------
create or replace function extras_vagas(p_tipo text default null)
returns table(
  slot_id uuid, tipo text, modalidade text, data_aula date, horario_inicio time, horario_fim time,
  quadra text, professor text, publico text, nivel text, formato text,
  capacidade int, confirmados int, vagas_restantes int
)
language sql stable security definer set search_path = public as $$
  select s.id, s.tipo, s.modalidade, s.data_aula, s.horario_inicio, s.horario_fim,
         s.quadra, s.professor, s.publico, s.nivel, s.formato, s.capacidade,
         (count(a.id) filter (where a.status = 'confirmado'))::int,
         (s.capacidade - count(a.id) filter (where a.status = 'confirmado'))::int
  from extras_slots s
  left join extras_agendamentos a on a.slot_id = s.id
  where s.ativo
    and (p_tipo is null or s.tipo = p_tipo)
    and (s.data_aula + s.horario_inicio) > (now() at time zone 'America/Sao_Paulo')
  group by s.id
  order by s.data_aula, s.horario_inicio, s.quadra;
$$;

-- ---------------------------------------------------------------------------------------------
-- Escrita pública 1: dados da pessoa + reposição de Tênis (0 a 2 horários)
-- Retorna jsonb: {ok:true, inscricao_id} ou {ok:false, codigo, mensagem, slot_ids?}
-- Nenhuma linha é gravada antes de TODAS as validações passarem (tudo-ou-nada).
-- ---------------------------------------------------------------------------------------------
create or replace function extras_confirmar_reposicao(
  p_nome text, p_telefone text, p_turma_atual jsonb, p_declaracao boolean, p_slot_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_limite constant int := 2;
  v_nome text := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_chave text;
  v_ids uuid[];
  v_id uuid;
  v_ja int;
  v_lotados uuid[];
  v_conf text;
  x uuid;
begin
  if array_length(string_to_array(v_nome, ' '), 1) is null or array_length(string_to_array(v_nome, ' '), 1) < 2 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos', 'mensagem', 'Informe o nome completo do aluno.');
  end if;
  if length(v_tel) not between 10 and 11 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos', 'mensagem', 'Informe um telefone válido com DDD.');
  end if;
  if p_turma_atual is null or jsonb_typeof(p_turma_atual) <> 'array' or jsonb_array_length(p_turma_atual) = 0 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos', 'mensagem', 'Informe a sua turma atual.');
  end if;
  if p_declaracao is not true then
    return jsonb_build_object('ok', false, 'codigo', 'declaracao', 'mensagem', 'Confirme a declaração para continuar.');
  end if;

  select coalesce(array_agg(distinct i order by i), '{}') into v_ids from unnest(coalesce(p_slot_ids, '{}')) i;
  v_chave := extras_norm(v_nome) || '|' || right(v_tel, 8);

  -- Serializa por pessoa e por horário (sempre em ordem, pra não dar deadlock entre requisições).
  perform pg_advisory_xact_lock(hashtextextended('extras:' || v_chave, 0));
  foreach x in array v_ids loop
    perform pg_advisory_xact_lock(hashtextextended(x::text, 0));
  end loop;

  if array_length(v_ids, 1) is not null then
    if (select count(*) from extras_slots s
        where s.id = any(v_ids) and s.tipo = 'reposicao' and s.ativo
          and (s.data_aula + s.horario_inicio) > (now() at time zone 'America/Sao_Paulo')) <> array_length(v_ids, 1) then
      return jsonb_build_object('ok', false, 'codigo', 'slot_invalido',
        'mensagem', 'Algum horário escolhido não está mais disponível. Atualize a lista e escolha novamente.');
    end if;

    select count(*) into v_ja from extras_agendamentos where chave = v_chave and tipo = 'reposicao' and status = 'confirmado';
    if v_ja + array_length(v_ids, 1) > c_limite then
      return jsonb_build_object('ok', false, 'codigo', 'limite_reposicao',
        'mensagem', case when v_ja = 0
          then format('Neste primeiro momento o limite é de %s aulas de reposição por pessoa.', c_limite)
          else format('Você já tem %s reposição(ões) agendada(s). Neste primeiro momento o limite é de %s por pessoa — as demais faremos em um novo agendamento.', v_ja, c_limite) end);
    end if;

    select array_agg(s.id) into v_lotados
    from extras_slots s
    where s.id = any(v_ids)
      and s.capacidade <= (select count(*) from extras_agendamentos a where a.slot_id = s.id and a.status = 'confirmado');
    if v_lotados is not null then
      return jsonb_build_object('ok', false, 'codigo', 'esgotado', 'slot_ids', to_jsonb(v_lotados),
        'mensagem', 'Um dos horários acabou de lotar. Escolha outro para continuar.');
    end if;

    v_conf := extras_conflito(v_chave, p_turma_atual, v_ids);
    if v_conf is not null then
      return jsonb_build_object('ok', false, 'codigo', 'conflito', 'mensagem', v_conf);
    end if;
  end if;

  insert into extras_inscricoes (nome, telefone, chave, turma_atual, declaracao_em)
  values (v_nome, v_tel, v_chave, p_turma_atual, now())
  returning id into v_id;

  if array_length(v_ids, 1) is not null then
    insert into extras_agendamentos (inscricao_id, slot_id, chave, tipo, modalidade)
    select v_id, s.id, v_chave, 'reposicao', s.modalidade from extras_slots s where s.id = any(v_ids);
  end if;

  return jsonb_build_object('ok', true, 'inscricao_id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Escrita pública 2: aulas de presente (1 por modalidade), amarradas à inscrição da etapa 1
-- ---------------------------------------------------------------------------------------------
create or replace function extras_confirmar_presente(p_inscricao_id uuid, p_slot_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_todas constant text[] := array['Beach Tennis', 'Futevôlei', 'Vôlei de Praia', 'Squash', 'Padel'];
  v_insc extras_inscricoes%rowtype;
  v_ids uuid[];
  v_novas text[];
  v_ja text[];
  v_restantes text[];
  v_lotados uuid[];
  v_conf text;
  x uuid;
begin
  select * into v_insc from extras_inscricoes where id = p_inscricao_id;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos', 'mensagem', 'Não encontramos o seu cadastro. Recomece pelo link.');
  end if;

  select coalesce(array_agg(distinct i order by i), '{}') into v_ids from unnest(coalesce(p_slot_ids, '{}')) i;
  if array_length(v_ids, 1) is null then
    return jsonb_build_object('ok', false, 'codigo', 'slot_invalido', 'mensagem', 'Escolha ao menos uma aula.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('extras:' || v_insc.chave, 0));
  foreach x in array v_ids loop
    perform pg_advisory_xact_lock(hashtextextended(x::text, 0));
  end loop;

  if (select count(*) from extras_slots s
      where s.id = any(v_ids) and s.tipo = 'presente' and s.ativo
        and (s.data_aula + s.horario_inicio) > (now() at time zone 'America/Sao_Paulo')) <> array_length(v_ids, 1) then
    return jsonb_build_object('ok', false, 'codigo', 'slot_invalido',
      'mensagem', 'Algum horário escolhido não está mais disponível. Atualize a lista e escolha novamente.');
  end if;

  select array_agg(s.modalidade order by s.modalidade) into v_novas from extras_slots s where s.id = any(v_ids);
  select coalesce(array_agg(modalidade), '{}') into v_ja
    from extras_agendamentos where chave = v_insc.chave and tipo = 'presente' and status = 'confirmado';

  -- 1 aula por modalidade: duas do mesmo esporte no pedido, ou esporte que ele já agendou antes.
  if (select count(distinct m) from unnest(v_novas) m) <> array_length(v_novas, 1) or v_novas && v_ja then
    select array_agg(m order by m) into v_restantes
      from unnest(c_todas) m where not (m = any(v_ja)) and not (m = any(v_novas));
    return jsonb_build_object('ok', false, 'codigo', 'limite_modalidade',
      'mensagem', 'O presente vale 1 aula por modalidade.',
      'ja_agendadas', to_jsonb(v_ja), 'restantes', to_jsonb(coalesce(v_restantes, '{}')));
  end if;

  select array_agg(s.id) into v_lotados
  from extras_slots s
  where s.id = any(v_ids)
    and s.capacidade <= (select count(*) from extras_agendamentos a where a.slot_id = s.id and a.status = 'confirmado');
  if v_lotados is not null then
    return jsonb_build_object('ok', false, 'codigo', 'esgotado', 'slot_ids', to_jsonb(v_lotados),
      'mensagem', 'Um dos horários acabou de lotar. Escolha outro para continuar.');
  end if;

  v_conf := extras_conflito(v_insc.chave, v_insc.turma_atual, v_ids);
  if v_conf is not null then
    return jsonb_build_object('ok', false, 'codigo', 'conflito', 'mensagem', v_conf);
  end if;

  insert into extras_agendamentos (inscricao_id, slot_id, chave, tipo, modalidade)
  select v_insc.id, s.id, v_insc.chave, 'presente', s.modalidade from extras_slots s where s.id = any(v_ids);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function extras_vagas(text) to anon, authenticated;
grant execute on function extras_confirmar_reposicao(text, text, jsonb, boolean, uuid[]) to anon, authenticated;
grant execute on function extras_confirmar_presente(uuid, uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Relatório pra equipe conferir (Supabase → Table Editor / SQL Editor): quem se inscreveu,
-- em quê, e se já foi conferido como aluno ativo. security_invoker = respeita o RLS de quem
-- consulta (anon não enxerga nada).
-- ---------------------------------------------------------------------------------------------
create or replace view extras_relatorio with (security_invoker = true) as
select i.criado_em as inscrito_em, i.nome, i.telefone, i.conferencia, i.observacao,
       a.tipo, a.modalidade, s.data_aula, s.horario_inicio, s.quadra, s.professor, s.nivel,
       a.status, i.turma_atual, i.declaracao_em, i.id as inscricao_id, a.id as agendamento_id
from extras_inscricoes i
left join extras_agendamentos a on a.inscricao_id = i.id
left join extras_slots s on s.id = a.slot_id
order by i.criado_em desc, s.data_aula, s.horario_inicio;

revoke all on extras_relatorio from anon;
