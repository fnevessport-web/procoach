-- =============================================
-- ProCoach — Fase 3: avaliação e evolução técnica do aluno
-- =============================================
-- IMPORTANTE: rode este arquivo inteiro no Supabase Dashboard → SQL Editor. Não existe
-- conexão direta com o Postgres neste ambiente, então DDL precisa ser aplicado manualmente.

-- 1. Avaliações técnicas — uma linha por avaliação lançada pelo professor. `dimensoes` é
-- um jsonb livre ({"saque": 3, "direita": 4, ...}) pra acompanhar o formulário dinâmico de
-- modalidade_dimensoes sem precisar alterar o schema quando as dimensões mudarem.
create table if not exists avaliacoes_tecnicas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references alunos(id) on delete cascade not null,
  modalidade_id uuid references modalidades(id) not null,
  professor_id uuid references professores(id) not null,
  data_avaliacao date not null default current_date,
  dimensoes jsonb not null default '{}'::jsonb,
  nota_geral numeric,
  nota_geral_manual boolean default false,
  comentario text,
  created_at timestamptz default now()
);

create index if not exists idx_avaliacoes_tecnicas_aluno_modalidade
  on avaliacoes_tecnicas(aluno_id, modalidade_id, data_avaliacao desc);

alter table avaliacoes_tecnicas enable row level security;
drop policy if exists "auth_avaliacoes_tecnicas" on avaliacoes_tecnicas;
create policy "auth_avaliacoes_tecnicas" on avaliacoes_tecnicas for all to authenticated using (true) with check (true);

-- 2. Dimensões técnicas por modalidade — define o formulário dinâmico de avaliação.
create table if not exists modalidade_dimensoes (
  id uuid primary key default gen_random_uuid(),
  modalidade_id uuid references modalidades(id) on delete cascade not null,
  nome_dimensao text not null,
  ordem integer not null default 0,
  peso numeric not null default 1
);

create index if not exists idx_modalidade_dimensoes_modalidade on modalidade_dimensoes(modalidade_id, ordem);

alter table modalidade_dimensoes enable row level security;
drop policy if exists "auth_modalidade_dimensoes" on modalidade_dimensoes;
create policy "auth_modalidade_dimensoes" on modalidade_dimensoes for all to authenticated using (true) with check (true);

-- Seed inicial — 5 a 6 dimensões por modalidade (usa o nome exato já cadastrado em
-- `modalidades`, então não depende de saber o uuid de cada uma).
insert into modalidade_dimensoes (modalidade_id, nome_dimensao, ordem, peso)
select m.id, d.nome, d.ordem, 1
from modalidades m
cross join lateral (
  values
    ('Saque', 1), ('Direita', 2), ('Esquerda', 3),
    ('Voleio', 4), ('Posicionamento', 5), ('Condicionamento', 6)
) as d(nome, ordem)
where m.nome = 'Tênis'
  and not exists (select 1 from modalidade_dimensoes existing where existing.modalidade_id = m.id);

insert into modalidade_dimensoes (modalidade_id, nome_dimensao, ordem, peso)
select m.id, d.nome, d.ordem, 1
from modalidades m
cross join lateral (
  values
    ('Saque', 1), ('Voleio', 2), ('Bandeja/Smash', 3),
    ('Posicionamento', 4), ('Condicionamento', 5)
) as d(nome, ordem)
where m.nome = 'Padel'
  and not exists (select 1 from modalidade_dimensoes existing where existing.modalidade_id = m.id);

insert into modalidade_dimensoes (modalidade_id, nome_dimensao, ordem, peso)
select m.id, d.nome, d.ordem, 1
from modalidades m
cross join lateral (
  values
    ('Saque', 1), ('Fundamentos de Rede', 2), ('Deslocamento', 3),
    ('Posicionamento', 4), ('Condicionamento', 5)
) as d(nome, ordem)
where m.nome = 'Beach Tennis'
  and not exists (select 1 from modalidade_dimensoes existing where existing.modalidade_id = m.id);

insert into modalidade_dimensoes (modalidade_id, nome_dimensao, ordem, peso)
select m.id, d.nome, d.ordem, 1
from modalidades m
cross join lateral (
  values
    ('Ataque', 1), ('Fundamentos de Rede', 2), ('Deslocamento', 3),
    ('Posicionamento', 4), ('Condicionamento', 5)
) as d(nome, ordem)
where m.nome = 'Futevôlei'
  and not exists (select 1 from modalidade_dimensoes existing where existing.modalidade_id = m.id);

insert into modalidade_dimensoes (modalidade_id, nome_dimensao, ordem, peso)
select m.id, d.nome, d.ordem, 1
from modalidades m
cross join lateral (
  values
    ('Saque', 1), ('Ataque', 2), ('Levantamento', 3),
    ('Deslocamento', 4), ('Posicionamento', 5), ('Condicionamento', 6)
) as d(nome, ordem)
where m.nome = 'Vôlei de Praia'
  and not exists (select 1 from modalidade_dimensoes existing where existing.modalidade_id = m.id);

-- 3. Badges (gamificação simples). `unique(aluno_id, tipo_badge)` deixa a concessão
-- idempotente (upsert com onConflict ignora se já foi concedido, sem duplicar).
create table if not exists badges_aluno (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references alunos(id) on delete cascade not null,
  tipo_badge text not null check (tipo_badge in ('primeira_aula', '10_aulas', 'evoluiu_nivel', '3_meses_sem_falta')),
  data_conquista timestamptz default now(),
  unique (aluno_id, tipo_badge)
);

alter table badges_aluno enable row level security;
drop policy if exists "auth_badges_aluno" on badges_aluno;
create policy "auth_badges_aluno" on badges_aluno for all to authenticated using (true) with check (true);
