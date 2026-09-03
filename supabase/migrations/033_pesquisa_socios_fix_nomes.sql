-- Corrige listar_professores_pesquisa_socios depois de testar com dado real (ver conversa):
-- 1. "Nayara  Santos" está cadastrado com espaço duplo entre nome e sobrenome — comparação
--    exata (nome = ANY(p_nomes)) não batia com "Nayara Santos". Normaliza espaço em excesso
--    dos dois lados antes de comparar, sem precisar corrigir o cadastro em si.
-- 2. "Douglas Paixão Prier de Saone" está cadastrado DUAS vezes (ids diferentes, um com foto
--    e outro sem — provável duplicidade de cadastro, não mexido aqui de propósito). Sem
--    DISTINCT, a pesquisa mostraria dois checkboxes idênticos pra ele. Deduplica preferindo
--    a linha que tem foto_url preenchida, senão a mais antiga.
CREATE OR REPLACE FUNCTION listar_professores_pesquisa_socios(p_nomes TEXT[])
RETURNS TABLE(id UUID, nome TEXT, foto_url TEXT) AS $$
  SELECT DISTINCT ON (regexp_replace(nome, '\s+', ' ', 'g'))
    id, nome, foto_url
  FROM professores
  WHERE regexp_replace(nome, '\s+', ' ', 'g') = ANY(p_nomes) AND ativo IS NOT FALSE
  ORDER BY regexp_replace(nome, '\s+', ' ', 'g'), (foto_url IS NULL), criado_em;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;
