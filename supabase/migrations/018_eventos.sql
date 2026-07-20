-- Eventos com inscrição pública (ex.: seletiva Kids Competitivo) — página sem login em
-- /eventos/:slug, escrita feita via RPC (não INSERT direto) pra garantir que o limite de
-- vagas seja checado de forma atômica mesmo com várias pessoas se inscrevendo ao mesmo tempo.

CREATE TABLE IF NOT EXISTS eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  data_evento DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  idade_min INT,
  idade_max INT,
  capacidade_maxima INT NOT NULL DEFAULT 24,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evento_inscricoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES eventos(id),
  nome_crianca TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  nome_responsavel TEXT NOT NULL,
  whatsapp_responsavel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'lista_espera')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evento_inscricoes_evento ON evento_inscricoes(evento_id, status);

ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_inscricoes ENABLE ROW LEVEL SECURITY;

-- DROP + CREATE (em vez de só CREATE) pra essa migração poder ser rodada de novo sem
-- quebrar com "policy already exists" — Postgres não tem CREATE POLICY IF NOT EXISTS.

-- Info do evento (nome/data/vagas) precisa ser lida pela página pública sem login.
DROP POLICY IF EXISTS "Qualquer um pode ler eventos ativos" ON eventos;
CREATE POLICY "Qualquer um pode ler eventos ativos" ON eventos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Usuarios autenticados gerenciam eventos" ON eventos;
CREATE POLICY "Usuarios autenticados gerenciam eventos" ON eventos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sem policy de INSERT pra anon: a escrita pública passa exclusivamente pela função
-- inscrever_evento (abaixo), que roda com privilégio elevado e checa a vaga de forma atômica.
-- Isso evita tanto escrita direta descontrolada quanto expor a lista de inscritos (dados de
-- criança/responsável) pra qualquer visitante da página pública.
DROP POLICY IF EXISTS "Usuarios autenticados leem inscricoes" ON evento_inscricoes;
CREATE POLICY "Usuarios autenticados leem inscricoes" ON evento_inscricoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuarios autenticados gerenciam inscricoes" ON evento_inscricoes;
CREATE POLICY "Usuarios autenticados gerenciam inscricoes" ON evento_inscricoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- p_aceitar_espera=false (padrão): se ainda há vaga, confirma; se lotou, retorna 'esgotado'
-- sem gravar nada. p_aceitar_espera=true: grava como lista_espera mesmo se lotado (usado
-- quando o responsável já viu o aviso de vagas esgotadas e confirmou entrar na fila).
CREATE OR REPLACE FUNCTION inscrever_evento(
  p_evento_id UUID,
  p_nome_crianca TEXT,
  p_data_nascimento DATE,
  p_nome_responsavel TEXT,
  p_whatsapp_responsavel TEXT,
  p_aceitar_espera BOOLEAN DEFAULT false
) RETURNS TABLE(status TEXT) AS $$
DECLARE
  v_cap INT;
  v_confirmados INT;
  v_status TEXT;
BEGIN
  -- Serializa inscrições do mesmo evento pra ninguém passar do limite em corrida.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_evento_id::text, 0));

  SELECT capacidade_maxima INTO v_cap FROM eventos WHERE id = p_evento_id AND ativo = true;
  IF v_cap IS NULL THEN
    RAISE EXCEPTION 'Evento não encontrado ou inativo';
  END IF;

  SELECT count(*) INTO v_confirmados FROM evento_inscricoes
    WHERE evento_id = p_evento_id AND evento_inscricoes.status = 'confirmado';

  IF v_confirmados < v_cap THEN
    v_status := 'confirmado';
  ELSIF p_aceitar_espera THEN
    v_status := 'lista_espera';
  ELSE
    RETURN QUERY SELECT 'esgotado'::TEXT;
    RETURN;
  END IF;

  INSERT INTO evento_inscricoes (evento_id, nome_crianca, data_nascimento, nome_responsavel, whatsapp_responsavel, status)
  VALUES (p_evento_id, p_nome_crianca, p_data_nascimento, p_nome_responsavel, p_whatsapp_responsavel, v_status);

  RETURN QUERY SELECT v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION inscrever_evento TO anon, authenticated;

INSERT INTO eventos (slug, nome, data_evento, hora_inicio, hora_fim, idade_min, idade_max, capacidade_maxima)
VALUES ('seletiva-kids-competitivo-2026-08-02', 'Seletiva Kids Competitivo', '2026-08-02', '09:00', '12:00', 11, 15, 24)
ON CONFLICT (slug) DO NOTHING;
