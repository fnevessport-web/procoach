-- Reforço de horários de reposição de Tênis, pedido pelo clube em 22/09 (além dos já carregados
-- em 2026-09-21_grade_aulas_extras.sql): mais um horário em quarta e quinta, e o dia inteiro de
-- sexta-feira 25/09 (novo — sexta ainda não tinha reposição de Tênis, só aulas de presente).
-- Professor "a definir" (mesma convenção já usada na grade: aparece na tela como "Professor a definir").
--
-- Idempotente: reaproveita o índice único uq_extras_slots_grade criado em 2026-09-21 — se ele
-- ainda não existir (script rodado fora de ordem), cria aqui também. Rodar DEPOIS de
-- 2026-09-20_reposicao_extra_publica.sql e 2026-09-21_grade_aulas_extras.sql no SQL Editor.

create unique index if not exists uq_extras_slots_grade
  on extras_slots (tipo, modalidade, data_aula, horario_inicio, coalesce(quadra, ''), coalesce(nivel, ''));

insert into extras_slots (tipo, modalidade, data_aula, horario_inicio, horario_fim, quadra, professor, publico, nivel, formato, capacidade)
values
  ('reposicao', 'Tênis', '2026-09-23', '09:00', '10:00', 'Quadra Coberta', 'a definir', 'adulto', 'Iniciante', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-24', '09:00', '10:00', 'Quadra Coberta', 'a definir', 'adulto', null, 'individual', 1),

  ('reposicao', 'Tênis', '2026-09-25', '06:00', '07:00', 'Quadra Coberta', 'a definir', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-09-25', '07:00', '08:00', 'Quadra Coberta', 'a definir', 'adulto', 'Avançado', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-25', '08:00', '09:00', 'Quadra Coberta', 'a definir', 'adulto', 'Iniciante', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-25', '09:00', '10:00', 'Quadra Coberta', 'a definir', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-25', '12:00', '13:00', 'Quadra Coberta', 'a definir', 'adulto', 'Iniciante', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-25', '13:00', '14:00', 'Quadra Coberta', 'a definir', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-09-25', '14:00', '15:00', 'Quadra Coberta', 'a definir', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-09-25', '18:00', '19:00', 'Quadra Coberta', 'a definir', 'adulto', 'Iniciante', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-25', '19:00', '20:00', 'Quadra Coberta', 'a definir', 'adulto', 'Avançado', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-25', '20:00', '21:00', 'Quadra Coberta', 'a definir', 'adulto', 'Intermediário', 'grupo', 4)
on conflict (tipo, modalidade, data_aula, horario_inicio, coalesce(quadra, ''), coalesce(nivel, '')) do nothing;
