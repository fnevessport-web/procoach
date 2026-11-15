-- Aba "Eu" do link do torneio: ver e editar o próprio WhatsApp (pedido de 14/11 à noite).
--
-- Mesma regra da foto: o PRIMEIRO aparelho que salvar o telefone de um atleta fica "dono" dele
-- (token guardado no navegador). Esse aparelho pode trocar o número quando quiser; outro aparelho
-- não consegue (para ninguém mudar o WhatsApp de outra pessoa só escolhendo o nome dela).
-- Telefones que a mesa cadastrou não têm dono: o primeiro aparelho que editar vira o dono.
-- A mesa (tela da gestão) continua podendo trocar qualquer um.
--
-- Para ver, o link público recebe só o número MASCARADO ("final 8888"), nunca o número inteiro.
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.

create table if not exists campeonato_telefone_tokens (
  atleta_id  uuid primary key references campeonato_atletas(id) on delete cascade,
  token      text not null
);
alter table campeonato_telefone_tokens enable row level security;
-- sem policy: só as funções abaixo mexem nela.

create or replace function campeonato_meu_telefone(p_atleta_id uuid, p_token text)
returns table (final text, pode_editar boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_tel text; v_dono text;
begin
  select regexp_replace(telefone, '\D', '', 'g') into v_tel from campeonato_contatos where atleta_id = p_atleta_id;
  select token into v_dono from campeonato_telefone_tokens where atleta_id = p_atleta_id;
  return query select
    case when v_tel is null then null else right(v_tel, 4) end,
    (v_dono is null or v_dono = p_token);
end $$;
grant execute on function campeonato_meu_telefone(uuid, text) to anon, authenticated;

create or replace function campeonato_editar_telefone(p_atleta_id uuid, p_telefone text, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_dono text;
begin
  if length(v_tel) < 10 or length(v_tel) > 15 then
    raise exception 'Telefone inválido. Confira o código do país, o DDD e o número.';
  end if;
  if p_token is null or length(p_token) < 16 then
    raise exception 'Token inválido';
  end if;
  if not exists (
    select 1 from campeonato_atletas a join campeonatos c on c.id = a.campeonato_id
    where a.id = p_atleta_id and c.status <> 'encerrado'
  ) then
    raise exception 'Atleta não encontrado';
  end if;
  select token into v_dono from campeonato_telefone_tokens where atleta_id = p_atleta_id;
  if v_dono is not null and v_dono <> p_token then
    raise exception 'Este WhatsApp foi cadastrado por outro celular. Para trocar, fale com a mesa do torneio.';
  end if;
  insert into campeonato_contatos (atleta_id, telefone) values (p_atleta_id, v_tel)
    on conflict (atleta_id) do update set telefone = excluded.telefone;
  insert into campeonato_telefone_tokens (atleta_id, token) values (p_atleta_id, p_token)
    on conflict (atleta_id) do update set token = excluded.token;
end $$;
grant execute on function campeonato_editar_telefone(uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
