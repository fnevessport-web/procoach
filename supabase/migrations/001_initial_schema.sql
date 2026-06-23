-- =============================================
-- ProCoach — Schema completo
-- =============================================

-- Perfis de usuário (vinculados ao auth.users)
CREATE TABLE IF NOT EXISTS perfis_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'professor' CHECK (role IN ('admin', 'coordenador', 'professor')),
  nome TEXT,
  professor_id UUID,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Modalidades esportivas
CREATE TABLE IF NOT EXISTS modalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  icone_emoji TEXT NOT NULL,
  cor_hex TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Professores
CREATE TABLE IF NOT EXISTS professores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  foto_url TEXT,
  telefone TEXT,
  email TEXT,
  modalidade_id UUID REFERENCES modalidades(id),
  valor_hora_aula DECIMAL(10,2),
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo_conta TEXT DEFAULT 'corrente' CHECK (tipo_conta IN ('corrente', 'poupanca')),
  pix TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Alunos
CREATE TABLE IF NOT EXISTS alunos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  modalidade_id UUID REFERENCES modalidades(id),
  multiclubes_id TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Turmas
CREATE TABLE IF NOT EXISTS turmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  modalidade_id UUID REFERENCES modalidades(id),
  professor_titular_id UUID REFERENCES professores(id),
  horario_dia_semana TEXT CHECK (horario_dia_semana IN ('segunda','terca','quarta','quinta','sexta','sabado','domingo')),
  horario_inicio TIME,
  horario_fim TIME,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Relação turma <-> aluno
CREATE TABLE IF NOT EXISTS turmas_alunos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id UUID REFERENCES turmas(id) ON DELETE CASCADE NOT NULL,
  aluno_id UUID REFERENCES alunos(id) ON DELETE CASCADE NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (turma_id, aluno_id)
);

-- Aulas
CREATE TABLE IF NOT EXISTS aulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id UUID REFERENCES turmas(id) ON DELETE CASCADE NOT NULL,
  professor_executou_id UUID REFERENCES professores(id),
  data_aula DATE NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','confirmada_professor','confirmada_coord','match','divergencia','nao_dada')),
  motivo_nao_dada TEXT,
  observacoes TEXT,
  eh_substituicao BOOLEAN DEFAULT FALSE,
  professor_titular_id UUID REFERENCES professores(id),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Presenças
CREATE TABLE IF NOT EXISTS presencas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id UUID REFERENCES aulas(id) ON DELETE CASCADE NOT NULL,
  aluno_id UUID REFERENCES alunos(id) ON DELETE CASCADE NOT NULL,
  presente BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (aula_id, aluno_id)
);

-- Fechamentos financeiros
CREATE TABLE IF NOT EXISTS fechamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id UUID REFERENCES professores(id) NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  total_aulas INTEGER DEFAULT 0,
  valor_hora DECIMAL(10,2) DEFAULT 0,
  total_bruto DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto','fechado','pago')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela TEXT NOT NULL,
  registro_id TEXT,
  acao TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS (Row Level Security)
-- =============================================
ALTER TABLE perfis_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE modalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE professores ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fechamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para usuários autenticados
CREATE POLICY "Auth users can read modalidades" ON modalidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage modalidades" ON modalidades FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read perfis" ON perfis_usuario FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage perfis" ON perfis_usuario FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read professores" ON professores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage professores" ON professores FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read alunos" ON alunos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage alunos" ON alunos FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read turmas" ON turmas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage turmas" ON turmas FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read turmas_alunos" ON turmas_alunos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage turmas_alunos" ON turmas_alunos FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read aulas" ON aulas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage aulas" ON aulas FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read presencas" ON presencas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage presencas" ON presencas FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read fechamentos" ON fechamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage fechamentos" ON fechamentos FOR ALL TO authenticated USING (true);

CREATE POLICY "Auth users can read audit_log" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage audit_log" ON audit_log FOR ALL TO authenticated USING (true);

-- =============================================
-- Índices de performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_aulas_data ON aulas(data_aula);
CREATE INDEX IF NOT EXISTS idx_aulas_status ON aulas(status);
CREATE INDEX IF NOT EXISTS idx_aulas_professor ON aulas(professor_executou_id);
CREATE INDEX IF NOT EXISTS idx_presencas_aula ON presencas(aula_id);
CREATE INDEX IF NOT EXISTS idx_audit_tabela ON audit_log(tabela, registro_id);

-- =============================================
-- SEED: Modalidades
-- =============================================
INSERT INTO modalidades (nome, icone_emoji, cor_hex) VALUES
  ('Tênis', '🎾', '#2ECC71'),
  ('Padel', '🏓', '#3498DB'),
  ('Squash', '🟡', '#F39C12'),
  ('Pickleball', '🏸', '#9B59B6'),
  ('Beach Tennis', '🏖️', '#E74C3C'),
  ('Futevôlei', '🏐', '#1ABC9C'),
  ('Vôlei de Praia', '🌊', '#E67E22')
ON CONFLICT DO NOTHING;
