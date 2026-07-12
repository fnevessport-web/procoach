-- Item 9 (Fase 2) do módulo de Evolução Técnica: base pro fluxo de confirmação
-- multi-professor. Quando um aluno tem só 1 professor na modalidade, a avaliação nasce
-- 'confirmada' direto; com 2+ professores, nasce 'pendente' e uma linha é criada aqui pra
-- cada professor que falta confirmar (exceto quem avaliou). A lógica de decidir isso e de
-- disparar o alerta fica pro próximo item (10) — esta migration só cria a estrutura.

alter table avaliacoes_tecnicas
  add column if not exists status text not null default 'confirmada' check (status in ('confirmada', 'pendente'));

create table if not exists avaliacoes_tecnicas_confirmacoes (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid references avaliacoes_tecnicas(id) on delete cascade not null,
  professor_id uuid references professores(id) on delete cascade not null,
  confirmado_em timestamptz,
  criado_em timestamptz default now(),
  unique (avaliacao_id, professor_id)
);

alter table avaliacoes_tecnicas_confirmacoes enable row level security;

create policy "Auth users can manage avaliacoes_tecnicas_confirmacoes"
  on avaliacoes_tecnicas_confirmacoes for all to authenticated using (true) with check (true);

create index if not exists idx_avaliacoes_confirmacoes_avaliacao on avaliacoes_tecnicas_confirmacoes(avaliacao_id);
create index if not exists idx_avaliacoes_confirmacoes_professor on avaliacoes_tecnicas_confirmacoes(professor_id);
