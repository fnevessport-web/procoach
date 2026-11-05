-- Recados da equipe para os professores (pedido do coordenador em 05/11/2026).
--
-- Qualquer pessoa da equipe manda um recado para um ou mais professores. O recado aparece em
-- destaque no painel do professor. Dois tipos:
--   * avulso: só texto;
--   * turma: texto + aulas selecionadas na grade (aula_ids), para o professor ver a grade
--     completa com a sugestão marcada.
-- Ao fechar, o professor marca como lido ou deixa como não lido. Lido vai para a pasta "Lidos".
-- Recado de turma continua no painel até a data da última aula marcada (valido_ate), mesmo lido.
--
-- Um envio para vários professores vira uma linha por professor (mesmo grupo_id), para cada um
-- ter o próprio "lido".
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.

create table if not exists recados (
  id          uuid primary key default gen_random_uuid(),
  grupo_id    uuid not null,
  professor_id uuid not null references professores(id) on delete cascade,
  autor_id    uuid not null default auth.uid(),
  autor_nome  text,
  tipo        text not null default 'avulso' check (tipo in ('avulso', 'turma')),
  texto       text not null,
  aula_ids    uuid[] not null default '{}',
  valido_ate  date,
  lido_em     timestamptz,
  criado_em   timestamptz not null default now()
);
create index if not exists recados_professor_idx on recados (professor_id, criado_em desc);
create index if not exists recados_autor_idx on recados (autor_id, criado_em desc);
create index if not exists recados_grupo_idx on recados (grupo_id);

-- Quem é o professor do usuário logado, e se ele é da gestão (sem passar pela RLS de perfis).
create or replace function meu_professor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select professor_id from perfis_usuario where user_id = auth.uid() limit 1
$$;
create or replace function sou_gestao() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis_usuario where user_id = auth.uid() and role in ('admin', 'gestor', 'coordenador'))
$$;
grant execute on function meu_professor_id() to authenticated;
grant execute on function sou_gestao() to authenticated;

alter table recados enable row level security;

drop policy if exists recados_ver on recados;
create policy recados_ver on recados for select to authenticated
  using (autor_id = auth.uid() or professor_id = meu_professor_id() or sou_gestao());

drop policy if exists recados_criar on recados;
create policy recados_criar on recados for insert to authenticated
  with check (autor_id = auth.uid());

-- o professor marca lido/não lido; o autor e a gestão também podem editar
drop policy if exists recados_atualizar on recados;
create policy recados_atualizar on recados for update to authenticated
  using (professor_id = meu_professor_id() or autor_id = auth.uid() or sou_gestao());

drop policy if exists recados_apagar on recados;
create policy recados_apagar on recados for delete to authenticated
  using (autor_id = auth.uid() or sou_gestao());

notify pgrst, 'reload schema';
