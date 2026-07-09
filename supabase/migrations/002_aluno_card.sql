-- =============================================
-- ProCoach — Card do Aluno: dados pessoais, família e histórico de nível
-- =============================================
-- IMPORTANTE: rode este arquivo inteiro no Supabase Dashboard → SQL Editor.
-- Não existe conexão direta com o Postgres neste ambiente (só a REST API de
-- tabelas), então DDL (CREATE TABLE / ALTER TABLE) precisa ser aplicado manualmente.

-- 1. Novos campos em alunos — email já existe na tabela, não precisa adicionar.
alter table alunos add column if not exists cpf text;
alter table alunos add column if not exists data_nascimento date;
alter table alunos add column if not exists foto_url text;

-- 2. Vínculos familiares do aluno (cônjuge, filho, responsável).
-- nome_vinculo é sempre preenchido (mesmo que a pessoa não seja aluna cadastrada);
-- vinculo_aluno_id só é preenchido quando a pessoa vinculada também é aluna, pra
-- permitir navegar até o card dela a partir do vínculo.
create table if not exists aluno_familia (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references alunos(id) on delete cascade not null,
  vinculo_aluno_id uuid references alunos(id) on delete set null,
  nome_vinculo text not null,
  tipo_vinculo text not null check (tipo_vinculo in ('conjuge', 'filho', 'responsavel')),
  created_at timestamptz default now()
);

create index if not exists idx_aluno_familia_aluno on aluno_familia(aluno_id);

-- Mesmo padrão de RLS usado em todo o resto do schema (ver scripts/migrate.mjs) —
-- sem isso, toda leitura/escrita feita pelo app (que nunca usa a service key) é
-- silenciosamente bloqueada. Foi exatamente o bug que deixou a tabela `reposicoes`
-- vazia por semanas: RLS ligado sem nenhuma policy pra authenticated.
alter table aluno_familia enable row level security;
drop policy if exists "auth_aluno_familia" on aluno_familia;
create policy "auth_aluno_familia" on aluno_familia for all to authenticated using (true) with check (true);

-- 3. Histórico de nível por modalidade — nunca sobrescreve um registro existente,
-- sempre insere um novo. Só um registro "ativo" por aluno+modalidade por vez (a
-- aplicação é responsável por desativar o anterior ao criar um novo — não há
-- constraint de banco garantindo isso, pra manter a migração simples).
create table if not exists aluno_modalidade_nivel (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references alunos(id) on delete cascade not null,
  modalidade_id uuid references modalidades(id) not null,
  nivel text not null,
  data_inicio date not null default current_date,
  ativo boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_aluno_modalidade_nivel_aluno on aluno_modalidade_nivel(aluno_id, modalidade_id);

alter table aluno_modalidade_nivel enable row level security;
drop policy if exists "auth_aluno_modalidade_nivel" on aluno_modalidade_nivel;
create policy "auth_aluno_modalidade_nivel" on aluno_modalidade_nivel for all to authenticated using (true) with check (true);
