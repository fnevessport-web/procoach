-- Pesquisa de satisfação passa a aceitar MÚLTIPLAS respostas pelo mesmo link — o
-- professor pode reabrir o link e responder de novo quantas vezes quiser, o link nunca
-- trava nem mostra "já respondida", e cada envio vira um registro novo (nenhum sobrescreve
-- o anterior). Roda DEPOIS de 028_pesquisa_satisfacao.sql.

-- Cada envio agora é uma linha aqui, não mais 1 campo dentro de pesquisas_satisfacao.
CREATE TABLE IF NOT EXISTS pesquisa_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pesquisa_id UUID NOT NULL REFERENCES pesquisas_satisfacao(id) ON DELETE CASCADE,
  respostas JSONB NOT NULL,
  respondido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE pesquisa_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "somente_admin_pesquisa_respostas" ON pesquisa_respostas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfis_usuario pu WHERE pu.user_id = auth.uid() AND pu.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM perfis_usuario pu WHERE pu.user_id = auth.uid() AND pu.role = 'admin'));

-- Migra qualquer resposta que já exista na tabela antiga (caso 028 já tenha rodado e
-- alguém já tenha respondido antes desta migration) antes de remover as colunas velhas.
INSERT INTO pesquisa_respostas (pesquisa_id, respostas, respondido_em)
SELECT id, respostas, respondido_em FROM pesquisas_satisfacao
WHERE respostas IS NOT NULL AND respondido_em IS NOT NULL;

ALTER TABLE pesquisas_satisfacao DROP COLUMN IF EXISTS respostas;
ALTER TABLE pesquisas_satisfacao DROP COLUMN IF EXISTS respondido_em;

-- RPC pública: não devolve mais "já respondeu" (o link sempre abre em branco).
DROP FUNCTION IF EXISTS buscar_professor_por_token_pesquisa(UUID);
CREATE OR REPLACE FUNCTION buscar_professor_por_token_pesquisa(p_token UUID)
RETURNS TABLE(nome TEXT) AS $$
  SELECT p.nome
  FROM pesquisas_satisfacao ps
  JOIN professores p ON p.id = ps.professor_id
  WHERE ps.token = p_token;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- Cada chamada INSERE uma linha nova em pesquisa_respostas — nunca faz UPDATE/upsert,
-- então o mesmo link pode ser enviado quantas vezes o professor quiser.
CREATE OR REPLACE FUNCTION salvar_pesquisa_por_token(p_token UUID, p_respostas JSONB)
RETURNS VOID AS $$
DECLARE v_pesquisa_id UUID;
BEGIN
  SELECT id INTO v_pesquisa_id FROM pesquisas_satisfacao WHERE token = p_token;
  IF v_pesquisa_id IS NULL THEN RAISE EXCEPTION 'Link inválido'; END IF;
  INSERT INTO pesquisa_respostas (pesquisa_id, respostas) VALUES (v_pesquisa_id, p_respostas);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION buscar_professor_por_token_pesquisa TO anon, authenticated;
GRANT EXECUTE ON FUNCTION salvar_pesquisa_por_token TO anon, authenticated;
