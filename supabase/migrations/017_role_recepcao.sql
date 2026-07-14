-- Novo role "recepcao" — conta de recepção do clube, hoje travada como 'leitura' (só
-- consulta). Vai passar a poder abrir a grade de aulas, incluir aluno na lista de presença e
-- marcar presente/falta (ver podeIncluirAlunoAula em usePermissions.js), mas continua sem
-- acesso a nada administrativo (editar turma, mover horário, excluir aula, financeiro, etc.).
--
-- perfis_usuario_role_check hoje aceita ('admin','coordenador','professor','financeiro',
-- 'auxiliar','leitura') — confirmado direto no banco (testei um UPDATE pra 'recepcao' e a
-- constraint rejeitou). Recria com o mesmo conjunto + 'recepcao'.
alter table perfis_usuario drop constraint if exists perfis_usuario_role_check;
alter table perfis_usuario add constraint perfis_usuario_role_check
  check (role in ('admin', 'coordenador', 'professor', 'financeiro', 'auxiliar', 'leitura', 'recepcao'));
