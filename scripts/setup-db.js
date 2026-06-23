// Script para executar o schema no Supabase via REST API
// Rode com: node scripts/setup-db.js

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.SUPABASE_URL || 'https://xmntwdppiflfwoaccknd.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const sql = readFileSync(join(__dirname, '../supabase/migrations/001_initial_schema.sql'), 'utf-8')

// Split por comandos individuais (separados por ponto-e-vírgula seguido de linha nova)
const stmts = sql
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

console.log(`\n🏆 ProCoach — Configurando banco de dados...`)
console.log(`📦 ${stmts.length} comandos encontrados\n`)

let sucesso = 0
let erros = 0

for (const stmt of stmts) {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' })
    if (error) {
      console.log(`⚠️  ${stmt.substring(0, 60)}...`)
      console.log(`   Erro: ${error.message}\n`)
      erros++
    } else {
      sucesso++
    }
  } catch (e) {
    erros++
  }
}

console.log(`\n✅ Concluído! ${sucesso} ok, ${erros} erros`)
console.log(`\nPróximos passos:`)
console.log(`  npm run dev — iniciar o servidor`)
