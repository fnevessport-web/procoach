-- Checklist "quais turmas regulares funcionam pra vocês, se aprovado" no formulário público de
-- inscrição — guarda as opções marcadas (array de chaves fixas: turma1..turma4, nenhuma), pra
-- a equipe já saber qual turma oferecer no contato pós-seletiva sem precisar perguntar de novo.

ALTER TABLE evento_inscricoes ADD COLUMN IF NOT EXISTS disponibilidade_turmas TEXT[];

-- inscrever_evento ganha um parâmetro novo opcional no final (DEFAULT NULL) — precisa de DROP
-- explícito porque CREATE OR REPLACE não reconhece uma lista de parâmetros diferente como a
-- mesma função (criaria uma segunda função sobreposta em vez de substituir), mesmo problema já
-- documentado na migration 020 ao trocar p_evento_id por p_slot_id.
DROP FUNCTION IF EXISTS inscrever_evento(UUID, TEXT, DATE, TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION inscrever_evento(
  p_slot_id UUID,
  p_nome_crianca TEXT,
  p_data_nascimento DATE,
  p_nome_responsavel TEXT,
  p_whatsapp_responsavel TEXT,
  p_aceitar_espera BOOLEAN DEFAULT false,
  p_disponibilidade_turmas TEXT[] DEFAULT NULL
) RETURNS TABLE(status TEXT) AS $$
DECLARE
  v_evento_id UUID;
  v_cap INT;
  v_confirmados INT;
  v_status TEXT;
  v_ativo BOOLEAN;
BEGIN
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

  INSERT INTO evento_inscricoes (evento_id, slot_id, nome_crianca, data_nascimento, nome_responsavel, whatsapp_responsavel, status, disponibilidade_turmas)
  VALUES (v_evento_id, p_slot_id, p_nome_crianca, p_data_nascimento, p_nome_responsavel, p_whatsapp_responsavel, v_status, p_disponibilidade_turmas);

  RETURN QUERY SELECT v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION inscrever_evento TO anon, authenticated;
