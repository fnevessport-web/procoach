-- Pesquisa de satisfação de sócios/alunos sobre as aulas de tênis (Beyond the Club) —
-- diferente da pesquisa de professor (pesquisas_satisfacao/pesquisa_respostas). Pública,
-- anônima, múltiplas campanhas ao longo do tempo (conteúdo fixo, só nome/data variam por
-- campanha), cada uma com link e respostas independentes. Mesmo padrão de segurança das
-- migrations 028/029/031: RLS habilitado sem nenhuma policy pública de leitura/escrita — só
-- RPC SECURITY DEFINER acessa via sessão anônima.
--
-- Diferente da pesquisa de professor (migration 030), aqui a policy de admin usa
-- role='admin' padrão (libera QUALQUER gestor) — decisão explícita do usuário, essa pesquisa
-- não é sensível como a de professor, é métrica de negócio normal.

CREATE TABLE IF NOT EXISTS pesquisa_socios_campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pesquisa_socios_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES pesquisa_socios_campanhas(id) ON DELETE CASCADE,
  respostas JSONB NOT NULL,
  respondido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pesquisa_socios_respostas_campanha ON pesquisa_socios_respostas(campanha_id);

ALTER TABLE pesquisa_socios_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesquisa_socios_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "somente_admin_pesquisa_socios_campanhas" ON pesquisa_socios_campanhas;
CREATE POLICY "somente_admin_pesquisa_socios_campanhas" ON pesquisa_socios_campanhas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfis_usuario pu WHERE pu.user_id = auth.uid() AND pu.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM perfis_usuario pu WHERE pu.user_id = auth.uid() AND pu.role = 'admin'));

DROP POLICY IF EXISTS "somente_admin_pesquisa_socios_respostas" ON pesquisa_socios_respostas;
CREATE POLICY "somente_admin_pesquisa_socios_respostas" ON pesquisa_socios_respostas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfis_usuario pu WHERE pu.user_id = auth.uid() AND pu.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM perfis_usuario pu WHERE pu.user_id = auth.uid() AND pu.role = 'admin'));

-- Valida o token sem devolver nada sensível (mesmo padrão da 031 pra pesquisa de professor).
CREATE OR REPLACE FUNCTION validar_token_pesquisa_socios(p_token UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM pesquisa_socios_campanhas WHERE token = p_token);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- `professores` só tem SELECT pra `authenticated` (migration 019) — a sessão anônima da
-- pesquisa pública precisa dessa RPC pra montar os checkboxes com foto+nome. Nunca devolve
-- campo sensível (banco/pix/valor_hora_aula) — só id/nome/foto_url dos nomes pedidos.
CREATE OR REPLACE FUNCTION listar_professores_pesquisa_socios(p_nomes TEXT[])
RETURNS TABLE(id UUID, nome TEXT, foto_url TEXT) AS $$
  SELECT id, nome, foto_url FROM professores
  WHERE nome = ANY(p_nomes) AND ativo IS NOT FALSE
  ORDER BY nome;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- Sempre INSERT, nunca UPDATE/UPSERT — permite múltiplas respostas pelo mesmo link, cada
-- envio vira uma linha nova (mesmo padrão da pesquisa de professor desde a migration 029).
CREATE OR REPLACE FUNCTION salvar_resposta_pesquisa_socios(p_token UUID, p_respostas JSONB)
RETURNS VOID AS $$
DECLARE
  v_campanha_id UUID;
BEGIN
  SELECT id INTO v_campanha_id FROM pesquisa_socios_campanhas WHERE token = p_token;
  IF v_campanha_id IS NULL THEN
    RAISE EXCEPTION 'Link inválido';
  END IF;
  INSERT INTO pesquisa_socios_respostas (campanha_id, respostas) VALUES (v_campanha_id, p_respostas);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION validar_token_pesquisa_socios TO anon, authenticated;
GRANT EXECUTE ON FUNCTION listar_professores_pesquisa_socios TO anon, authenticated;
GRANT EXECUTE ON FUNCTION salvar_resposta_pesquisa_socios TO anon, authenticated;
