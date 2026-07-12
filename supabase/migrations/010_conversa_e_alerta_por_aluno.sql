-- Item 6 (Fase 2 — coordenação entre professores) do módulo de Evolução Técnica.
-- Estende conversas/alertas, que já são genéricos (conversas.aula_id já existe pro padrão
-- "Discutir esta aula"), pra suportar o mesmo tipo de vínculo por aluno — usado quando um
-- professor quer falar sobre um aluno específico com os demais professores dele, e pro
-- alerta com duas ações (abrir conversa / abrir card do aluno) que vem nas próximas etapas.
-- Ambas nullable, mesmo padrão de conversas.aula_id: uma conversa/alerta só tem UM vínculo
-- de referência por vez (ou é de aula, ou é de aluno, ou é solta).

alter table conversas
  add column if not exists aluno_id uuid references alunos(id) on delete cascade;

alter table alertas
  add column if not exists aluno_id uuid references alunos(id) on delete cascade;

create index if not exists idx_conversas_aluno on conversas(aluno_id);
create index if not exists idx_alertas_aluno on alertas(aluno_id);
