-- A tabela `reposicoes` tem RLS habilitada desde a Fase 0, mas a policy que devia liberar
-- escrita pra `authenticated` foi criada manualmente no SQL Editor (nunca virou migração) e,
-- em algum momento, deixou de existir/funcionar — confirmado em produção: nem um usuário
-- autenticado real (sem policy nenhuma bloqueando por role específico) conseguia INSERT,
-- só recebia "new row violates row-level security policy for table reposicoes". Efeito visível:
-- toda vez que alguém tentava marcar um aluno novo como "Reposição" numa aula (resolverReposicaoFIFO
-- em src/hooks/useAulas.js) ou salvar uma falta justificada, o insert/upsert falhava silenciosamente
-- ou com esse erro na tela.
--
-- Remove qualquer policy existente na tabela (nome desconhecido, já que a original nunca foi
-- versionada) e recria do zero, no mesmo padrão usado em toda tabela nova desde então.
do $$
declare
  pol record;
begin
  for pol in select polname from pg_policy where polrelid = 'reposicoes'::regclass loop
    execute format('drop policy %I on reposicoes', pol.polname);
  end loop;
end $$;

alter table reposicoes enable row level security;
create policy "auth_reposicoes" on reposicoes for all to authenticated using (true) with check (true);
