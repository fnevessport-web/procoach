-- Tira o status "pendente" da conferência de reposição extra: pedido do clube em 22/09 — quem
-- se inscreve pelo link já nasce como "confirmado" direto, sem precisar de uma conferência
-- manual extra pra esse primeiro passo. A equipe só muda pra "não localizado" se, na conferência,
-- o nome não bater com ninguém de verdade (ver painel "Fora do cadastro" na tela Extra Reposição).
--
-- Idempotente: pode rodar de novo sem problema. Rodar DEPOIS de
-- 2026-09-20_reposicao_extra_publica.sql no SQL Editor.

alter table extras_inscricoes alter column conferencia set default 'confirmado';

-- As inscrições já feitas que ainda estavam como "pendente" viram "confirmado" também (não
-- sobra nenhuma linha com o status antigo, então a tela nem precisa mais listar essa opção).
update extras_inscricoes set conferencia = 'confirmado' where conferencia = 'pendente';
