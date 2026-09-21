-- Grade das aulas extras (reposição de Tênis + presente nas outras modalidades), carregada da
-- planilha "Aulas de Tênis - Página2" (90 horários). Rodar DEPOIS de 2026-09-20_reposicao_extra_publica.sql.
--
-- Notas de interpretação da planilha:
--  * "Qtd de vagas" da planilha = capacidade liberada pra esse link (não a lotação da turma).
--  * Beach Tennis: a planilha trazia "Quinta 25/09, Sexta 26/09, Sábado 27/09"; confirmado pelo
--    clube que são Quinta 24, Sexta 25 e Sábado 26.
--  * Squash: horários de 30 em 30 min na mesma quadra → cada aula dura 30 min. Demais: 1h.
--  * Kids/Juvenil ficam com público 'kids' (cor Kids na tela); a faixa etária vai no texto do nível.
--  * Professores do Tênis informados pelo clube.
--
-- Idempotente: o índice único + ON CONFLICT DO NOTHING impedem duplicar se rodar de novo.
-- Pra corrigir um horário depois, edite/desative a linha em extras_slots (ativo = false) — não
-- apague se já houver agendamento nele.

create unique index if not exists uq_extras_slots_grade
  on extras_slots (tipo, modalidade, data_aula, horario_inicio, coalesce(quadra, ''), coalesce(nivel, ''));

insert into extras_slots (tipo, modalidade, data_aula, horario_inicio, horario_fim, quadra, professor, publico, nivel, formato, capacidade)
values
  ('reposicao', 'Tênis', '2026-09-23', '06:00', '07:00', 'Quadra Coberta', 'Eric', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-09-23', '07:00', '08:00', 'Quadra Coberta', 'Eric', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-23', '08:00', '09:00', 'Quadra Coberta', 'Eric', 'adulto', 'Avançado', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-23', '17:00', '18:00', 'Quadra Coberta', 'Nayara', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-09-23', '18:00', '19:00', 'Quadra Coberta', 'Nayara', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-23', '19:00', '20:00', 'Quadra Coberta', 'Nayara', 'adulto', 'Avançado', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-23', '20:00', '21:00', 'Quadra Coberta', 'Nayara', 'adulto', 'Iniciante', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-24', '06:00', '07:00', 'Quadra Coberta', 'João', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-24', '07:00', '08:00', 'Quadra Coberta', 'João', 'adulto', 'Iniciante', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-24', '08:00', '09:00', 'Quadra Coberta', 'João', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-24', '17:00', '18:00', 'Quadra Coberta', 'Nayara', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-09-24', '18:00', '19:00', 'Quadra Coberta', 'Nayara', 'adulto', 'Iniciante', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-24', '19:00', '20:00', 'Quadra Coberta', 'Nayara', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-24', '20:00', '21:00', 'Quadra Coberta', 'Nayara', 'adulto', 'Avançado', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-27', '08:00', '09:00', 'Quadra 4 Saibro', 'Marcelo', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-09-27', '09:00', '10:00', 'Quadra 4 Saibro', 'Marcelo', 'adulto', 'Iniciante', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-27', '10:00', '11:00', 'Quadra 4 Saibro', 'Marcelo', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-27', '11:00', '12:00', 'Quadra 4 Saibro', 'Marcelo', 'kids', '7 a 10 anos', 'grupo', 6),
  ('reposicao', 'Tênis', '2026-09-27', '12:00', '13:00', 'Quadra 4 Saibro', 'Bruno Borges', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-27', '13:00', '14:00', 'Quadra 4 Saibro', 'Bruno Borges', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-09-27', '14:00', '15:00', 'Quadra 4 Saibro', 'Bruno Borges', 'kids', 'Iniciante · 11 a 13 anos', 'grupo', 6),
  ('reposicao', 'Tênis', '2026-09-27', '15:00', '16:00', 'Quadra 4 Saibro', 'Bruno Borges', 'kids', 'Intermediário · 11 a 13 anos', 'grupo', 6),
  ('reposicao', 'Tênis', '2026-09-27', '08:00', '09:00', 'Quadra 3 Saibro', 'Charles', 'adulto', 'Avançado', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-27', '09:00', '10:00', 'Quadra 3 Saibro', 'Charles', 'adulto', null, 'individual', 1),
  ('reposicao', 'Tênis', '2026-09-27', '10:00', '11:00', 'Quadra 3 Saibro', 'Charles', 'kids', '4 a 6 anos', 'grupo', 8),
  ('reposicao', 'Tênis', '2026-09-27', '11:00', '12:00', 'Quadra 3 Saibro', 'Charles', 'kids', 'Competitivo', 'grupo', 6),
  ('reposicao', 'Tênis', '2026-09-27', '12:00', '13:00', 'Quadra 3 Saibro', 'Nayara', 'adulto', 'Iniciante', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-27', '13:00', '14:00', 'Quadra 3 Saibro', 'Nayara', 'adulto', 'Avançado', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-27', '14:00', '15:00', 'Quadra 3 Saibro', 'Nayara', 'adulto', 'Intermediário', 'grupo', 4),
  ('reposicao', 'Tênis', '2026-09-27', '15:00', '16:00', 'Quadra 3 Saibro', 'Nayara', 'adulto', 'Iniciante', 'grupo', 4),
  ('presente', 'Squash', '2026-09-24', '19:00', '19:30', 'Quadra de Squash', 'Dario', 'kids', '10 a 12 anos', 'grupo', 2),
  ('presente', 'Squash', '2026-09-24', '19:30', '20:00', 'Quadra de Squash', 'Dario', 'kids', '13 a 15 anos', 'grupo', 2),
  ('presente', 'Squash', '2026-09-24', '20:00', '20:30', 'Quadra de Squash', 'Dario', 'adulto', 'Iniciante', 'grupo', 2),
  ('presente', 'Squash', '2026-09-24', '20:30', '21:00', 'Quadra de Squash', 'Dario', 'adulto', 'Intermediário', 'grupo', 2),
  ('presente', 'Squash', '2026-09-24', '21:00', '21:30', 'Quadra de Squash', 'Dario', 'adulto', 'Avançado', 'grupo', 2),
  ('presente', 'Squash', '2026-09-24', '21:30', '22:00', 'Quadra de Squash', 'Dario', 'adulto', null, 'individual', 1),
  ('presente', 'Squash', '2026-09-25', '19:00', '19:30', 'Quadra de Squash', 'Dario', 'kids', '13 a 15 anos', 'grupo', 2),
  ('presente', 'Squash', '2026-09-25', '19:30', '20:00', 'Quadra de Squash', 'Dario', 'kids', '10 a 12 anos', 'grupo', 2),
  ('presente', 'Squash', '2026-09-25', '20:00', '20:30', 'Quadra de Squash', 'Dario', 'adulto', 'Iniciante', 'grupo', 2),
  ('presente', 'Squash', '2026-09-25', '20:30', '21:00', 'Quadra de Squash', 'Dario', 'adulto', 'Iniciante', 'grupo', 2),
  ('presente', 'Squash', '2026-09-25', '21:00', '21:30', 'Quadra de Squash', 'Dario', 'adulto', 'Intermediário', 'grupo', 2),
  ('presente', 'Squash', '2026-09-25', '21:30', '22:00', 'Quadra de Squash', 'Dario', 'adulto', null, 'individual', 1),
  ('presente', 'Padel', '2026-09-24', '06:00', '07:00', 'Quadra de Padel', 'Dani', 'adulto', 'Iniciante', 'grupo', 2),
  ('presente', 'Padel', '2026-09-24', '08:00', '09:00', 'Quadra de Padel', 'Dani', 'adulto', 'Avançado', 'grupo', 2),
  ('presente', 'Padel', '2026-09-24', '16:00', '17:00', 'Quadra de Padel', 'Marcelo', 'kids', 'Iniciante · 10 a 14 anos', 'grupo', 4),
  ('presente', 'Padel', '2026-09-24', '17:00', '18:00', 'Quadra de Padel', 'Marcelo', 'kids', 'Intermediário · 10 a 14 anos', 'grupo', 4),
  ('presente', 'Padel', '2026-09-24', '19:00', '20:00', 'Quadra de Padel', 'Marcelo', 'adulto', 'Intermediário', 'grupo', 3),
  ('presente', 'Padel', '2026-09-24', '20:00', '21:00', 'Quadra de Padel', 'Marcelo', 'adulto', 'Avançado', 'grupo', 4),
  ('presente', 'Padel', '2026-09-24', '21:00', '22:00', 'Quadra de Padel', 'Marcelo', 'adulto', 'Iniciante', 'grupo', 4),
  ('presente', 'Padel', '2026-09-25', '16:00', '17:00', 'Quadra de Padel', 'Marcelo', 'kids', 'Juvenil 15 a 16 anos', 'grupo', 4),
  ('presente', 'Padel', '2026-09-25', '17:00', '18:00', 'Quadra de Padel', 'Marcelo', 'adulto', 'Iniciante', 'grupo', 4),
  ('presente', 'Padel', '2026-09-25', '18:00', '19:00', 'Quadra de Padel', 'Marcelo', 'adulto', 'Intermediário', 'grupo', 2),
  ('presente', 'Padel', '2026-09-25', '19:00', '20:00', 'Quadra de Padel', 'Marcelo', 'adulto', 'Intermediário', 'grupo', 2),
  ('presente', 'Padel', '2026-09-25', '20:00', '21:00', 'Quadra de Padel', 'Marcelo', 'adulto', 'Iniciante', 'grupo', 2),
  ('presente', 'Vôlei de Praia', '2026-09-25', '16:00', '17:00', 'Quadra de Areia', 'Cigano', 'kids', '11 a 13 anos · Misto', 'grupo', 6),
  ('presente', 'Vôlei de Praia', '2026-09-25', '17:00', '18:00', 'Quadra de Areia', 'Cigano', 'kids', 'Juvenil 14 a 17 anos', 'grupo', 6),
  ('presente', 'Vôlei de Praia', '2026-09-25', '18:00', '19:00', 'Quadra de Areia', 'Cigano', 'adulto', 'Iniciante · Misto', 'grupo', 6),
  ('presente', 'Vôlei de Praia', '2026-09-25', '19:00', '20:00', 'Quadra de Areia', 'Cigano', 'adulto', 'Intermediário · Misto', 'grupo', 6),
  ('presente', 'Vôlei de Praia', '2026-09-25', '20:00', '21:00', 'Quadra de Areia', 'Cigano', 'adulto', 'Iniciante · Misto', 'grupo', 6),
  ('presente', 'Vôlei de Praia', '2026-09-26', '08:00', '09:00', 'Quadra de Areia', 'Cigano', 'adulto', 'Intermediário · Misto', 'grupo', 6),
  ('presente', 'Vôlei de Praia', '2026-09-26', '09:00', '10:00', 'Quadra de Areia', 'Cigano', 'adulto', 'Iniciante · Misto', 'grupo', 6),
  ('presente', 'Vôlei de Praia', '2026-09-26', '10:00', '11:00', 'Quadra de Areia', 'Cigano', 'kids', '11 a 13 anos · Misto', 'grupo', 6),
  ('presente', 'Vôlei de Praia', '2026-09-26', '11:00', '12:00', 'Quadra de Areia', 'Cigano', 'kids', 'Juvenil 14 a 17 anos', 'grupo', 6),
  ('presente', 'Vôlei de Praia', '2026-09-26', '12:00', '13:00', 'Quadra de Areia', 'Cigano', 'adulto', 'Intermediário · Misto', 'grupo', 6),
  ('presente', 'Futevôlei', '2026-09-25', '08:00', '09:00', 'Quadra de Areia', 'Gustavo', 'adulto', 'Intermediário · Masculino', 'grupo', 6),
  ('presente', 'Futevôlei', '2026-09-25', '09:00', '10:00', 'Quadra de Areia', 'Gustavo', 'adulto', 'Iniciante · Misto', 'grupo', 6),
  ('presente', 'Futevôlei', '2026-09-25', '16:00', '17:00', 'Quadra de Areia', 'Gustavo', 'kids', 'Juvenil 12 a 16 anos · Misto', 'grupo', 6),
  ('presente', 'Futevôlei', '2026-09-25', '17:00', '18:00', 'Quadra de Areia', 'Gustavo', 'adulto', 'Iniciante · Misto', 'grupo', 6),
  ('presente', 'Futevôlei', '2026-09-26', '08:00', '09:00', 'Quadra de Areia', 'Cigano', 'adulto', 'Iniciante · Misto', 'grupo', 6),
  ('presente', 'Futevôlei', '2026-09-26', '09:00', '10:00', 'Quadra de Areia', 'Cigano', 'adulto', 'Intermediário · Misto', 'grupo', 6),
  ('presente', 'Futevôlei', '2026-09-26', '10:00', '11:00', 'Quadra de Areia', 'Cigano', 'adulto', 'Iniciante · Misto', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-24', '07:00', '08:00', 'Quadra de Areia', 'Renato', 'adulto', 'Iniciante', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-24', '08:00', '09:00', 'Quadra de Areia', 'Renato', 'adulto', 'Iniciante', 'grupo', 4),
  ('presente', 'Beach Tennis', '2026-09-24', '09:00', '10:00', 'Quadra de Areia', 'Renato', 'adulto', 'Intermediário 1', 'grupo', 4),
  ('presente', 'Beach Tennis', '2026-09-24', '16:00', '17:00', 'Quadra de Areia', 'Renato', 'kids', 'Juvenil 14 a 16 anos', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-24', '17:00', '18:00', 'Quadra de Areia', 'Renato', 'kids', 'Intermediário · 10 a 13 anos', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-24', '18:00', '19:00', 'Quadra de Areia', 'Renato', 'adulto', 'Intermediário 1', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-24', '19:00', '20:00', 'Quadra de Areia', 'Renato', 'adulto', 'Iniciante', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-25', '07:00', '08:00', 'Quadra de Areia', 'Renato', 'adulto', 'Avançado', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-25', '08:00', '09:00', 'Quadra de Areia', 'Renato', 'adulto', 'Intermediário 2', 'grupo', 4),
  ('presente', 'Beach Tennis', '2026-09-25', '09:00', '10:00', 'Quadra de Areia', 'Renato', 'adulto', 'Iniciante', 'grupo', 4),
  ('presente', 'Beach Tennis', '2026-09-25', '16:00', '17:00', 'Quadra de Areia', 'Renato', 'kids', 'Iniciante · 10 a 13 anos', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-25', '17:00', '18:00', 'Quadra de Areia', 'Renato', 'kids', 'Juvenil 14 a 16 anos', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-25', '18:00', '19:00', 'Quadra de Areia', 'Renato', 'adulto', 'Iniciante', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-25', '19:00', '20:00', 'Quadra de Areia', 'Renato', 'adulto', 'Intermediário 2', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-26', '07:00', '08:00', 'Quadra de Areia', 'Renato', 'adulto', 'Avançado', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-26', '08:00', '09:00', 'Quadra de Areia', 'Renato', 'adulto', 'Iniciante', 'grupo', 4),
  ('presente', 'Beach Tennis', '2026-09-26', '09:00', '10:00', 'Quadra de Areia', 'Renato', 'adulto', 'Intermediário 1', 'grupo', 4),
  ('presente', 'Beach Tennis', '2026-09-26', '11:00', '12:00', 'Quadra de Areia', 'Renato', 'adulto', 'Intermediário 2', 'grupo', 6),
  ('presente', 'Beach Tennis', '2026-09-26', '12:00', '13:00', 'Quadra de Areia', 'Renato', 'kids', 'Juvenil 14 a 16 anos', 'grupo', 6)
on conflict (tipo, modalidade, data_aula, horario_inicio, coalesce(quadra, ''), coalesce(nivel, '')) do nothing;
