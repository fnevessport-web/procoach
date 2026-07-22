-- Inscrição pública de eventos deixa de ter uma capacidade única pro evento inteiro e passa a
-- ter vagas por slot de horário/quadra (ex.: 09:00 Quadra 4, 09:00 Quadra 3, ...) — pedido do
-- clube pra deixar os pais escolherem o horário na hora de se inscrever, com vagas visíveis em
-- tempo real por slot. evento_inscricoes está vazia em produção (nenhuma inscrição feita ainda),
-- então dá pra adicionar a coluna nova já como NOT NULL sem precisar de backfill.

CREATE TABLE IF NOT EXISTS evento_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES eventos(id),
  horario TIME NOT NULL,
  quadra TEXT NOT NULL,
  capacidade INT NOT NULL DEFAULT 4,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(evento_id, horario, quadra)
);

ALTER TABLE evento_inscricoes ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES evento_slots(id);
ALTER TABLE evento_inscricoes ALTER COLUMN slot_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evento_inscricoes_slot ON evento_inscricoes(slot_id, status);

ALTER TABLE evento_slots ENABLE ROW LEVEL SECURITY;

-- DROP + CREATE (mesmo padrão de 018_eventos.sql) pra migration poder rodar de novo sem
-- quebrar com "policy already exists" — Postgres não tem CREATE POLICY IF NOT EXISTS.

-- Horário/quadra/capacidade não é PII — página pública precisa ler pra montar a grade de slots.
DROP POLICY IF EXISTS "Qualquer um pode ler slots de eventos" ON evento_slots;
CREATE POLICY "Qualquer um pode ler slots de eventos" ON evento_slots
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Usuarios autenticados gerenciam slots" ON evento_slots;
CREATE POLICY "Usuarios autenticados gerenciam slots" ON evento_slots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Contagem de vagas por slot pra anon, sem expor nome/data-nascimento/whatsapp de
-- evento_inscricoes (que continua sem policy de SELECT pra anon) — mesmo idioma
-- SECURITY DEFINER já usado em inscrever_evento.
CREATE OR REPLACE FUNCTION vagas_evento(p_slug TEXT)
RETURNS TABLE(slot_id UUID, horario TIME, quadra TEXT, capacidade INT, confirmados INT, vagas_restantes INT) AS $$
  SELECT es.id, es.horario, es.quadra, es.capacidade,
         COUNT(ei.id) FILTER (WHERE ei.status = 'confirmado')::INT AS confirmados,
         es.capacidade - COUNT(ei.id) FILTER (WHERE ei.status = 'confirmado')::INT AS vagas_restantes
  FROM evento_slots es
  JOIN eventos e ON e.id = es.evento_id
  LEFT JOIN evento_inscricoes ei ON ei.slot_id = es.id
  WHERE e.slug = p_slug AND e.ativo = true
  GROUP BY es.id, es.horario, es.quadra, es.capacidade, es.ordem
  ORDER BY es.ordem, es.horario, es.quadra;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION vagas_evento TO anon, authenticated;

-- inscrever_evento troca de p_evento_id pra p_slot_id (capacidade agora é por slot, não pelo
-- evento inteiro) — DROP explícito porque CREATE OR REPLACE não troca a lista de parâmetros,
-- criaria uma função sobreposta em vez de substituir a antiga.
DROP FUNCTION IF EXISTS inscrever_evento(UUID, TEXT, DATE, TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION inscrever_evento(
  p_slot_id UUID,
  p_nome_crianca TEXT,
  p_data_nascimento DATE,
  p_nome_responsavel TEXT,
  p_whatsapp_responsavel TEXT,
  p_aceitar_espera BOOLEAN DEFAULT false
) RETURNS TABLE(status TEXT) AS $$
DECLARE
  v_evento_id UUID;
  v_cap INT;
  v_confirmados INT;
  v_status TEXT;
  v_ativo BOOLEAN;
BEGIN
  -- Serializa inscrições do mesmo slot pra ninguém passar do limite em corrida — slots
  -- diferentes seguem em paralelo, sem gargalo entre horários distintos.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_slot_id::text, 0));

  SELECT es.evento_id, es.capacidade, e.ativo INTO v_evento_id, v_cap, v_ativo
    FROM evento_slots es JOIN eventos e ON e.id = es.evento_id
    WHERE es.id = p_slot_id;
  IF v_evento_id IS NULL OR NOT v_ativo THEN
    RAISE EXCEPTION 'Horário não encontrado ou evento inativo';
  END IF;

  SELECT count(*) INTO v_confirmados FROM evento_inscricoes
    WHERE slot_id = p_slot_id AND evento_inscricoes.status = 'confirmado';

  IF v_confirmados < v_cap THEN
    v_status := 'confirmado';
  ELSIF p_aceitar_espera THEN
    v_status := 'lista_espera';
  ELSE
    RETURN QUERY SELECT 'esgotado'::TEXT;
    RETURN;
  END IF;

  INSERT INTO evento_inscricoes (evento_id, slot_id, nome_crianca, data_nascimento, nome_responsavel, whatsapp_responsavel, status)
  VALUES (v_evento_id, p_slot_id, p_nome_crianca, p_data_nascimento, p_nome_responsavel, p_whatsapp_responsavel, v_status);

  RETURN QUERY SELECT v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION inscrever_evento TO anon, authenticated;

-- Seed dos 6 slots do evento já existente: 09h/10h/11h x Quadra 4/Quadra 3, 4 vagas cada = 24
-- (bate com o capacidade_maxima atual do evento).
INSERT INTO evento_slots (evento_id, horario, quadra, capacidade, ordem)
SELECT id, h.horario, h.quadra, 4, h.ordem
FROM eventos, (VALUES
  ('09:00'::TIME, 'Quadra 4', 1),
  ('09:00'::TIME, 'Quadra 3', 2),
  ('10:00'::TIME, 'Quadra 4', 3),
  ('10:00'::TIME, 'Quadra 3', 4),
  ('11:00'::TIME, 'Quadra 4', 5),
  ('11:00'::TIME, 'Quadra 3', 6)
) AS h(horario, quadra, ordem)
WHERE eventos.slug = 'seletiva-kids-competitivo-2026-08-02'
ON CONFLICT (evento_id, horario, quadra) DO NOTHING;
