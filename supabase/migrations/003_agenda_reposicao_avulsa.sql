-- =============================================
-- ProCoach — Fase 2: agenda self-service (operada pela equipe) + reposição automática
-- =============================================
-- IMPORTANTE: rode este arquivo inteiro no Supabase Dashboard → SQL Editor. Não existe
-- conexão direta com o Postgres neste ambiente, então DDL precisa ser aplicado manualmente.

-- 1. Estende a tabela `reposicoes` que já existe (criada na Fase 0, em produção com dados
-- reais) — NÃO recria. modalidade_id fica nullable de propósito: as reposições antigas
-- (criadas antes desta migração) não têm como saber a modalidade sem uma consulta extra,
-- e isso não é feito aqui pra manter a migração simples e sem risco.
alter table reposicoes add column if not exists modalidade_id uuid references modalidades(id);
alter table reposicoes add column if not exists data_limite date;

-- Acha e remove qualquer check constraint da coluna `status` (não sabemos o nome exato do
-- constraint original, então procura dinamicamente em vez de arriscar um DROP CONSTRAINT
-- com nome errado) e recria incluindo o novo valor 'expirada'.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'reposicoes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table reposicoes drop constraint %I', con.conname);
  end loop;
end $$;

alter table reposicoes add constraint reposicoes_status_check
  check (status in ('pendente', 'agendada', 'expirada'));

-- `aulas.motivo_cancelamento` já existe (verificado direto no schema) — nada a fazer aqui.
-- Não criamos coluna `gera_reposicao_automatica`: a lista de motivos que contam como força
-- maior fica como constante no código (MOTIVOS_FORCA_MAIOR em src/hooks/useAulas.js), mais
-- simples de ajustar no futuro sem precisar de outra migração.

-- 2. Vagas avulsas — rastreia por que uma vaga específica (não recorrente) abriu, e se/quem
-- preencheu.
create table if not exists vagas_avulsas (
  id uuid primary key default gen_random_uuid(),
  aula_id uuid references aulas(id) on delete cascade not null,
  origem text not null check (origem in ('falta_avisada', 'cancelamento_parcial')),
  status text not null default 'aberta' check (status in ('aberta', 'preenchida', 'expirada')),
  aluno_preenchimento_id uuid references alunos(id),
  valor_cobrado numeric,
  created_at timestamptz default now()
);

create index if not exists idx_vagas_avulsas_aula on vagas_avulsas(aula_id);

-- Mesmo padrão de RLS de todo o resto do schema — sem isso, toda leitura/escrita feita
-- pelo app fica silenciosamente bloqueada (foi exatamente o bug que deixou `reposicoes`
-- vazia por semanas na Fase 0).
alter table vagas_avulsas enable row level security;
drop policy if exists "auth_vagas_avulsas" on vagas_avulsas;
create policy "auth_vagas_avulsas" on vagas_avulsas for all to authenticated using (true) with check (true);

-- 3. Mecanismo de concorrência: cada presença de agendamento self-service recebe um número
-- de vaga sequencial (1..capacidade). Um índice único parcial garante que dois cliques
-- simultâneos não consigam reservar o mesmo número — o segundo insert falha com erro de
-- unicidade (23505) e a aplicação trata isso como "vaga já preenchida, tente outro horário".
-- Fica NULL pras presenças dos fluxos já existentes (mensalista, avulso/reposição
-- cadastrados manualmente pela equipe), que não usam esse campo — não quebra nada.
alter table presencas add column if not exists vaga_numero smallint;

create unique index if not exists idx_presencas_aula_vaga
  on presencas(aula_id, vaga_numero)
  where vaga_numero is not null;
