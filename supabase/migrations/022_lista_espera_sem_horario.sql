-- Lista de espera "geral" (quando TODOS os horários já lotaram) deixa de pedir horário de
-- preferência — o clube pode abrir horários novos depois dos 6 atuais, então amarrar a um slot
-- específico não faz sentido nesse caso. slot_id vira opcional: continua sempre preenchido pra
-- inscrição confirmada e pra fila de espera de UM horário específico que acabou de lotar (fluxo
-- de corrida em inscrever_evento, que não muda), só fica NULL nessa fila de espera geral nova.

ALTER TABLE evento_inscricoes ALTER COLUMN slot_id DROP NOT NULL;

-- SECURITY DEFINER simples, sem lock/checagem de capacidade (não depende de slot nenhum) —
-- mesmo padrão de escrita pública restrita usado em inscrever_evento, só que aqui sempre grava
-- como lista_espera, direto, sem checar vaga.
CREATE OR REPLACE FUNCTION entrar_lista_espera_evento(
  p_evento_id UUID,
  p_nome_crianca TEXT,
  p_data_nascimento DATE,
  p_nome_responsavel TEXT,
  p_whatsapp_responsavel TEXT,
  p_disponibilidade_turmas TEXT[] DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM eventos WHERE id = p_evento_id AND ativo = true) THEN
    RAISE EXCEPTION 'Evento não encontrado ou inativo';
  END IF;

  INSERT INTO evento_inscricoes (evento_id, slot_id, nome_crianca, data_nascimento, nome_responsavel, whatsapp_responsavel, status, disponibilidade_turmas)
  VALUES (p_evento_id, NULL, p_nome_crianca, p_data_nascimento, p_nome_responsavel, p_whatsapp_responsavel, 'lista_espera', p_disponibilidade_turmas);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION entrar_lista_espera_evento TO anon, authenticated;
