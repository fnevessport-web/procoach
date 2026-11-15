-- LINK DO OPERADOR da aba Campeonatos (pedido de 14/11 à noite, para o Mixed Doubles de 15/11).
--
-- Quem trabalha em quadra (sem login no ProCoach) abre /campeonato/<slug>/operador/<codigo> no
-- celular e só consegue: iniciar jogo, marcar os games, encerrar (automático ao fechar 2 sets),
-- lançar o resultado de um jogo e W.O. Todo o resto (atletas, sorteio, ordem, configuração)
-- continua só na tela da gestão.
--
-- Segurança:
--  * o código fica numa tabela própria, que só a gestão lê (a tabela campeonatos é pública, por
--    isso o código NÃO pode ficar nela);
--  * o operador grava por uma função que confere o código e só aceita os campos de placar/status
--    dos jogos DAQUELE torneio (nunca atletas, duplas, ordem, horário, configuração);
--  * "Gerar novo link" na tela da gestão troca o código e o link antigo para de funcionar.
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.

create table if not exists campeonato_operador_tokens (
  campeonato_id  uuid primary key references campeonatos(id) on delete cascade,
  token          text not null
);
alter table campeonato_operador_tokens enable row level security;
drop policy if exists campeonato_operador_tokens_gestao on campeonato_operador_tokens;
create policy campeonato_operador_tokens_gestao on campeonato_operador_tokens for all to authenticated
  using (sou_gestao()) with check (sou_gestao());

-- já cria o código dos torneios existentes
insert into campeonato_operador_tokens (campeonato_id, token)
select id, replace(gen_random_uuid()::text, '-', '') from campeonatos
on conflict (campeonato_id) do nothing;

create or replace function campeonato_operador_valido(p_slug text, p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from campeonatos c join campeonato_operador_tokens t on t.campeonato_id = c.id
    where c.slug = p_slug and t.token = p_token and length(coalesce(p_token, '')) >= 16
  )
$$;
grant execute on function campeonato_operador_valido(text, text) to anon, authenticated;

-- p_mudancas = [{ "id": <jogo>, "patch": { status, sets, vencedor_id, dupla_a_id, dupla_b_id,
-- iniciado_em, finalizado_em, quadra } }]  (a tela calcula o avanço na chave e manda tudo junto)
create or replace function campeonato_operador_salvar(p_slug text, p_token text, p_mudancas jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_camp uuid;
  m jsonb;
  p jsonb;
  v_id uuid;
  v_campo text;
begin
  select c.id into v_camp
  from campeonatos c join campeonato_operador_tokens t on t.campeonato_id = c.id
  where c.slug = p_slug and t.token = p_token and length(coalesce(p_token, '')) >= 16;
  if v_camp is null then
    raise exception 'Link de operador inválido. Peça o link novo para a organização.';
  end if;
  if not exists (select 1 from campeonatos where id = v_camp and status in ('sorteio', 'em_andamento')) then
    raise exception 'O torneio não está em andamento.';
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_mudancas, '[]'::jsonb)) loop
    v_id := (m->>'id')::uuid;
    p := coalesce(m->'patch', '{}'::jsonb);
    if not exists (select 1 from campeonato_jogos where id = v_id and campeonato_id = v_camp) then
      raise exception 'Jogo não encontrado neste torneio.';
    end if;
    foreach v_campo in array array['dupla_a_id', 'dupla_b_id', 'vencedor_id'] loop
      if p ? v_campo and p->>v_campo is not null and not exists (
        select 1 from campeonato_duplas where id = (p->>v_campo)::uuid and campeonato_id = v_camp
      ) then
        raise exception 'Dupla inválida.';
      end if;
    end loop;
    if p ? 'status' and p->>'status' not in ('agendado', 'ao_vivo', 'finalizado', 'wo', 'bye') then
      raise exception 'Status inválido.';
    end if;

    update campeonato_jogos set
      status        = case when p ? 'status' then p->>'status' else status end,
      sets          = case when p ? 'sets' then (case when jsonb_typeof(p->'sets') = 'array' then p->'sets' else '[]'::jsonb end) else sets end,
      vencedor_id   = case when p ? 'vencedor_id' then (p->>'vencedor_id')::uuid else vencedor_id end,
      dupla_a_id    = case when p ? 'dupla_a_id' then (p->>'dupla_a_id')::uuid else dupla_a_id end,
      dupla_b_id    = case when p ? 'dupla_b_id' then (p->>'dupla_b_id')::uuid else dupla_b_id end,
      iniciado_em   = case when p ? 'iniciado_em' then (p->>'iniciado_em')::timestamptz else iniciado_em end,
      finalizado_em = case when p ? 'finalizado_em' then (p->>'finalizado_em')::timestamptz else finalizado_em end,
      quadra        = case when p ? 'quadra' then p->>'quadra' else quadra end
    where id = v_id;
  end loop;
end $$;
grant execute on function campeonato_operador_salvar(text, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
