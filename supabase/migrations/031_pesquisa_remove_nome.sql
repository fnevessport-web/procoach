-- A página pública não pode mostrar o nome do professor em lugar nenhum (nem na tela, nem
-- no retorno da chamada de rede, senão vaza no DevTools mesmo sem aparecer na tela). A RPC
-- agora só confirma se o token é válido — não devolve mais nome nem qualquer outro dado.

DROP FUNCTION IF EXISTS buscar_professor_por_token_pesquisa(UUID);
CREATE OR REPLACE FUNCTION buscar_professor_por_token_pesquisa(p_token UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM pesquisas_satisfacao WHERE token = p_token);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

GRANT EXECUTE ON FUNCTION buscar_professor_por_token_pesquisa TO anon, authenticated;
