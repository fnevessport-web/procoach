-- Segunda rodada da reposição extra de Tênis (chuva de set/2026), pedida pelo clube em 28/09.
-- Mesmo link público (/reposicao) e mesmas tabelas extras_*. Nesta rodada NÃO tem mais aula de
-- presente nas outras modalidades (o link deixou de oferecer essa etapa) — só reposição de Tênis.
--
-- O que este script faz:
--   1) Carrega a grade de quarta 30/09 e quinta 01/10 (Quadra Coberta, professor "a definir").
--   2) Já ocupa a aula individual de quarta 16h com o Rubens Gisbert Cury (pedido do clube).
--   3) Limite de 2 reposições passa a valer POR RODADA: só conta o que a pessoa agendou a partir
--      de 28/09. Sem isso, quem já tinha feito 2 reposições na primeira rodada ficaria travado.
--
-- A primeira rodada (aulas até 27/09, reposição e presente) continua no banco como histórico,
-- nada é apagado. Idempotente: pode rodar de novo sem duplicar nada.
-- Rodar inteiro no Supabase Dashboard → SQL Editor.

-- ---------------------------------------------------------------------------------------------
-- 1) Grade
-- ---------------------------------------------------------------------------------------------
create unique index if not exists uq_extras_slots_grade
  on extras_slots (tipo, modalidade, data_aula, horario_inicio, coalesce(quadra, ''), coalesce(nivel, ''));

insert into extras_slots (tipo, modalidade, data_aula, horario_inicio, horario_fim, quadra, professor, publico, nivel, formato, capacidade)
values
  -- Quarta 30/09
  ('reposicao', 'Tênis', '2026-09-30', '06:00', '07:00', 'Quadra Coberta', 'a definir', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-09-30', '07:00', '08:00', 'Quadra Coberta', 'a definir', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-30', '08:00', '09:00', 'Quadra Coberta', 'a definir', 'adulto', 'Avançado', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-30', '09:00', '10:00', 'Quadra Coberta', 'a definir', 'adulto', 'Iniciante', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-30', '16:00', '17:00', 'Quadra Coberta', 'a definir', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-09-30', '17:00', '18:00', 'Quadra Coberta', 'a definir', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-09-30', '18:00', '19:00', 'Quadra Coberta', 'a definir', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-30', '19:00', '20:00', 'Quadra Coberta', 'a definir', 'adulto', 'Avançado', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-30', '20:00', '21:00', 'Quadra Coberta', 'a definir', 'adulto', 'Iniciante', 'grupo', 4),
  -- Quinta 01/10
  ('reposicao', 'Tênis', '2026-10-01', '06:00', '07:00', 'Quadra Coberta', 'a definir', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-10-01', '07:00', '08:00', 'Quadra Coberta', 'a definir', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-10-01', '08:00', '09:00', 'Quadra Coberta', 'a definir', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-10-01', '09:00', '10:00', 'Quadra Coberta', 'a definir', 'adulto', 'Avançado', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-10-01', '17:00', '18:00', 'Quadra Coberta', 'a definir', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-10-01', '18:00', '19:00', 'Quadra Coberta', 'a definir', 'adulto', 'Iniciante', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-10-01', '19:00', '20:00', 'Quadra Coberta', 'a definir', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-10-01', '20:00', '21:00', 'Quadra Coberta', 'a definir', 'adulto', 'Avançado', 'grupo', 4)
on conflict (tipo, modalidade, data_aula, horario_inicio, coalesce(quadra, ''), coalesce(nivel, '')) do nothing;

-- ---------------------------------------------------------------------------------------------
-- 2) Rubens Gisbert Cury na individual de quarta 30/09 às 16h (nome igual ao cadastro de alunos)
-- ---------------------------------------------------------------------------------------------
insert into extras_inscricoes (nome, telefone, chave, turma_atual, declaracao_em, conferencia, observacao)
select 'Rubens Gisbert Cury', '', extras_norm('Rubens Gisbert Cury') || '|00000000', '[]'::jsonb, now(), 'confirmado',
       'Incluído pela equipe na 2ª rodada (individual qua 30/09 16h)'
where not exists (select 1 from extras_inscricoes where chave = extras_norm('Rubens Gisbert Cury') || '|00000000');

insert into extras_agendamentos (inscricao_id, slot_id, chave, tipo, modalidade, status)
select i.id, s.id, i.chave, 'reposicao', 'Tênis', 'confirmado'
from extras_inscricoes i, extras_slots s
where i.chave = extras_norm('Rubens Gisbert Cury') || '|00000000'
  and s.tipo = 'reposicao' and s.modalidade = 'Tênis' and s.data_aula = '2026-09-30' and s.horario_inicio = '16:00'
  and not exists (select 1 from extras_agendamentos a where a.slot_id = s.id and a.chave = i.chave and a.status = 'confirmado')
limit 1;

-- ---------------------------------------------------------------------------------------------
-- 3) Limite de 2 reposições por rodada (igual à versão de 2026-09-20, só muda a contagem v_ja)
-- ---------------------------------------------------------------------------------------------
create or replace function extras_confirmar_reposicao(
  p_nome text, p_telefone text, p_turma_atual jsonb, p_declaracao boolean, p_slot_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c_limite constant int := 2;
  -- Início da rodada atual: reposições em aulas antes desta data (rodada anterior) não contam no limite.
  c_inicio_rodada constant date := '2026-09-28';
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
  if v_tel ~ '^0*$' then v_tel := ''; end if;
  if v_tel <> '' and length(v_tel) not between 10 and 11 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos', 'mensagem', 'Informe um telefone válido com DDD.');
  end if;
  if p_turma_atual is null or jsonb_typeof(p_turma_atual) <> 'array' or jsonb_array_length(p_turma_atual) = 0 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos', 'mensagem', 'Informe a sua turma atual.');
  end if;
  if p_declaracao is not true then
    return jsonb_build_object('ok', false, 'codigo', 'declaracao', 'mensagem', 'Confirme a declaração para continuar.');
  end if;

  select coalesce(array_agg(distinct i order by i), '{}') into v_ids from unnest(coalesce(p_slot_ids, '{}')) i;
  v_chave := extras_norm(v_nome) || '|' || case when v_tel = '' then '00000000' else right(v_tel, 8) end;

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

    if exists (select 1 from extras_slots s where s.id = any(v_ids) and s.formato = 'individual')
       and not exists (select 1 from jsonb_array_elements(p_turma_atual) b where b ->> 'formato' = 'individual') then
      return jsonb_build_object('ok', false, 'codigo', 'formato_nao_permitido',
        'mensagem', 'As reposições em aula individual são para quem faz aula individual. Escolha uma aula em grupo.');
    end if;

    select count(*) into v_ja
    from extras_agendamentos a join extras_slots s on s.id = a.slot_id
    where a.chave = v_chave and a.tipo = 'reposicao' and a.status = 'confirmado' and s.data_aula >= c_inicio_rodada;
    if v_ja + array_length(v_ids, 1) > c_limite then
      return jsonb_build_object('ok', false, 'codigo', 'limite_reposicao',
        'mensagem', case when v_ja = 0
          then format('Neste momento o limite é de %s aulas de reposição por pessoa.', c_limite)
          else format('Você já tem %s reposição(ões) agendada(s) nesta rodada. O limite é de %s por pessoa.', v_ja, c_limite) end);
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

grant execute on function extras_confirmar_reposicao(text, text, jsonb, boolean, uuid[]) to anon, authenticated;
