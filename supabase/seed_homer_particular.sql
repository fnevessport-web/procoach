-- Seed de teste: conta Particular do Homer (Homer Neves - teste).
-- RODAR DEPOIS de 024_particular_tenant.sql (precisa da empresa-âncora "clube" já existir).
-- Não é migração de schema, é só dado de teste — não precisa entrar no histórico de migrations.
--
-- user_id confirmado em auth.users (email fenevesofficedesign@gmail.com, bate com
-- professores.email do Homer): 1a790899-9c17-4d41-bea4-f37ecfc59cc0
-- Role atual dele no clube (perfis_usuario.role): 'professor'.
do $$
declare
  v_empresa_particular_id uuid;
  v_empresa_clube_id uuid;
  v_homer_user_id uuid := '1a790899-9c17-4d41-bea4-f37ecfc59cc0';
begin
  insert into empresas (nome, tipo) values ('Homer — Prática Particular', 'particular')
    returning id into v_empresa_particular_id;

  select id into v_empresa_clube_id from empresas where tipo = 'clube' limit 1;

  -- Vínculo dele como dono da conta Particular
  insert into usuario_empresas (user_id, empresa_id, role)
  values (v_homer_user_id, v_empresa_particular_id, 'dono_particular');

  -- Vínculo de volta pro clube, preservando o role que ele já tinha — é isso que faz a tela de
  -- login mostrar as 2 opções (Clube / Particular) em vez de pular direto pra uma.
  insert into usuario_empresas (user_id, empresa_id, role)
  values (v_homer_user_id, v_empresa_clube_id, 'professor');

  -- Grade de horários 06:00–22:00 (hora em hora) pro tenant particular dele
  insert into horarios_agenda (empresa_id, horario)
  select v_empresa_particular_id, (h || ':00')::time
  from generate_series(6, 22) as h;
end $$;
