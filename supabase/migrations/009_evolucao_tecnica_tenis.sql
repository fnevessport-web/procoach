-- =============================================
-- ProCoach — Módulo de Evolução Técnica (PC Score), primeira entrega: Tênis
-- =============================================
-- IMPORTANTE: rode este arquivo inteiro no Supabase Dashboard → SQL Editor. Não existe
-- conexão direta com o Postgres neste ambiente, então DDL precisa ser aplicado manualmente.
--
-- Não recria nada — `avaliacoes_tecnicas`, `modalidade_dimensoes` e `badges_aluno` já existem
-- desde a Fase 3 (avaliação técnica) e já cobrem exatamente as 6 dimensões do Tênis pedidas
-- aqui (Saque, Direita, Esquerda, Voleio, Posicionamento, Condicionamento), com formato
-- modular por modalidade via `dimensoes jsonb` — mantido de propósito em vez de virar colunas
-- fixas, porque cada modalidade tem dimensões com nomes diferentes (ex.: Padel tem
-- "Bandeja/Smash", Vôlei de Praia tem "Levantamento") e colunas fixas quebrariam isso.
-- `avaliacoes_tecnicas` está com 0 linhas em produção — seguro alterar sem risco de dado.

-- 1. Colunas novas em avaliacoes_tecnicas pro PC Score.
-- `comentario` (já existe) já cumpre o papel de "observação livre do professor" pedido no
-- escopo — não duplica em coluna nova.
alter table avaliacoes_tecnicas add column if not exists pc_score numeric;
alter table avaliacoes_tecnicas add column if not exists faixa_etaria text
  check (faixa_etaria in ('kids', 'infantil', 'adulto'));
alter table avaliacoes_tecnicas add column if not exists narrativa_ia text;

-- O índice composto (aluno_id, modalidade_id, data_avaliacao desc) pedido no escopo já existe
-- como idx_avaliacoes_tecnicas_aluno_modalidade — nada a fazer aqui.

-- 2. badges_aluno: solta a lista fixa de tipos permitidos. As regras de badge (inclusive as
-- técnicas novas, tipo "Direita Consistente") vão morar num arquivo de config no app
-- (src/constants/badges.js, entrega do item 7) — uma trava fixa no banco exigiria migration
-- toda vez que uma regra nova fosse adicionada, o que vai exatamente contra o pedido de
-- "deixar as regras fáceis de ajustar". Os 9 badges já concedidos continuam intactos, a
-- trava só deixa de restringir valores novos.
alter table badges_aluno drop constraint if exists badges_aluno_tipo_badge_check;
alter table badges_aluno add constraint badges_aluno_tipo_badge_not_blank check (length(trim(tipo_badge)) > 0);

-- Nada a fazer em `alunos.data_nascimento` — já existe (migração 002), mas hoje 0 de 236
-- alunos têm essa data preenchida (matrícula é controlada pelo clube, não pelo ProCoach, e
-- isso vai ser preenchido aos poucos, direto com os alunos). Enquanto isso, quem sabe a faixa
-- etária de cada aluno é quem está na quadra — o professor. `faixa_etaria_manual` é uma
-- propriedade do ALUNO (não da avaliação pontual), escolhida uma vez pelo professor/gestor e
-- reaproveitada em todas as avaliações futuras dele, até que data_nascimento seja preenchida
-- de verdade (nesse caso o cálculo automático sempre tem prioridade sobre essa escolha manual —
-- ver src/lib/pcScore.js). Nunca aparece pro usuário aluno, só pra professor/gestor.
alter table alunos add column if not exists faixa_etaria_manual text
  check (faixa_etaria_manual in ('kids', 'infantil', 'adulto'));
