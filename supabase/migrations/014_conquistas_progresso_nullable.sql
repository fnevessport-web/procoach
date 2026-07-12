-- Ajuste pequeno na migration 013: pra guardar o progresso de uma conquista ainda NÃO
-- desbloqueada (ex.: "47 de 100 aulas", pedido no item A.6 — barra de progresso no catálogo
-- bloqueado), a linha em conquistas_alunos precisa existir com desbloqueada_em vazio.
alter table conquistas_alunos alter column desbloqueada_em drop not null;
alter table conquistas_alunos alter column desbloqueada_em drop default;
