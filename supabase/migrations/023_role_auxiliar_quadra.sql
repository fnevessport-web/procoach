-- Novo role "auxiliar_quadra" — auxiliares contratados pra tocar a Agenda no dia a dia
-- (chamada/falta dos alunos), com edição total da grade (turma, horário, alunos,
-- presença/falta), mas SEM poder excluir aula nem remover aluno sem confirmar um PIN
-- (ver PIN_EXCLUSAO_AGENDA em AulasCoordenador.jsx). Também vê a aba Disponibilidade.
-- Sem acesso a Cadastros, Financeiro nem Relatórios/KPIs (ver usePermissions.js).
--
-- Não reaproveita o role "auxiliar" existente porque esse é o fallback de segurança de
-- perfil incompleto (useAuth.js) e também o login do tablet compartilhado no balcão (só
-- leitura) — dar mais permissão a ele enfraqueceria essa proteção.
--
-- perfis_usuario_role_check hoje aceita ('admin','coordenador','professor','financeiro',
-- 'auxiliar','leitura','recepcao') — ver 017_role_recepcao.sql. Recria com o mesmo
-- conjunto + 'auxiliar_quadra'.
alter table perfis_usuario drop constraint if exists perfis_usuario_role_check;
alter table perfis_usuario add constraint perfis_usuario_role_check
  check (role in ('admin', 'coordenador', 'professor', 'financeiro', 'auxiliar', 'leitura', 'recepcao', 'auxiliar_quadra'));
