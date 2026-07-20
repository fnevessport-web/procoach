-- ACHADO EM AUDITORIA (2026-07-19): a tabela professores estava com RLS desligado no banco
-- inteiro (unica tabela do projeto nessa situacao) — qualquer pessoa sem login, usando so a
-- chave anon (publica, embutida no site), conseguia ler CPF, telefone, dados bancarios,
-- salario e o token_disponibilidade de TODOS os professores. A tabela disponibilidades
-- tambem tinha uma policy aberta pra "public" sem checar o token.
--
-- Fix: liga RLS em professores (fica so authenticated, como as outras tabelas do sistema).
-- O acesso publico que a pagina /disponibilidade/:token precisa passa a ser só por RPC
-- (SECURITY DEFINER), que resolve o professor pelo token e nunca devolve colunas sensiveis
-- nem a lista de tokens. Mesmo padrao ja usado em inscrever_evento (migration 018).

ALTER TABLE professores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acesso_publico_disponibilidades" ON disponibilidades;
DROP POLICY IF EXISTS "auth_disponibilidades" ON disponibilidades;
CREATE POLICY "Usuarios autenticados gerenciam disponibilidades" ON disponibilidades
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Só id + nome — nunca CPF/banco/salario/telefone. Retorna vazio se o token não bater com
-- nenhum professor ativo (link inválido).
CREATE OR REPLACE FUNCTION buscar_professor_por_token(p_token UUID)
RETURNS TABLE(id UUID, nome TEXT) AS $$
  SELECT id, nome FROM professores WHERE token_disponibilidade = p_token;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

CREATE OR REPLACE FUNCTION buscar_disponibilidade_por_token(p_token UUID)
RETURNS TABLE(dia_semana TEXT, horario TEXT, status TEXT) AS $$
  SELECT d.dia_semana, d.horario, d.status
  FROM disponibilidades d
  JOIN professores p ON p.id = d.professor_id
  WHERE p.token_disponibilidade = p_token;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- Substitui (delete + insert) a disponibilidade do professor dono do token. p_linhas é um
-- array de objetos {dia_semana, horario, status}.
CREATE OR REPLACE FUNCTION salvar_disponibilidade_por_token(p_token UUID, p_linhas JSONB)
RETURNS VOID AS $$
DECLARE
  v_professor_id UUID;
BEGIN
  SELECT id INTO v_professor_id FROM professores WHERE token_disponibilidade = p_token;
  IF v_professor_id IS NULL THEN
    RAISE EXCEPTION 'Link inválido';
  END IF;

  DELETE FROM disponibilidades WHERE professor_id = v_professor_id;

  INSERT INTO disponibilidades (professor_id, dia_semana, horario, status, atualizado_em)
  SELECT v_professor_id, linha->>'dia_semana', linha->>'horario', linha->>'status', now()
  FROM jsonb_array_elements(p_linhas) AS linha;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION buscar_professor_por_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION buscar_disponibilidade_por_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION salvar_disponibilidade_por_token TO anon, authenticated;
