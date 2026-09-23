-- Trava de segurança pedida pelo clube em 23/09: professor ganha por quantidade de aluno na
-- turma (ver TABELA_VALOR_GRUPO_POR_QTD em src/constants/modalidades.js), então um professor
-- de má-fé podia incluir um aluno extra sozinho e subir o próprio tier de pagamento sem
-- ninguém saber (ex.: turma de 2 alunos pagando R$100/hora -> ele inclui um 3º -> sobe pra
-- R$120, mesmo que esse 3º aluno não devesse contar).
--
-- Solução: quando quem inclui é professor (não coordenação/gestor/recepção), a presença nasce
-- 'pendente' com o motivo que ele digitou, e SÓ conta pro cálculo de pagamento
-- (qtdAlunosPagantes, em modalidades.js) depois que a coordenação aprova na tela nova
-- (AprovarInclusoesPage.jsx). Inclusão feita por qualquer outro papel continua exatamente como
-- sempre foi (status_inclusao_professor fica null, conta na hora, sem essa etapa extra).
--
-- Idempotente: pode rodar de novo sem problema.

alter table presencas add column if not exists status_inclusao_professor text
  check (status_inclusao_professor in ('pendente', 'aprovado', 'rejeitado'));
alter table presencas add column if not exists motivo_inclusao text;

comment on column presencas.status_inclusao_professor is
  'null = presença normal (matriculado de sempre, ou incluído por quem não é professor) — sempre conta pro pagamento. pendente = professor incluiu, aguardando aprovação da coordenação, NÃO conta. aprovado = coordenação confirmou, conta. rejeitado = coordenação recusou, não conta.';
comment on column presencas.motivo_inclusao is
  'motivo que o professor digitou ao incluir esse aluno (só preenchido quando status_inclusao_professor não é null).';
