-- Adiciona a dimensão "empresa" na tabela de boletos/NF dos professores.
-- Hoje o registro é único por (professor_id, mes, ano) — quem trabalha nas duas
-- empresas (Procópio e Beach Arena) tem a NF de uma sobrescrita pela da outra no
-- mesmo mês, porque cai no mesmo registro. Isso separa por empresa.

-- 1. Adiciona a coluna (nula por enquanto, pra poder popular o que já existe)
alter table boletos_professor add column if not exists empresa text;

-- 2. Registros existentes: assume 'procopio' por padrão (é a empresa de quase todo
--    professor hoje). Se algum registro antigo for na verdade da Beach Arena,
--    ajuste manualmente essa linha depois (ex: UPDATE boletos_professor SET empresa =
--    'beach_arena' WHERE id = '...').
update boletos_professor set empresa = 'procopio' where empresa is null;

-- 3. Agora que não tem mais nulo, trava a coluna como obrigatória
alter table boletos_professor alter column empresa set not null;

-- 4. Troca a trava de "único por professor+mês+ano" por "único por professor+mês+ano+empresa"
--    — acha o nome real da trava (pode variar) em vez de arriscar um DROP CONSTRAINT com
--    nome errado, que não avisa e deixa a trava antiga ativa por engano.
do $$
declare
  nome_trava text;
begin
  select con.conname into nome_trava
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'boletos_professor'
    and con.contype = 'u'
    and (
      select array_agg(attname::text order by attname)
      from pg_attribute
      where attrelid = con.conrelid and attnum = any(con.conkey)
    ) = array['ano', 'mes', 'professor_id']::text[];

  if nome_trava is not null then
    execute format('alter table boletos_professor drop constraint %I', nome_trava);
  end if;
end $$;

alter table boletos_professor
  add constraint boletos_professor_professor_mes_ano_empresa_key
  unique (professor_id, mes, ano, empresa);
