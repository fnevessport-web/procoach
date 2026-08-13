-- Fundação do modo "Particular" (profissional autônomo assinante) — tenant genuinamente
-- isolado do clube (Procópio/Beach Arena), dentro do mesmo app. Ver plano completo em
-- C:\Users\fneve\.claude\plans\streamed-booping-canyon.md.
--
-- src/hooks/useEmpresas.js já espera uma tabela usuario_empresas (comentário "fase de
-- transição") e src/App.jsx já sabe mostrar o seletor quando há mais de uma empresa vinculada
-- — essas tabelas só formalizam esse esqueleto que já existia, sem tocar em nenhuma linha de
-- dado existente do clube (quem não ganhar linha em usuario_empresas continua exatamente igual).

-- Tenants. 'clube' = negócio de hoje (Procópio/Beach Arena juntos, sem separação aqui).
-- 'particular' = profissional autônomo assinante.
--
-- IMPORTANTE: empresas/usuario_empresas JÁ EXISTEM em produção (criadas antes, fora do
-- controle de migrations — "Beyond" é a única empresa hoje, com 2 vínculos de gestor pro
-- Fernando). Por isso aqui é ALTER na tabela existente, não CREATE — um "create table if not
-- exists" teria sido no-op silencioso e não adicionaria a coluna tipo (foi exatamente o erro
-- que aconteceu na primeira tentativa dessa migração).
create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  logo_url text,
  ativo boolean not null default true, -- billing/trava por inadimplência fica pra fase futura
  criado_em timestamptz default now()
);
alter table empresas add column if not exists tipo text;
-- Backfill: toda empresa que já existia (a "Beyond") é do tipo clube — só passa a ter esse
-- valor explícito agora, nada muda de comportamento pra quem já usa.
update empresas set tipo = 'clube' where tipo is null;
alter table empresas alter column tipo set not null;
alter table empresas drop constraint if exists empresas_tipo_check;
alter table empresas add constraint empresas_tipo_check check (tipo in ('clube','particular'));

create table if not exists usuario_empresas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  empresa_id uuid references empresas(id) on delete cascade not null,
  role text not null,
  criado_em timestamptz default now()
);
-- Role já em uso hoje na tabela existente é 'gestor' (não 'admin' — diferente do valor
-- histórico gravado em perfis_usuario.role) — a lista abaixo cobre os dois pra não travar em
-- nenhum dos dois lugares onde esse role pode aparecer.
alter table usuario_empresas drop constraint if exists usuario_empresas_role_check;
alter table usuario_empresas add constraint usuario_empresas_role_check check (role in
  ('admin', 'gestor', 'coordenador', 'professor', 'financeiro', 'auxiliar', 'leitura', 'recepcao', 'auxiliar_quadra', 'dono_particular'));
create unique index if not exists idx_usuario_empresas_user_empresa on usuario_empresas(user_id, empresa_id);

alter table empresas enable row level security;
alter table usuario_empresas enable row level security;
drop policy if exists "auth_empresas" on empresas;
create policy "auth_empresas" on empresas for all to authenticated using (true) with check (true);
drop policy if exists "auth_usuario_empresas" on usuario_empresas;
create policy "auth_usuario_empresas" on usuario_empresas for all to authenticated using (true) with check (true);
-- Nota: mesmo padrão "autenticado, using(true)" já usado em toda tabela do projeto — isolamento
-- real entre tenants hoje é 100% por filtro de query (ver useTurmas.js/useAulas.js), não por RLS
-- de verdade. Precisa virar RLS de verdade antes de colocar o primeiro profissional PAGANTE real.

-- Escopo de turma/aula pro tenant particular. NULL = turma/aula do clube (comportamento de
-- hoje, nenhuma linha existente é tocada).
alter table turmas add column if not exists empresa_id uuid references empresas(id);
alter table aulas  add column if not exists empresa_id uuid references empresas(id);
create index if not exists idx_turmas_empresa_id on turmas(empresa_id);
create index if not exists idx_aulas_empresa_id on aulas(empresa_id);

-- Defensivo: turma do modo Particular é criada só com nome (sem quadra/horário/professor
-- titular) e ganha horário depois, ao ser posicionada no grid — garante que essas colunas
-- aceitam NULL mesmo que a constraint original do banco não tivesse isso explícito. Não dá erro
-- nem muda nada se a coluna já era nullable.
alter table turmas alter column quadra_id drop not null;
alter table turmas alter column professor_titular_id drop not null;
alter table turmas alter column horario_dia_semana drop not null;
alter table turmas alter column horario_inicio drop not null;
-- Aula gerada de uma turma Particular sem professor titular definido (Fase 1 não tem cadastro
-- de professor substituto ainda) também nasce sem professor_executou_id.
alter table aulas alter column professor_executou_id drop not null;

-- Grade de horários configurável POR TENANT (não é mais array fixo no JS) — cada profissional
-- particular tem a própria lista, editável (adicionar horário fora de 6h-22h, remover um que
-- nunca vai usar).
create table if not exists horarios_agenda (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade not null,
  horario time not null,
  ativo boolean not null default true, -- "excluir horário que nunca vai usar" = soft delete
  criado_em timestamptz default now(),
  unique (empresa_id, horario)
);

-- Congelamento pontual (não recorrente) de uma célula dia+horário específica (ex: tempo de
-- deslocação entre locais de aula).
create table if not exists bloqueios_agenda (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade not null,
  data date not null,
  horario time not null,
  motivo text,
  criado_em timestamptz default now(),
  unique (empresa_id, data, horario)
);

alter table horarios_agenda enable row level security;
alter table bloqueios_agenda enable row level security;
drop policy if exists "auth_horarios_agenda" on horarios_agenda;
create policy "auth_horarios_agenda" on horarios_agenda for all to authenticated using (true) with check (true);
drop policy if exists "auth_bloqueios_agenda" on bloqueios_agenda;
create policy "auth_bloqueios_agenda" on bloqueios_agenda for all to authenticated using (true) with check (true);

-- Não precisa criar uma empresa-âncora "clube" nova — a "Beyond" já existente (backfillada pra
-- tipo='clube' acima) já serve esse papel. O seed de teste do Homer (fora desta migração) vai
-- linkar ele nela pra dar as 2 opções na tela de login.
