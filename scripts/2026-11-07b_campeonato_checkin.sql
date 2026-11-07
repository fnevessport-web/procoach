-- Check-in pelo próprio associado (link público do campeonato), pedido de 07/11/2026.
-- O associado escolhe o nome no link do QR code e toca em "Cheguei! Fazer meu check-in".
-- Só funciona antes do sorteio (status 'inscricoes'). A gestão continua podendo marcar e
-- desmarcar qualquer um na aba Atletas.
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.

create or replace function campeonato_checkin(p_atleta_id uuid, p_presente boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from campeonato_atletas a join campeonatos c on c.id = a.campeonato_id
    where a.id = p_atleta_id and a.situacao <> 'desistiu' and c.status = 'inscricoes'
  ) then
    raise exception 'O check-in já foi encerrado. Fale com a mesa do torneio.';
  end if;
  update campeonato_atletas set presente = coalesce(p_presente, true) where id = p_atleta_id;
end $$;
grant execute on function campeonato_checkin(uuid, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
