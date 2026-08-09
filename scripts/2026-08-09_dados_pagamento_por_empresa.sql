-- Separa os dados de pagamento do colaborador (banco, tipo de pagamento, agência,
-- conta, tipo de conta, chave PIX, titular) em um conjunto por empresa.
-- Motivo: colaboradores como a Kelly e o Fernando recebem de forma diferente em
-- cada empresa (ex: Boleto na Procópio e PIX na Beach Arena, ou PIX de bancos
-- diferentes em cada uma) e hoje só existe UM conjunto desses campos (sem saber
-- de qual empresa é) — então não dá pra cadastrar os dois ao mesmo tempo.
--
-- Segue a mesma convenção já usada em valor_aula/valor_aula_beach: os campos sem
-- sufixo continuam sendo os da Procópio (nenhuma migração de dado existente é
-- necessária); os novos campos "_beach" são os da Beach Arena. Quem só trabalha
-- numa empresa só vê/usa o bloco daquela empresa; o app cai pros campos sem
-- sufixo se os "_beach" estiverem vazios (mesmo fallback de valor_aula_beach),
-- então cadastro antigo de colaborador só-Beach-Arena continua funcionando sem
-- precisar reeditar nada.

alter table professores add column if not exists banco_beach text;
alter table professores add column if not exists tipo_pagamento_beach text default 'pix';
alter table professores add column if not exists agencia_beach text;
alter table professores add column if not exists conta_beach text;
alter table professores add column if not exists tipo_conta_beach text default 'corrente';
alter table professores add column if not exists chave_pix_beach text;
alter table professores add column if not exists nome_titular_beach text;
alter table professores add column if not exists cpf_titular_beach text;
