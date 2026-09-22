-- Confirma o professor dos horários das 9h de quarta/quinta (reposição de Tênis), pedido pelo
-- clube em 22/09 — os dois nasceram "a definir" em 2026-09-22_grade_extra_reposicao.sql.
-- Idempotente: pode rodar de novo sem problema (UPDATE simples, sem efeito colateral se já
-- estiver com o valor certo). Já aplicado direto em produção; este script só documenta a mudança.

update extras_slots set professor = 'Eric'
  where tipo = 'reposicao' and modalidade = 'Tênis' and data_aula = '2026-09-23'
    and horario_inicio = '09:00' and quadra = 'Quadra Coberta';

update extras_slots set professor = 'João'
  where tipo = 'reposicao' and modalidade = 'Tênis' and data_aula = '2026-09-24'
    and horario_inicio = '09:00' and quadra = 'Quadra Coberta';
