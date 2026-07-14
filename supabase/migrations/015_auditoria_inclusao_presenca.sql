-- Rastreabilidade de quem incluiu um aluno numa aula (pedido depois de um caso em que um
-- aluno foi adicionado à lista de presença por uma professora sem que isso ficasse visível
-- pra ninguém além dela). Só vale daqui pra frente — presenças já existentes ficam com essas
-- colunas nulas, não há como reconstruir quem as criou.
alter table presencas add column if not exists criado_por text;
alter table presencas add column if not exists criado_por_nome text;
