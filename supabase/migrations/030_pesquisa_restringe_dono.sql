-- Trava o acesso à pesquisa de satisfação num usuário específico (o dono, Fernando), não
-- mais em "qualquer conta com role admin/gestor" — hoje existe uma segunda conta com esse
-- role (George Procópio, gerente) que não deve ver essa pesquisa em particular, mesmo
-- continuando com acesso normal a financeiro/cadastros/etc (isso não muda aqui).
--
-- user_id fixo abaixo é a conta 32508588890@procoach.local / fernandoemmerichneves@gmail.com
-- (confirmado via auth.users antes de escrever esta migration).

DROP POLICY IF EXISTS "somente_admin_pesquisas_satisfacao" ON pesquisas_satisfacao;
CREATE POLICY "somente_dono_pesquisas_satisfacao" ON pesquisas_satisfacao
  FOR ALL TO authenticated
  USING (auth.uid() = 'a44110f0-cb53-4555-a6b2-2dfe13f03192'::uuid)
  WITH CHECK (auth.uid() = 'a44110f0-cb53-4555-a6b2-2dfe13f03192'::uuid);

DROP POLICY IF EXISTS "somente_admin_pesquisa_respostas" ON pesquisa_respostas;
CREATE POLICY "somente_dono_pesquisa_respostas" ON pesquisa_respostas
  FOR ALL TO authenticated
  USING (auth.uid() = 'a44110f0-cb53-4555-a6b2-2dfe13f03192'::uuid)
  WITH CHECK (auth.uid() = 'a44110f0-cb53-4555-a6b2-2dfe13f03192'::uuid);
