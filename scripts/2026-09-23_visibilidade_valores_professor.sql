-- Interruptor pro gestor ocultar temporariamente, da visão do PRÓPRIO professor, os valores de
-- hora-aula/aula-dia (Financeiro do Professor, Dashboard do Professor) — pedido em 23/09:
-- toda vez que o gestor ajusta uma regra de cálculo, o valor muda em tempo real na tela do
-- professor e gera reclamação antes do fechamento estar pronto. Com isso oculto, o gestor
-- ativa de novo só quando o fechamento do mês estiver fechado. Não afeta a visão do próprio
-- gestor (tela Financeiro segue mostrando tudo normal sempre — é lá que fica o botão).
--
-- Tabela genérica de configuração (chave/valor) — dá pra reaproveisar pra outros liga/desliga
-- no futuro sem precisar de tabela nova cada vez.
--
-- Idempotente: pode rodar de novo sem problema.

create table if not exists configuracoes_app (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);

insert into configuracoes_app (chave, valor)
  values ('mostrar_valores_professor', 'true'::jsonb)
  on conflict (chave) do nothing;

alter table configuracoes_app enable row level security;
drop policy if exists "auth_configuracoes_app" on configuracoes_app;
create policy "auth_configuracoes_app" on configuracoes_app for all to authenticated using (true) with check (true);
