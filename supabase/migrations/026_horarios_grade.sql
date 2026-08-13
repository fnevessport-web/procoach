-- Grade de horários do clube configurável (Cadastro > Horários) — substitui os 3 arrays
-- hardcoded no JS (AulasCoordenador.jsx:406/:1397, AulasAdmin.jsx:946 — já inconsistentes entre
-- si, 16 vs 18 slots). Ver plano em C:\Users\fneve\.claude\plans\streamed-booping-canyon.md.
--
-- Confirmado direto no banco antes de escrever isso: tabela não existe ainda.
create table if not exists horarios_grade (
  id uuid primary key default gen_random_uuid(),
  horario time not null,
  dias_semana text[] not null default '{segunda,terca,quarta,quinta,sexta,sabado,domingo}',
  ativo boolean not null default true,
  criado_em timestamptz default now(),
  unique (horario)
);

-- Seed: os 16 horários hoje hardcoded (06:00-21:00), todos os dias — preserva o comportamento
-- atual da grade no primeiro carregamento, ninguém perde horário nenhum no dia da migração.
insert into horarios_grade (horario)
select (h || ':00')::time from generate_series(6, 21) as h
on conflict (horario) do nothing;

alter table horarios_grade enable row level security;
drop policy if exists "auth_horarios_grade" on horarios_grade;
create policy "auth_horarios_grade" on horarios_grade for all to authenticated using (true) with check (true);
