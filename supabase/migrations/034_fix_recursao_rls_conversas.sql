-- Corrige "infinite recursion detected in policy for relation conversas_participantes",
-- que travava TODO acesso autenticado a conversas/conversas_participantes/mensagens (era o
-- erro real por trás do botão "Discutir esta aula" — o app mostrava a mensagem genérica
-- "falta rodar uma migração no banco" porque o catch de handleDiscutirAula engolia o erro
-- de verdade, mas o problema nunca foi migração faltando: é uma policy existente em
-- conversas_participantes que faz um EXISTS nela mesma pra checar participação, e o Postgres
-- não consegue resolver isso (precisa reaplicar a própria RLS da tabela dentro da subquery
-- da policy, infinitamente). Isso quebrava a lista de conversas inteira (Mensagens),
-- não só "Discutir aula" — confirmado testando com uma sessão autenticada real.
--
-- Fix padrão pra esse tipo de recursão: uma função SECURITY DEFINER que checa participação
-- ignorando RLS na consulta interna, usada nas policies em vez de um EXISTS direto na
-- própria tabela.

CREATE OR REPLACE FUNCTION participa_da_conversa(p_conversa_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversas_participantes
    WHERE conversa_id = p_conversa_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

GRANT EXECUTE ON FUNCTION participa_da_conversa TO authenticated;

-- Remove todas as policies atuais dessas 3 tabelas (uma delas é a recursiva — nomes não
-- rastreados em migration nenhuma, essas tabelas foram criadas fora do histórico versionado,
-- por isso o DROP é dinâmico por nome real em vez de citar um nome fixo que pode não bater).
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversas_participantes' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON conversas_participantes', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversas' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON conversas', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mensagens' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON mensagens', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversas_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;

-- conversas: só quem participa vê; qualquer authenticated pode criar uma nova (o próprio
-- fluxo do app insere os participantes logo em seguida, no mesmo mutationFn).
CREATE POLICY "participantes_veem_conversa" ON conversas
  FOR SELECT TO authenticated
  USING (participa_da_conversa(id));

CREATE POLICY "authenticated_cria_conversa" ON conversas
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- conversas_participantes: só quem já participa vê a lista de participantes; inserir só é
-- permitido pra si mesmo (entrar numa conversa) ou por quem já participa dela (adicionar
-- outro participante) — cobre o fluxo de criar conversa nova (primeiro insert é sempre o
-- próprio usuário, o que libera o segundo insert do destinatário).
CREATE POLICY "participantes_veem_participantes" ON conversas_participantes
  FOR SELECT TO authenticated
  USING (participa_da_conversa(conversa_id));

CREATE POLICY "insere_participante_proprio_ou_ja_participante" ON conversas_participantes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR participa_da_conversa(conversa_id));

-- mensagens: só participante da conversa lê ou envia, e só em nome de si mesmo.
CREATE POLICY "participantes_veem_mensagens" ON mensagens
  FOR SELECT TO authenticated
  USING (participa_da_conversa(conversa_id));

CREATE POLICY "participantes_enviam_mensagem" ON mensagens
  FOR INSERT TO authenticated
  WITH CHECK (participa_da_conversa(conversa_id) AND autor_id = auth.uid());
