-- "Resetar torneio" (menu ⋮ na lista de Campeonatos), pedido de 14/11 à noite.
--
-- O reset apaga também os WhatsApps que os atletas informaram pelo celular (os da planilha ficam).
-- Esses telefones são os que têm "dono" em campeonato_telefone_tokens; para a gestão conseguir
-- ler e apagar esses registros, ela precisa de permissão na tabela (o link público continua sem
-- acesso direto: só pelas funções).
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.

drop policy if exists campeonato_telefone_tokens_gestao on campeonato_telefone_tokens;
create policy campeonato_telefone_tokens_gestao on campeonato_telefone_tokens for all to authenticated
  using (sou_gestao()) with check (sou_gestao());

drop policy if exists campeonato_foto_tokens_gestao on campeonato_foto_tokens;
create policy campeonato_foto_tokens_gestao on campeonato_foto_tokens for all to authenticated
  using (sou_gestao()) with check (sou_gestao());

notify pgrst, 'reload schema';
