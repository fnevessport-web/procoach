// Executa o schema do ProCoach no Supabase
// Rode com: node scripts/migrate.mjs

const SUPABASE_URL = 'https://xmntwdppiflfwoaccknd.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtbnR3ZHBwaWZsZndvYWNja25kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTMxMjI3NywiZXhwIjoyMDk0ODg4Mjc3fQ.VSz-fzgIR32y0z93slAwEsXDG94dliSLWFkPVJFQkX8'

async function sql(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ sql: query })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res
}

// Executa cada instrução separadamente
const stmts = [
  // Perfis de usuário
  `CREATE TABLE IF NOT EXISTS perfis_usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'professor' CHECK (role IN ('admin','coordenador','professor')),
    nome TEXT, professor_id UUID, criado_em TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Modalidades
  `CREATE TABLE IF NOT EXISTS modalidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL, icone_emoji TEXT NOT NULL, cor_hex TEXT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE, criado_em TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Professores
  `CREATE TABLE IF NOT EXISTS professores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL, foto_url TEXT, telefone TEXT, email TEXT,
    modalidade_id UUID REFERENCES modalidades(id),
    valor_hora_aula DECIMAL(10,2), banco TEXT, agencia TEXT, conta TEXT,
    tipo_conta TEXT DEFAULT 'corrente' CHECK (tipo_conta IN ('corrente','poupanca')),
    pix TEXT, ativo BOOLEAN DEFAULT TRUE, criado_em TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Alunos
  `CREATE TABLE IF NOT EXISTS alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL, telefone TEXT, email TEXT,
    modalidade_id UUID REFERENCES modalidades(id),
    multiclubes_id TEXT, ativo BOOLEAN DEFAULT TRUE, criado_em TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Turmas
  `CREATE TABLE IF NOT EXISTS turmas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    modalidade_id UUID REFERENCES modalidades(id),
    professor_titular_id UUID REFERENCES professores(id),
    horario_dia_semana TEXT CHECK (horario_dia_semana IN ('segunda','terca','quarta','quinta','sexta','sabado','domingo')),
    horario_inicio TIME, horario_fim TIME,
    ativo BOOLEAN DEFAULT TRUE, criado_em TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Turmas x Alunos
  `CREATE TABLE IF NOT EXISTS turmas_alunos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turma_id UUID REFERENCES turmas(id) ON DELETE CASCADE NOT NULL,
    aluno_id UUID REFERENCES alunos(id) ON DELETE CASCADE NOT NULL,
    ativo BOOLEAN DEFAULT TRUE, criado_em TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (turma_id, aluno_id)
  )`,

  // Aulas
  `CREATE TABLE IF NOT EXISTS aulas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turma_id UUID REFERENCES turmas(id) ON DELETE CASCADE NOT NULL,
    professor_executou_id UUID REFERENCES professores(id),
    data_aula DATE NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','confirmada_professor','confirmada_coord','match','divergencia','nao_dada')),
    motivo_nao_dada TEXT, observacoes TEXT,
    eh_substituicao BOOLEAN DEFAULT FALSE,
    professor_titular_id UUID REFERENCES professores(id),
    criado_em TIMESTAMPTZ DEFAULT NOW(), atualizado_em TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Presenças
  `CREATE TABLE IF NOT EXISTS presencas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aula_id UUID REFERENCES aulas(id) ON DELETE CASCADE NOT NULL,
    aluno_id UUID REFERENCES alunos(id) ON DELETE CASCADE NOT NULL,
    presente BOOLEAN DEFAULT TRUE, criado_em TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (aula_id, aluno_id)
  )`,

  // Fechamentos
  `CREATE TABLE IF NOT EXISTS fechamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professor_id UUID REFERENCES professores(id) NOT NULL,
    periodo_inicio DATE NOT NULL, periodo_fim DATE NOT NULL,
    total_aulas INTEGER DEFAULT 0, valor_hora DECIMAL(10,2) DEFAULT 0,
    total_bruto DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto','fechado','pago')),
    criado_em TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Audit log
  `CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela TEXT NOT NULL, registro_id TEXT, acao TEXT NOT NULL,
    dados_anteriores JSONB, dados_novos JSONB, usuario TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
  )`,

  // RLS
  `ALTER TABLE perfis_usuario ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE modalidades ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE professores ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE alunos ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE turmas ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE turmas_alunos ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE aulas ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE presencas ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE fechamentos ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY`,

  // Políticas (DROP antes para ser idempotente)
  `DO $$ BEGIN
    DROP POLICY IF EXISTS "auth_modalidades" ON modalidades;
    CREATE POLICY "auth_modalidades" ON modalidades FOR ALL TO authenticated USING (true);
    DROP POLICY IF EXISTS "auth_perfis" ON perfis_usuario;
    CREATE POLICY "auth_perfis" ON perfis_usuario FOR ALL TO authenticated USING (true);
    DROP POLICY IF EXISTS "auth_professores" ON professores;
    CREATE POLICY "auth_professores" ON professores FOR ALL TO authenticated USING (true);
    DROP POLICY IF EXISTS "auth_alunos" ON alunos;
    CREATE POLICY "auth_alunos" ON alunos FOR ALL TO authenticated USING (true);
    DROP POLICY IF EXISTS "auth_turmas" ON turmas;
    CREATE POLICY "auth_turmas" ON turmas FOR ALL TO authenticated USING (true);
    DROP POLICY IF EXISTS "auth_turmas_alunos" ON turmas_alunos;
    CREATE POLICY "auth_turmas_alunos" ON turmas_alunos FOR ALL TO authenticated USING (true);
    DROP POLICY IF EXISTS "auth_aulas" ON aulas;
    CREATE POLICY "auth_aulas" ON aulas FOR ALL TO authenticated USING (true);
    DROP POLICY IF EXISTS "auth_presencas" ON presencas;
    CREATE POLICY "auth_presencas" ON presencas FOR ALL TO authenticated USING (true);
    DROP POLICY IF EXISTS "auth_fechamentos" ON fechamentos;
    CREATE POLICY "auth_fechamentos" ON fechamentos FOR ALL TO authenticated USING (true);
    DROP POLICY IF EXISTS "auth_audit" ON audit_log;
    CREATE POLICY "auth_audit" ON audit_log FOR ALL TO authenticated USING (true);
  END $$`,

  // Índices
  `CREATE INDEX IF NOT EXISTS idx_aulas_data ON aulas(data_aula)`,
  `CREATE INDEX IF NOT EXISTS idx_aulas_status ON aulas(status)`,
  `CREATE INDEX IF NOT EXISTS idx_aulas_professor ON aulas(professor_executou_id)`,
  `CREATE INDEX IF NOT EXISTS idx_presencas_aula ON presencas(aula_id)`,

  // Seed modalidades
  `INSERT INTO modalidades (nome, icone_emoji, cor_hex) VALUES
    ('Tênis', '🎾', '#2ECC71'),
    ('Padel', '🏓', '#3498DB'),
    ('Squash', '🟡', '#F39C12'),
    ('Pickleball', '🏸', '#9B59B6'),
    ('Beach Tennis', '🏖️', '#E74C3C'),
    ('Futevôlei', '🏐', '#1ABC9C'),
    ('Vôlei de Praia', '🌊', '#E67E22')
  ON CONFLICT DO NOTHING`,
]

console.log('\n🏆 ProCoach — Executando migration...\n')

let ok = 0, fail = 0

for (const stmt of stmts) {
  const label = stmt.trim().split('\n')[0].substring(0, 60)
  try {
    await sql(stmt)
    console.log(`  ✅ ${label}`)
    ok++
  } catch (err) {
    // Ignore "already exists" errors
    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
      console.log(`  ⚠️  ${label} (já existe, ignorado)`)
      ok++
    } else {
      console.log(`  ❌ ${label}`)
      console.log(`     ${err.message.substring(0, 120)}`)
      fail++
    }
  }
}

console.log(`\n${'─'.repeat(50)}`)
console.log(`✅ ${ok} ok   ❌ ${fail} erros`)

if (fail === 0) {
  console.log('\n🎉 Banco configurado! Agora rode: npm run dev')
} else {
  console.log('\n⚠️  Alguns erros ocorreram. Verifique no Supabase Dashboard > SQL Editor')
}
