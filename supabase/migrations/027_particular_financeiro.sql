-- Fase 3 do modo Particular: Financeiro (cobrança de aluno e de contratante terceiro),
-- vencimento, professor substituto com valor combinado. Reposição reaproveita a tabela
-- `reposicoes` já existente do clube sem alterar schema nenhum (filtra via join em
-- alunos.empresa_id/aulas.empresa_id).
--
-- Confirmado direto no banco antes de escrever isso: professores.cpf já é nullable (linhas
-- existentes sem CPF), então dá pra cadastrar colaborador do Particular sem CPF de clube.
-- pagamentos_alunos não existe ainda.

create table if not exists pagamentos_alunos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade not null,
  aluno_id uuid references alunos(id) on delete cascade not null,
  mes int not null, ano int not null,
  status text not null default 'pendente' check (status in ('pendente','pago')),
  data_pagamento date,
  comprovante_url text,
  comprovante_nome text,
  criado_em timestamptz default now(),
  unique (aluno_id, mes, ano)
);

create table if not exists pagamentos_contratantes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade not null,
  contratante_id uuid references contratantes(id) on delete cascade not null,
  mes int not null, ano int not null,
  status text not null default 'pendente' check (status in ('pendente','pago')),
  data_pagamento date,
  comprovante_url text,
  comprovante_nome text,
  criado_em timestamptz default now(),
  unique (contratante_id, mes, ano)
);

create index if not exists idx_pagamentos_alunos_empresa on pagamentos_alunos(empresa_id, mes, ano);
create index if not exists idx_pagamentos_contratantes_empresa on pagamentos_contratantes(empresa_id, mes, ano);

alter table pagamentos_alunos enable row level security;
alter table pagamentos_contratantes enable row level security;
drop policy if exists "auth_pagamentos_alunos" on pagamentos_alunos;
create policy "auth_pagamentos_alunos" on pagamentos_alunos for all to authenticated using (true) with check (true);
drop policy if exists "auth_pagamentos_contratantes" on pagamentos_contratantes;
create policy "auth_pagamentos_contratantes" on pagamentos_contratantes for all to authenticated using (true) with check (true);

-- Dia de vencimento (painel "cobrança chegando").
alter table alunos add column if not exists dia_vencimento int;

-- Professor substituto do Particular reaproveita a tabela professores já existente (mesmo
-- padrão de alunos/turmas — nullable, clube 100% intocado) + valor combinado padrão dele.
alter table professores add column if not exists empresa_id uuid references empresas(id);
alter table professores add column if not exists valor_aula_combinado numeric;
create index if not exists idx_professores_empresa_id on professores(empresa_id);

-- Quanto foi combinado de pagar ao substituto NESSA aula específica (pode divergir do padrão).
alter table aulas add column if not exists valor_substituto numeric;
