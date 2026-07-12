-- Módulo Ranking "Pontuação Beyond" — item 1 da entrega (migration).
-- Escopo desta versão: só Tênis, mas toda tabela é genérica por modalidade_id, sem nada
-- hard-coded de Tênis — outras modalidades entram depois só cadastrando categorias novas.
--
-- Decisões de design (ver conversa):
-- - ranking_categorias é uma tabela NOVA, separada de `niveis` (que já existe e serve pra
--   grade de turma: Iniciante 1/2, Intermediário 1/2, Kids em vários cortes, Damas, Senior
--   etc.). O ranking colapsa isso em 3 categorias adultas (Iniciante/Intermediário/Avançado)
--   — o mapeamento "Iniciante 1 e 2 → Iniciante" fica na camada de aplicação (item 4), não
--   no banco. A tabela é genérica o bastante pra, no futuro, ganhar categorias equivalentes
--   pra Kids (Iniciante/Intermediário/Avançado dentro da faixa etária deles) sem alterar
--   schema — só cadastrando linhas novas.
-- - ranking_jogos.quadra_id referencia `quadras`, mesmo padrão de turmas.quadra_id (não é
--   texto livre).
-- - Hoje ninguém "aluno" tem login no ProCoach — só a equipe (admin/professor/leitura/
--   financeiro) opera as telas. Pra não precisar reescrever schema quando o clube liberar
--   acesso do aluno: `ranking_jogos.criado_por` e `ranking_jogo_participantes.confirmado_por`
--   referenciam auth.users(id) diretamente (mesmo padrão já usado em alertas.usuario_id/
--   mensagens.autor_id) — hoje só linhas de staff existem ali, no dia que o aluno logar ele
--   também vira uma linha em auth.users e os mesmos campos passam a valer pra ele, sem ALTER.
--   A confirmação do placar é por PARTICIPANTE (confirmado_em/confirmado_por), não um único
--   "aprovador" do jogo — mesmo padrão de avaliacoes_tecnicas_confirmacoes (migration 011):
--   hoje a equipe confirma em nome do adversário, no futuro o próprio aluno confirma.
-- - ranking_posicoes nunca sobrescreve ciclo antigo: cada ciclo (ex '2026-T3') gera sua
--   própria linha por aluno/modalidade/tipo_ranking/categoria/gênero — isso já é o histórico
--   de posições pedido no item 6, sem precisar de tabela extra. Só o ciclo vigente é
--   recalculado (upsert) a cada atualização.

-- ---------- alunos: gênero (data_nascimento já existe desde antes) ----------
alter table alunos
  add column if not exists genero text check (genero in ('masculino', 'feminino'));

-- ---------- categorias do ranking (colapsadas, adultas — Tênis nesta versão) ----------
create table if not exists ranking_categorias (
  id uuid primary key default gen_random_uuid(),
  modalidade_id uuid references modalidades(id) not null,
  nome text not null,
  ordem int not null default 0,
  ativo boolean default true,
  criado_em timestamptz default now(),
  unique (modalidade_id, nome)
);

-- ---------- torneios internos (peso dobro nos jogos, item 7 da entrega) ----------
create table if not exists ranking_torneios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  modalidade_id uuid references modalidades(id) not null,
  categoria_id uuid references ranking_categorias(id),
  data_inicio date not null,
  data_fim date,
  status text not null default 'planejado' check (status in ('planejado', 'em_andamento', 'encerrado', 'cancelado')),
  criado_em timestamptz default now()
);

-- ---------- jogos ----------
create table if not exists ranking_jogos (
  id uuid primary key default gen_random_uuid(),
  modalidade_id uuid references modalidades(id) not null,
  tipo text not null check (tipo in ('simples', 'dupla')),
  origem text not null default 'avulso' check (origem in ('avulso', 'torneio')),
  torneio_id uuid references ranking_torneios(id),
  data_jogo date not null,
  quadra_id uuid references quadras(id),
  placar text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'contestado', 'cancelado')),
  criado_por uuid references auth.users(id),
  data_limite_auto_aprovacao timestamptz,
  criado_em timestamptz default now()
);

-- ---------- participantes do jogo (1 linha por aluno; dupla = 4 linhas, 2 por lado) ----------
create table if not exists ranking_jogo_participantes (
  id uuid primary key default gen_random_uuid(),
  jogo_id uuid references ranking_jogos(id) on delete cascade not null,
  aluno_id uuid references alunos(id) on delete cascade not null,
  lado smallint not null check (lado in (1, 2)),
  resultado text check (resultado in ('vitoria', 'derrota', 'wo_vitoria', 'wo_derrota')),
  pontos_calculados numeric,
  confirmado_em timestamptz,
  confirmado_por uuid references auth.users(id),
  unique (jogo_id, aluno_id)
);

-- ---------- posições calculadas (histórico completo, uma linha nova por ciclo) ----------
create table if not exists ranking_posicoes (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references alunos(id) on delete cascade not null,
  modalidade_id uuid references modalidades(id) not null,
  tipo_ranking text not null check (tipo_ranking in ('geral', 'categoria')),
  categoria_id uuid references ranking_categorias(id),
  genero text not null check (genero in ('masculino', 'feminino')),
  ciclo text not null,
  pontuacao_beyond numeric,
  media numeric,
  num_jogos int not null default 0,
  nivel text check (nivel in ('Bronze', 'Prata', 'Ouro')),
  posicao int,
  atualizado_em timestamptz default now()
);

-- unique separado em dois índices parciais porque categoria_id é NULL no ranking geral, e
-- NULL nunca colide com NULL numa unique constraint normal do Postgres.
create unique index if not exists ranking_posicoes_geral_uq
  on ranking_posicoes (aluno_id, modalidade_id, tipo_ranking, genero, ciclo)
  where categoria_id is null;
create unique index if not exists ranking_posicoes_categoria_uq
  on ranking_posicoes (aluno_id, modalidade_id, tipo_ranking, categoria_id, genero, ciclo)
  where categoria_id is not null;

-- ---------- índices (janela de 90 dias e buscas por aluno/modalidade) ----------
create index if not exists idx_ranking_jogos_modalidade_data on ranking_jogos (modalidade_id, data_jogo);
create index if not exists idx_ranking_jogos_torneio on ranking_jogos (torneio_id);
create index if not exists idx_ranking_participantes_jogo on ranking_jogo_participantes (jogo_id);
create index if not exists idx_ranking_participantes_aluno on ranking_jogo_participantes (aluno_id);
create index if not exists idx_ranking_posicoes_aluno_modalidade on ranking_posicoes (aluno_id, modalidade_id);

-- ---------- RLS (mesmo padrão do resto do repo: autenticado = equipe confiável) ----------
alter table ranking_categorias enable row level security;
alter table ranking_torneios enable row level security;
alter table ranking_jogos enable row level security;
alter table ranking_jogo_participantes enable row level security;
alter table ranking_posicoes enable row level security;

create policy "Auth users can manage ranking_categorias" on ranking_categorias for all to authenticated using (true) with check (true);
create policy "Auth users can manage ranking_torneios" on ranking_torneios for all to authenticated using (true) with check (true);
create policy "Auth users can manage ranking_jogos" on ranking_jogos for all to authenticated using (true) with check (true);
create policy "Auth users can manage ranking_jogo_participantes" on ranking_jogo_participantes for all to authenticated using (true) with check (true);
create policy "Auth users can manage ranking_posicoes" on ranking_posicoes for all to authenticated using (true) with check (true);

-- ---------- categorias iniciais de Tênis (colapso dos níveis Iniciante 1/2, Intermediário 1/2, Avançado) ----------
insert into ranking_categorias (modalidade_id, nome, ordem)
select m.id, c.nome, c.ordem
from modalidades m
cross join (values ('Iniciante', 1), ('Intermediário', 2), ('Avançado', 3)) as c(nome, ordem)
where m.nome = 'Tênis'
on conflict (modalidade_id, nome) do nothing;
