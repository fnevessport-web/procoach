-- Pesquisa de satisfação por professor — link único por pessoa, gestor manda por
-- WhatsApp/particular, professor preenche sem login. Requisito explícito: só o dono
-- (role 'admin' no banco = "gestor" na UI, ver ALIASES_ROLE em usePermissions.js) pode
-- ver o link e as respostas — nem financeiro, nem coordenador, nem o próprio professor.
--
-- Por isso o token NÃO fica em `professores` (aquela tabela tem
-- "FOR SELECT TO authenticated USING (true)" desde 001_initial_schema.sql — qualquer
-- usuário logado lê a linha inteira, foi exatamente o buraco que 019_fix_rls_professores_
-- disponibilidade.sql teve que tampar pra CPF/dados bancários). Fica numa tabela própria,
-- trancada por RLS explícita de role='admin', e o acesso público (sem login) passa só por
-- RPC SECURITY DEFINER — mesmo padrão de buscar_professor_por_token/salvar_disponibilidade_
-- por_token em 019, mas aqui a leitura por RPC nunca devolve o token de volta (o professor
-- só chega na resposta via URL, não precisa ler o token de novo).
--
-- RODAR no SQL editor do Supabase (mesmo fluxo das migrations anteriores deste projeto).

CREATE TABLE IF NOT EXISTS pesquisas_satisfacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id UUID NOT NULL UNIQUE REFERENCES professores(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  respostas JSONB,
  respondido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pesquisas_satisfacao ENABLE ROW LEVEL SECURITY;

-- Sem policy nenhuma pra anon/professor — só admin (o dono) enxerga essa tabela pela
-- sessão autenticada normal do app. Qualquer outro role cai fora por padrão do RLS.
CREATE POLICY "somente_admin_pesquisas_satisfacao" ON pesquisas_satisfacao
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfis_usuario pu WHERE pu.user_id = auth.uid() AND pu.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM perfis_usuario pu WHERE pu.user_id = auth.uid() AND pu.role = 'admin'));

-- Pré-cria a linha (com token) pra todo professor já cadastrado — o admin só precisa
-- abrir o cadastro e copiar o link, sem passo extra de "gerar".
INSERT INTO pesquisas_satisfacao (professor_id)
SELECT id FROM professores
ON CONFLICT (professor_id) DO NOTHING;

-- Acesso público (sem login, o professor abrindo o link recebido) — nome + se já
-- respondeu, nada mais. Nunca devolve o token nem dados de outro professor.
CREATE OR REPLACE FUNCTION buscar_professor_por_token_pesquisa(p_token UUID)
RETURNS TABLE(nome TEXT, ja_respondeu BOOLEAN) AS $$
  SELECT p.nome, (ps.respondido_em IS NOT NULL)
  FROM pesquisas_satisfacao ps
  JOIN professores p ON p.id = ps.professor_id
  WHERE ps.token = p_token;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- Grava as respostas pelo token — não tem policy de escrita pública na tabela, só essa
-- função (SECURITY DEFINER) consegue gravar.
CREATE OR REPLACE FUNCTION salvar_pesquisa_por_token(p_token UUID, p_respostas JSONB)
RETURNS VOID AS $$
BEGIN
  UPDATE pesquisas_satisfacao
  SET respostas = p_respostas, respondido_em = now()
  WHERE token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link inválido';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION buscar_professor_por_token_pesquisa TO anon, authenticated;
GRANT EXECUTE ON FUNCTION salvar_pesquisa_por_token TO anon, authenticated;
