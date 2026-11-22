-- Marca no cadastro quem é professor SUBSTITUTO (não titular de grade), pedido de 05/11/2026.
-- Serve para o Financeiro distinguir titular de substituto (selo "Prof substituto").
-- Já marca Marco e Carlinhos.
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.

alter table professores add column if not exists eh_substituto boolean not null default false;

update professores set eh_substituto = true
where id in (
  'a58db697-f63a-4430-911e-d0bffce95341', -- Marco Antônio Araújo Sales (Marco)
  '1cdf4378-e70a-4a0a-930f-83d9312e596b'  -- Carlos Alberto dos Santos Silva (Carlinhos)
);

notify pgrst, 'reload schema';
