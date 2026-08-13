-- Fase 2 do modo "Particular": Cadastro de Aluno (com valor combinado) e Cadastro de
-- "contratante" (quem paga a aula: o próprio aluno, ou um terceiro tipo clube/empresa que
-- contrata o profissional direto). Ver plano em
-- C:\Users\fneve\.claude\plans\streamed-booping-canyon.md.
--
-- Confirmado direto no banco antes de escrever isso (mesma lição da 024 — nunca assumir,
-- sempre checar): alunos não tem empresa_id nem colunas de preço ainda; contratantes não
-- existe ainda.

create table if not exists contratantes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade not null,
  nome text not null,
  -- 'aluno' = cobra do aluno cadastrado (ex: "Particular"); 'terceiro' = cobra direto dessa
  -- entidade (clube/empresa que contrata o profissional), sem aluno nenhum envolvido.
  tipo text not null check (tipo in ('aluno','terceiro')),
  tipo_cobranca text check (tipo_cobranca in ('por_aula','fixo')),
  valor_hora_aula numeric,
  valor_fixo numeric,
  ativo boolean not null default true,
  criado_em timestamptz default now(),
  unique (empresa_id, nome)
);
create index if not exists idx_contratantes_empresa_id on contratantes(empresa_id);
alter table contratantes enable row level security;
drop policy if exists "auth_contratantes" on contratantes;
create policy "auth_contratantes" on contratantes for all to authenticated using (true) with check (true);

-- Reaproveita a tabela alunos já existente pro tenant Particular também (turmas_alunos,
-- presencas e avaliacoes_tecnicas já têm FK pra alunos.id — duplicar a tabela duplicaria todo
-- o subsistema de Evolução Técnica). NULL = aluno do clube, comportamento 100% intocado.
alter table alunos add column if not exists empresa_id uuid references empresas(id);
create index if not exists idx_alunos_empresa_id on alunos(empresa_id);

alter table alunos add column if not exists valor_aula numeric;
alter table alunos add column if not exists valor_fixo numeric;
alter table alunos add column if not exists tipo_cobranca text;
alter table alunos drop constraint if exists alunos_tipo_cobranca_check;
alter table alunos add constraint alunos_tipo_cobranca_check
  check (tipo_cobranca is null or tipo_cobranca in ('por_aula','fixo'));
alter table alunos add column if not exists direito_reposicao boolean;
-- todas nullable — clube nunca preenche essas colunas, comportamento intocado.

-- Quem paga cada aula/turma (aluno cadastrado via contratante 'aluno', ou terceiro direto).
alter table aulas add column if not exists contratante_id uuid references contratantes(id);
create index if not exists idx_aulas_contratante_id on aulas(contratante_id);
alter table turmas add column if not exists contratante_id uuid references contratantes(id);
create index if not exists idx_turmas_contratante_id on turmas(contratante_id);

-- Aula avulsa do modo Particular (turma_id null) não tem turmas.horario_inicio pra posicionar
-- na grade — precisa do próprio horário. Aula gerada de turma (mensal) continua null aqui e
-- usa turmas.horario_inicio como sempre; só a avulsa preenche este campo.
alter table aulas add column if not exists horario time;
