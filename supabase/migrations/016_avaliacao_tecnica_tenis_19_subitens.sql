-- =============================================
-- ProCoach — Nova estrutura de Avaliação Técnica: Tênis com 5 domínios / 19 subitens (1-10)
-- =============================================
-- Escopo: só Tênis por enquanto (mesmo padrão da migração 009 — "primeira entrega: Tênis").
-- Padel/Beach Tennis/Futevôlei/Vôlei de Praia continuam com o modelo antigo (5-6 dimensões
-- soltas, nota 1-5) até terem sua própria lista de subitens definida.
--
-- `avaliacoes_tecnicas` está com 0 linhas em produção (a única avaliação existente — dado de
-- teste da Ana Paula Selga — foi apagada) — seguro alterar sem risco de dado real.
--
-- Continua tudo em `modalidade_dimensoes` + `avaliacoes_tecnicas.dimensoes` (jsonb), sem
-- tabela nova: é exatamente o "formulário dinâmico por modalidade" que já existia desde a
-- migração 004, só ganhando 3 colunas novas em `modalidade_dimensoes` pra suportar
-- agrupamento por domínio e escala variável por modalidade.

-- 1. Colunas novas em modalidade_dimensoes.
-- `dominio`: nome do domínio que agrupa o subitem (ex.: "Saque", "Jogo de Fundo"). NULL nas
-- modalidades que ainda não migraram — o formulário continua mostrando a lista solta de
-- sempre pra elas, sem quebrar nada.
-- `escala_max`: nota máxima do subitem (5 = padrão de sempre, 10 = novo modelo do Tênis).
-- `chave`: identificador único do subitem, DIFERENTE de `nome_dimensao`. Necessário porque,
-- no novo modelo, o mesmo nome de subitem se repete em domínios diferentes (ex.: "Técnica"
-- existe em Jogo de Fundo E em Jogo de Rede; "Direção" existe em Saque E em Jogo de Fundo) —
-- se `avaliacoes_tecnicas.dimensoes` continuasse chaveado por `nome_dimensao`, um sobrescreveria
-- o outro no jsonb. Nas modalidades antigas `chave` é só uma cópia de `nome_dimensao` (nomes já
-- são únicos ali, então não muda nada pra elas).
alter table modalidade_dimensoes add column if not exists dominio text;
alter table modalidade_dimensoes add column if not exists escala_max integer not null default 5;
alter table modalidade_dimensoes add column if not exists chave text;

update modalidade_dimensoes set chave = nome_dimensao where chave is null;

alter table modalidade_dimensoes alter column chave set not null;

alter table modalidade_dimensoes drop constraint if exists modalidade_dimensoes_modalidade_chave_uniq;
alter table modalidade_dimensoes add constraint modalidade_dimensoes_modalidade_chave_uniq unique (modalidade_id, chave);

-- 2. Substitui as 6 dimensões antigas do Tênis (Saque, Direita, Esquerda, Voleio,
-- Posicionamento, Condicionamento — nota 1-5) pelos 19 subitens novos, agrupados em 5
-- domínios, nota 1-10. `ordem` é global (1 a 19) pra a listagem já sair na ordem certa dos
-- domínios sem precisar de outra coluna de ordenação.
delete from modalidade_dimensoes
where modalidade_id = (select id from modalidades where nome = 'Tênis');

insert into modalidade_dimensoes (modalidade_id, dominio, nome_dimensao, chave, ordem, peso, escala_max)
select m.id, d.dominio, d.nome, d.chave, d.ordem, 1, 10
from modalidades m
cross join lateral (
  values
    -- Saque
    ('Saque', 'Empunhadura', 'saque_empunhadura', 1),
    ('Saque', 'Biomecânica', 'saque_biomecanica', 2),
    ('Saque', 'Efeitos', 'saque_efeitos', 3),
    ('Saque', 'Direção', 'saque_direcao', 4),
    ('Saque', 'Potência', 'saque_potencia', 5),
    -- Jogo de Fundo
    ('Jogo de Fundo', 'Técnica', 'fundo_tecnica', 6),
    ('Jogo de Fundo', 'Direção', 'fundo_direcao', 7),
    ('Jogo de Fundo', 'Profundidade', 'fundo_profundidade', 8),
    ('Jogo de Fundo', 'Potência', 'fundo_potencia', 9),
    ('Jogo de Fundo', 'Movimentação/Posicionamento', 'fundo_movimentacao', 10),
    -- Jogo de Rede
    ('Jogo de Rede', 'Técnica', 'rede_tecnica', 11),
    ('Jogo de Rede', 'Voleios', 'rede_voleios', 12),
    ('Jogo de Rede', 'Smash', 'rede_smash', 13),
    -- Tática
    ('Tática', 'Tomada de decisão', 'tatica_decisao', 14),
    ('Tática', 'Leitura do momento', 'tatica_leitura', 15),
    ('Tática', 'Adaptação tática', 'tatica_adaptacao', 16),
    -- Condicionamento Físico
    ('Condicionamento Físico', 'Resistência', 'condicionamento_resistencia', 17),
    ('Condicionamento Físico', 'Velocidade e Agilidade', 'condicionamento_velocidade', 18),
    ('Condicionamento Físico', 'Força/Potência', 'condicionamento_forca', 19)
) as d(dominio, nome, chave, ordem)
where m.nome = 'Tênis';
