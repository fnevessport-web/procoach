-- View pública e segura pra mostrar foto do professor no link de reposição (sem login): a
-- tabela professores tem telefone/email/banco/agência/conta/pix/valor_hora_aula, que NUNCA pode
-- ir pro anon — por isso não dá pra simplesmente liberar RLS na tabela inteira. Essa view só
-- expõe id/nome/foto_url dos professores ativos, e só ela ganha grant pro anon.
--
-- Idempotente: pode rodar de novo sem problema. Rodar depois de qualquer script anterior.

create or replace view professores_publico as
  select id, nome, foto_url from professores where ativo = true;

grant select on professores_publico to anon, authenticated;
