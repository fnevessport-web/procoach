-- Tira a checagem de conflito contra a turma semanal normal do aluno (extras_conflito) —
-- exemplo real: Anne Brunelli, Iniciante 1, turma normal quarta 9h, tentou agendar a
-- REPOSIÇÃO de quarta 9h e foi bloqueada porque batia dia-da-semana+horário com a turma dela.
-- Isso é um falso positivo: as aulas extras são sessões à parte da grade oficial (tabelas
-- extras_*, nada a ver com a turma normal), e a maioria das reposições vai justamente cair no
-- mesmo horário de sempre do aluno, já que é esse horário que ele perdeu com a chuva. Pedido do
-- clube em 23/09: liberar pra qualquer pessoa, independente do horário da turma normal dela.
--
-- Mantém a outra checagem (extras x extras já escolhido/agendado — não dá pra estar em 2
-- aulas extras ao mesmo tempo de verdade). `p_turma` fica sem uso agora mas o parâmetro
-- continua na assinatura pra não quebrar quem já chama a função (extras_confirmar_reposicao/
-- extras_confirmar_presente passam p_turma_atual/v_insc.turma_atual do jeito que já era).
--
-- Idempotente: pode rodar de novo sem problema. Rodar depois dos scripts anteriores.

create or replace function extras_conflito(p_chave text, p_turma jsonb, p_slot_ids uuid[])
returns text language plpgsql stable as $$
declare
  v_msg text;
begin
  -- novo x novo e novo x já agendado (mesma pessoa não pode estar em 2 aulas extras ao mesmo
  -- horário de verdade) — essa checagem continua valendo.
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

  return v_msg;
end;
$$;
