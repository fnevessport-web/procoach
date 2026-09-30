-- Tela "Organizar Grade" (/organizar-grade): rascunho de redistribuição dos professores de Tênis
-- na grade (arrastar professor pra turma, tirar professor da grade, reservar vaga pra professor
-- novo). É só um cenário de planejamento: NÃO altera turmas.professor_titular_id nem nada da
-- grade oficial.
--
-- Tabela própria (e não configuracoes_app) porque o cenário mostra quem sai da grade — não pode
-- ficar legível pra professor logado. Só gestor (role 'admin'/'gestor') e coordenador leem/gravam.
--
-- Rodar inteiro no Supabase Dashboard → SQL Editor. Idempotente.

create table if not exists cenarios_grade_professores (
  chave text primary key,                 -- hoje só existe 'principal'
  dados jsonb not null default '{}'::jsonb, -- { atribuicoes: {turma_id: prof}, novos: [...], desligados: [...] }
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

alter table cenarios_grade_professores enable row level security;

drop policy if exists "gestao_cenarios_grade" on cenarios_grade_professores;
create policy "gestao_cenarios_grade" on cenarios_grade_professores for all to authenticated
  using (exists (select 1 from perfis_usuario p where p.user_id = auth.uid() and p.role in ('admin', 'gestor', 'coordenador')))
  with check (exists (select 1 from perfis_usuario p where p.user_id = auth.uid() and p.role in ('admin', 'gestor', 'coordenador')));

revoke all on cenarios_grade_professores from anon;
