-- Ajustes da aba Campeonatos para o Mixed Doubles de 15/11/2026 (pedido de 14/11).
--
-- 1) Contato do parceiro SEM PIN: assim que a dupla é revelada no sorteio, o link público mostra
--    foto, nome e o botão de WhatsApp do parceiro, sem pedir os 4 últimos dígitos do telefone.
--    A função continua entregando só o telefone do PRÓPRIO parceiro, e só depois da revelação.
--    (O parâmetro p_final fica na assinatura só para compatibilidade; é ignorado.)
--
-- 2) Trava no banco contra sorteio duplicado: em 08/11 um toque duplo no botão de sortear gravou
--    32 duplas com pessoas repetidas. A tela já foi corrigida; estes índices garantem que, mesmo
--    que algo escape, o banco recusa uma 2ª dupla com o mesmo número ou um 2º jogo na mesma
--    posição da chave.
--
-- 3) Telefone pedido no check-in pelo celular para quem ainda não tem (ver item 3 abaixo).
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.

create or replace function campeonato_contato_parceiro(p_atleta_id uuid, p_final text)
returns table (nome text, telefone text)
language plpgsql security definer set search_path = public as $$
declare
  v_dupla record;
  v_parceiro uuid;
begin
  select d.numero, d.atleta1_id, d.atleta2_id, cp.status, cp.sorteio_revelados into v_dupla
  from campeonato_duplas d join campeonatos cp on cp.id = d.campeonato_id
  where p_atleta_id in (d.atleta1_id, d.atleta2_id)
  order by d.criado_em desc limit 1;
  if not found then
    raise exception 'Sua dupla ainda não foi sorteada.';
  end if;
  if v_dupla.status = 'sorteio' and v_dupla.numero > v_dupla.sorteio_revelados then
    raise exception 'Sua dupla ainda não foi revelada. Acompanhe o sorteio!';
  end if;

  v_parceiro := case when v_dupla.atleta1_id = p_atleta_id then v_dupla.atleta2_id else v_dupla.atleta1_id end;
  return query
    select a.nome, ct.telefone
    from campeonato_atletas a left join campeonato_contatos ct on ct.atleta_id = a.id
    where a.id = v_parceiro;
end $$;
grant execute on function campeonato_contato_parceiro(uuid, text) to anon, authenticated;

-- 3) Telefone no check-in: quem não tem WhatsApp cadastrado informa no próprio celular ao fazer o
--    check-in (país, DDD e número). O link público só consegue CRIAR o telefone de quem ainda não
--    tem; trocar um telefone já cadastrado continua sendo só pela mesa (tela da gestão).
create or replace function campeonato_tem_telefone(p_atleta_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campeonato_contatos where atleta_id = p_atleta_id)
$$;
grant execute on function campeonato_tem_telefone(uuid) to anon, authenticated;

create or replace function campeonato_salvar_telefone(p_atleta_id uuid, p_telefone text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
begin
  if length(v_tel) < 10 or length(v_tel) > 15 then
    raise exception 'Telefone inválido. Confira o código do país, o DDD e o número.';
  end if;
  if not exists (
    select 1 from campeonato_atletas a join campeonatos c on c.id = a.campeonato_id
    where a.id = p_atleta_id and c.status <> 'encerrado'
  ) then
    raise exception 'Atleta não encontrado';
  end if;
  if exists (select 1 from campeonato_contatos where atleta_id = p_atleta_id) then
    raise exception 'Seu telefone já está cadastrado. Para trocar, fale com a mesa do torneio.';
  end if;
  insert into campeonato_contatos (atleta_id, telefone) values (p_atleta_id, v_tel);
end $$;
grant execute on function campeonato_salvar_telefone(uuid, text) to anon, authenticated;

create unique index if not exists campeonato_duplas_numero_uniq on campeonato_duplas (campeonato_id, numero);
create unique index if not exists campeonato_jogos_posicao_uniq on campeonato_jogos (campeonato_id, fase, posicao);

notify pgrst, 'reload schema';
