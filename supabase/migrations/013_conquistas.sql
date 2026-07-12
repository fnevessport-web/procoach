-- Módulo de Conquistas — item A.3 da entrega. Cria o catálogo de 40 metas (populado a partir
-- de src/assets/conquistas/conquistas_config.json — o JSON é a fonte de verdade; se ele mudar,
-- os campos aqui embaixo têm que mudar junto) e a tabela que registra o progresso de cada
-- aluno em cada uma.
--
-- 3 tipos de conquista (campo `tipo`):
-- - marco: permanente, desbloqueia uma vez e fica pra sempre.
-- - dinamico: reflete status atual, pode ser perdido (ex: nível Ouro, Nº 1 do ranking) — a
--   coluna `ativa` de conquistas_alunos que controla isso, a linha em si nunca é apagada.
-- - historico: permanente, registra que um `dinamico` já valeu alguma vez (ver `historico_par`
--   no catálogo — quando um dinamico com par é conquistado pela 1ª vez, o par histórico
--   também desbloqueia, e fica pra sempre mesmo que o dinamico pare de valer depois).
--
-- 2 conquistas do catálogo ficam registradas mas sem verificação automática por enquanto
-- (ver criterio->>'regra' = 'aguardando_modulo_torneios' / 'MANUAL_sem_campo_no_cadastro'):
-- campeão de torneio (aguarda o módulo de organização de torneios que ainda vai ser
-- construído) e indicou um amigo (precisa de um campo novo de indicação no cadastro do aluno,
-- que não foi pedido nesta entrega).

create table if not exists conquistas (
  id text primary key,
  ordem int not null default 0,
  nome text not null,
  descricao text not null,
  familia text not null,
  tipo text not null check (tipo in ('marco', 'dinamico', 'historico')),
  icone text not null,
  -- self-reference: dinamico -> seu par historico (ex: nivel_ouro -> jafui_ouro). Deferrable
  -- porque o seed abaixo insere as 40 linhas num INSERT só, e alguns pares historico aparecem
  -- depois do dinamico que os referencia na mesma lista.
  historico_par text references conquistas(id) deferrable initially deferred,
  criterio jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz default now()
);

create table if not exists conquistas_alunos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references alunos(id) on delete cascade not null,
  conquista_id text references conquistas(id) on delete cascade not null,
  desbloqueada_em timestamptz not null default now(),
  ativa boolean not null default true,
  progresso_atual numeric,
  progresso_alvo numeric,
  atualizado_em timestamptz default now(),
  unique (aluno_id, conquista_id)
);

create index if not exists idx_conquistas_alunos_aluno on conquistas_alunos(aluno_id);
create index if not exists idx_conquistas_alunos_conquista on conquistas_alunos(conquista_id);

alter table conquistas enable row level security;
alter table conquistas_alunos enable row level security;

create policy "Auth users can manage conquistas" on conquistas for all to authenticated using (true) with check (true);
create policy "Auth users can manage conquistas_alunos" on conquistas_alunos for all to authenticated using (true) with check (true);

-- ---------- catálogo das 40 conquistas (espelha conquistas_config.json) ----------
insert into conquistas (id, ordem, nome, descricao, familia, tipo, icone, historico_par, criterio) values
  ('primeira_aula', 1, 'Primeira Aula', 'Realizou a 1ª aula de tênis (1 aula com presença registrada).', 'Início', 'marco', 'primeira_aula.svg', null, '{"regra":"presencas_confirmadas_minima","quantidade":1}'::jsonb),
  ('entrou_ranking', 2, 'Entrou no Ranking', 'Completou 5 jogos válidos (entra na classificação).', 'Ranking & Competição', 'marco', 'entrou_ranking.svg', null, '{"regra":"atingiu_minimo_jogos_classificacao","observacao":"Mesmo limite de MINIMO_JOGOS_CLASSIFICACAO em pontuacaoBeyond.js (hoje 5) — nunca duplicar o número aqui, ler da constante."}'::jsonb),
  ('primeira_vitoria', 3, 'Primeira Vitória', 'Venceu a 1ª partida do ranking.', 'Ranking & Competição', 'marco', 'primeira_vitoria.svg', null, '{"regra":"vitorias_ranking_minima","quantidade":1}'::jsonb),
  ('primeiro_torneio', 4, '1º Torneio Interno', 'Participou de ao menos 1 torneio interno.', 'Ranking & Competição', 'marco', 'primeiro_torneio.svg', null, '{"regra":"jogos_torneio_minima","quantidade":1}'::jsonb),
  ('campeao_torneio', 5, 'Campeão de Torneio', 'Venceu um torneio interno.', 'Ranking & Competição', 'marco', 'campeao_torneio.svg', null, '{"regra":"aguardando_modulo_torneios","observacao":"Confirmado com o Fernando: vamos montar um módulo próprio de organização de torneios dentro do ProCoach — é lá que o campeão de cada torneio vai ficar registrado, e essa conquista passa a desbloquear automaticamente a partir disso. Por enquanto essa conquista fica cadastrada no catálogo mas o serviço de verificação não tenta calculá-la (sem campo de campeão no banco ainda pra checar)."}'::jsonb),
  ('zebra', 6, 'Zebra', 'Venceu um adversário de categoria superior à sua.', 'Ranking & Competição', 'marco', 'zebra.svg', null, '{"regra":"venceu_categoria_superior","observacao":"Compara ranking_categorias.ordem do vencedor vs. do adversário no momento do jogo aprovado (categoria do ranking — Iniciante/Intermediário/Avançado — não nível de assiduidade). Zebra quando a ordem da categoria do vencedor é MENOR que a do adversário (categoria inferior batendo categoria superior)."}'::jsonb),
  ('estou_top5_cat', 7, 'Estou no Top 5 · Categoria', 'Está atualmente entre os 5 primeiros da categoria.', 'Ranking & Competição', 'dinamico', 'estou_top5_cat.svg', 'jafui_top5_cat', '{"regra":"posicao_ranking_maxima","tipo_ranking":"categoria","posicao_maxima":5}'::jsonb),
  ('jafui_top5_cat', 8, 'Já Fui Top 5 · Categoria', 'Já esteve no Top 5 da categoria alguma vez.', 'Ranking & Competição', 'historico', 'jafui_top5_cat.svg', null, '{"regra":"desbloqueado_junto_com","dinamico":"estou_top5_cat"}'::jsonb),
  ('estou_top5_ger', 9, 'Estou no Top 5 · Geral', 'Está atualmente no Top 5 do ranking geral.', 'Ranking & Competição', 'dinamico', 'estou_top5_ger.svg', 'jafui_top5_ger', '{"regra":"posicao_ranking_maxima","tipo_ranking":"geral","posicao_maxima":5}'::jsonb),
  ('jafui_top5_ger', 10, 'Já Fui Top 5 · Geral', 'Já esteve no Top 5 geral.', 'Ranking & Competição', 'historico', 'jafui_top5_ger.svg', null, '{"regra":"desbloqueado_junto_com","dinamico":"estou_top5_ger"}'::jsonb),
  ('podio_cat', 11, 'Estou no Pódio', 'Está atualmente no Top 3 da categoria.', 'Ranking & Competição', 'dinamico', 'podio_cat.svg', 'jafui_podio', '{"regra":"posicao_ranking_maxima","tipo_ranking":"categoria","posicao_maxima":3}'::jsonb),
  ('jafui_podio', 12, 'Já Subi ao Pódio', 'Já esteve no Top 3.', 'Ranking & Competição', 'historico', 'jafui_podio.svg', null, '{"regra":"desbloqueado_junto_com","dinamico":"podio_cat"}'::jsonb),
  ('n1_cat', 13, 'Nº 1 da Categoria', 'É o líder atual da categoria.', 'Ranking & Competição', 'dinamico', 'n1_cat.svg', null, '{"regra":"posicao_ranking_atual","tipo_ranking":"categoria","posicao":1}'::jsonb),
  ('n1_geral', 14, 'Nº 1 Geral', 'É o nº 1 do ranking geral — a conquista máxima.', 'Ranking & Competição', 'dinamico', 'n1_geral.svg', null, '{"regra":"posicao_ranking_atual","tipo_ranking":"geral","posicao":1}'::jsonb),
  ('nivel_bronze', 15, 'Nível Bronze', 'Tem de 5 a 10 jogos na janela de 90 dias.', 'Assiduidade', 'dinamico', 'nivel_bronze.svg', null, '{"regra":"nivel_assiduidade_atual","nivel":"Bronze"}'::jsonb),
  ('nivel_prata', 16, 'Nível Prata', 'Tem de 11 a 20 jogos na janela de 90 dias.', 'Assiduidade', 'dinamico', 'nivel_prata.svg', null, '{"regra":"nivel_assiduidade_atual","nivel":"Prata"}'::jsonb),
  ('nivel_ouro', 17, 'Nível Ouro', 'Tem 21+ jogos na janela de 90 dias.', 'Assiduidade', 'dinamico', 'nivel_ouro.svg', 'jafui_ouro', '{"regra":"nivel_assiduidade_atual","nivel":"Ouro"}'::jsonb),
  ('jafui_ouro', 18, 'Já Fui Ouro', 'Já atingiu o nível Ouro alguma vez.', 'Assiduidade', 'historico', 'jafui_ouro.svg', null, '{"regra":"desbloqueado_junto_com","dinamico":"nivel_ouro"}'::jsonb),
  ('rei_quadra', 19, 'Rei da Quadra', 'Jogou partidas do ranking com 10 adversários/parceiros diferentes.', 'Assiduidade', 'marco', 'rei_quadra.svg', null, '{"regra":"adversarios_distintos_minimo","quantidade":10,"observacao":"COUNT(DISTINCT aluno_id) dos OUTROS participantes (qualquer lado que não o do próprio aluno) em ranking_jogo_participantes de jogos aprovados dele — conta pessoas diferentes, não jogos. Premia quem varia de adversário/parceiro em vez de jogar sempre com a mesma pessoa."}'::jsonb),
  ('3meses_semfalta', 20, '3 Meses Sem Faltar', '90 dias sem falta não justificada (atestado/chuva não quebram a sequência).', 'Frequência & Presença', 'marco', '3meses_semfalta.svg', null, '{"regra":"dias_seguidos_sem_falta_nao_justificada","dias":90}'::jsonb),
  ('6meses_semfalta', 21, '6 Meses Sem Faltar', '180 dias sem falta não justificada.', 'Frequência & Presença', 'marco', '6meses_semfalta.svg', null, '{"regra":"dias_seguidos_sem_falta_nao_justificada","dias":180}'::jsonb),
  ('mes_perfeito', 22, 'Mês Perfeito', '100% de presença em um mês.', 'Frequência & Presença', 'marco', 'mes_perfeito.svg', null, '{"regra":"mes_calendario_sem_nenhuma_falta"}'::jsonb),
  ('primeira_reposicao', 23, 'Primeira Reposição', 'Fez a 1ª reposição de aula.', 'Frequência & Presença', 'marco', 'primeira_reposicao.svg', null, '{"regra":"presenca_reposicao_minima","quantidade":1}'::jsonb),
  ('aulas_30', 24, '30 Aulas', '30 aulas realizadas com presença.', 'Volume de Aulas', 'marco', 'aulas_30.svg', null, '{"regra":"presencas_confirmadas_minima","quantidade":30}'::jsonb),
  ('aulas_50', 25, '50 Aulas', '50 aulas realizadas com presença.', 'Volume de Aulas', 'marco', 'aulas_50.svg', null, '{"regra":"presencas_confirmadas_minima","quantidade":50}'::jsonb),
  ('aulas_75', 26, '75 Aulas', '75 aulas realizadas com presença.', 'Volume de Aulas', 'marco', 'aulas_75.svg', null, '{"regra":"presencas_confirmadas_minima","quantidade":75}'::jsonb),
  ('aulas_100', 27, '100 Aulas', '100 aulas realizadas com presença.', 'Volume de Aulas', 'marco', 'aulas_100.svg', null, '{"regra":"presencas_confirmadas_minima","quantidade":100}'::jsonb),
  ('aulas_150', 28, '150 Aulas', '150 aulas realizadas com presença.', 'Volume de Aulas', 'marco', 'aulas_150.svg', null, '{"regra":"presencas_confirmadas_minima","quantidade":150}'::jsonb),
  ('aulas_200', 29, '200 Aulas', '200 aulas realizadas com presença.', 'Volume de Aulas', 'marco', 'aulas_200.svg', null, '{"regra":"presencas_confirmadas_minima","quantidade":200}'::jsonb),
  ('aulas_300', 30, '300 Aulas', '300 aulas realizadas com presença.', 'Volume de Aulas', 'marco', 'aulas_300.svg', null, '{"regra":"presencas_confirmadas_minima","quantidade":300}'::jsonb),
  ('um_ano', 31, '1 Ano de Aulas', '365 dias desde a 1ª aula, ainda ativo.', 'Volume de Aulas', 'marco', 'um_ano.svg', null, '{"regra":"dias_desde_primeira_aula_ainda_ativo","dias":365}'::jsonb),
  ('dois_anos', 32, '2 Anos de Aulas', '730 dias desde a 1ª aula, ainda ativo.', 'Volume de Aulas', 'marco', 'dois_anos.svg', null, '{"regra":"dias_desde_primeira_aula_ainda_ativo","dias":730}'::jsonb),
  ('primeira_avaliacao', 33, 'Primeira Avaliação', 'Recebeu a 1ª avaliação técnica.', 'Evolução Técnica', 'marco', 'primeira_avaliacao.svg', null, '{"regra":"avaliacoes_tecnicas_confirmadas_minima","quantidade":1}'::jsonb),
  ('subiu_nivel', 34, 'Subiu de Nível', 'Subiu 1 nível técnico (ex.: Iniciante → Intermediário).', 'Evolução Técnica', 'marco', 'subiu_nivel.svg', null, '{"regra":"reaproveita_badge_evoluiu_pc_score_nivel"}'::jsonb),
  ('subiu_2niveis', 35, 'Subiu 2 Níveis', 'Subiu 2 níveis técnicos de uma vez.', 'Evolução Técnica', 'marco', 'subiu_2niveis.svg', null, '{"regra":"saltos_nivel_pc_score_em_uma_avaliacao","saltos":2}'::jsonb),
  ('evolucao_completa', 36, 'Evolução Completa', 'Melhorou a nota em todas as 6 dimensões numa mesma avaliação.', 'Evolução Técnica', 'marco', 'evolucao_completa.svg', null, '{"regra":"todas_dimensoes_melhoraram_vs_anterior","observacao":"Compara as 6 notas da avaliação confirmada mais recente contra a avaliação confirmada imediatamente anterior do mesmo aluno+modalidade. Só é possível a partir da 2ª avaliação (a 1ª nunca desbloqueia, não tem o que comparar). Desbloqueia se TODAS as 6 dimensões tiverem nota estritamente maior que na anterior."}'::jsonb),
  ('dimensao_dominada', 37, 'Dimensão Dominada', 'Atingiu nota máxima (5) em ao menos 1 dimensão.', 'Evolução Técnica', 'marco', 'dimensao_dominada.svg', null, '{"regra":"dimensao_com_nota_maxima","nota":5}'::jsonb),
  ('tres_avaliacoes', 38, '3 Avaliações Seguidas', 'Completou 3 avaliações trimestrais consecutivas.', 'Evolução Técnica', 'marco', 'tres_avaliacoes.svg', null, '{"regra":"reaproveita_badge_avaliacoes_em_dia_3x"}'::jsonb),
  ('indicou_amigo', 39, 'Indicou um Amigo', 'Indicou alguém que virou aluno.', 'Social & Engajamento', 'marco', 'indicou_amigo.svg', null, '{"regra":"MANUAL_sem_campo_no_cadastro","observacao":"Não existe hoje nenhum campo tipo \"indicado_por\" no cadastro do aluno — precisa de um campo novo pra rastrear isso (a definir junto com a migration), ou de um lançamento manual do gestor/recepção."}'::jsonb),
  ('perfil_completo', 40, 'Perfil Completo', 'Preencheu foto + data de nascimento + gênero + contato.', 'Social & Engajamento', 'marco', 'perfil_completo.svg', null, '{"regra":"campos_cadastro_preenchidos","campos":["foto_url","data_nascimento","genero","telefone"]}'::jsonb)
on conflict (id) do update set
  ordem = excluded.ordem,
  nome = excluded.nome,
  descricao = excluded.descricao,
  familia = excluded.familia,
  tipo = excluded.tipo,
  icone = excluded.icone,
  historico_par = excluded.historico_par,
  criterio = excluded.criterio;
