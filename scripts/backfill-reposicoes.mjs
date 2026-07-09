// Backfill único: liga (FIFO) as reposições feitas no passado por fora da aba dedicada de
// Reposição — aluno marcado com tipo_participacao='reposicao' na lista de presença de
// qualquer aula — às faltas justificadas mais antigas de cada aluno que ainda não têm
// registro na tabela `reposicoes`. Sem isso, o histórico dessas reposições nunca aparece
// e a contagem de "pendentes" fica inflada por aulas que já aconteceram.
//
// Rode em modo dry-run primeiro (padrão) pra conferir os pares antes de gravar:
//   node scripts/backfill-reposicoes.mjs
// Depois de conferir, aplique de fato:
//   node scripts/backfill-reposicoes.mjs --apply

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const content = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim()
  }
  return env
}

const env = loadEnv()
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_KEY)

const APLICAR = process.argv.includes('--apply')

async function main() {
  const { data: faltas, error: errFaltas } = await supabase
    .from('presencas')
    .select('id, aluno_id, aula_id, alunos(nome), aulas!inner(data_aula)')
    .eq('status_presenca', 'falta_justificada')
  if (errFaltas) throw errFaltas

  const { data: reposPresencas, error: errRepos } = await supabase
    .from('presencas')
    .select('id, aluno_id, aula_id, aulas!inner(data_aula)')
    .eq('tipo_participacao', 'reposicao')
  if (errRepos) throw errRepos

  const { data: jaLigadas, error: errJaLigadas } = await supabase
    .from('reposicoes')
    .select('aluno_id, aula_origem_id, aula_reposicao_id')
  if (errJaLigadas) throw errJaLigadas

  const origensJaLigadas = new Set((jaLigadas || []).map(r => `${r.aluno_id}_${r.aula_origem_id}`))
  const destinosJaLigados = new Set((jaLigadas || []).map(r => `${r.aluno_id}_${r.aula_reposicao_id}`))

  const faltasPorAluno = {}
  faltas.forEach(f => {
    if (origensJaLigadas.has(`${f.aluno_id}_${f.aula_id}`)) return
    if (!faltasPorAluno[f.aluno_id]) faltasPorAluno[f.aluno_id] = { nome: f.alunos?.nome, faltas: [] }
    faltasPorAluno[f.aluno_id].faltas.push({ aulaId: f.aula_id, data: f.aulas?.data_aula })
  })

  const reposPorAluno = {}
  reposPresencas.forEach(r => {
    if (destinosJaLigados.has(`${r.aluno_id}_${r.aula_id}`)) return
    if (!reposPorAluno[r.aluno_id]) reposPorAluno[r.aluno_id] = []
    reposPorAluno[r.aluno_id].push({ aulaId: r.aula_id, data: r.aulas?.data_aula })
  })

  const paresParaInserir = []
  let alunosComSobra = 0

  for (const [alunoId, info] of Object.entries(faltasPorAluno)) {
    const faltasOrdenadas = [...info.faltas].sort((a, b) => (a.data || '').localeCompare(b.data || ''))
    // Disponíveis pra consumir — uma reposição só pode resolver uma falta que já aconteceu
    // (data da reposição >= data da falta), nunca uma falta futura.
    const disponiveis = [...(reposPorAluno[alunoId] || [])].sort((a, b) => (a.data || '').localeCompare(b.data || ''))

    const pares = []
    const faltasSemPar = []
    for (const falta of faltasOrdenadas) {
      const idx = disponiveis.findIndex(r => (r.data || '') >= (falta.data || ''))
      if (idx === -1) { faltasSemPar.push(falta); continue }
      const [repo] = disponiveis.splice(idx, 1)
      pares.push({ falta, repo })
    }

    if (pares.length === 0 && faltasSemPar.length === 0) continue

    console.log(`\n${info.nome} (${alunoId})`)
    pares.forEach(({ falta, repo }) => {
      console.log(`  falta ${falta.data} → reposição ${repo.data}`)
      paresParaInserir.push({
        aluno_id: alunoId,
        aula_origem_id: falta.aulaId,
        aula_reposicao_id: repo.aulaId,
        status: 'agendada',
      })
    })
    if (faltasSemPar.length > 0) { console.log(`  ⚠ ${faltasSemPar.length} falta(s) sem reposição pra parear — continuam pendentes`); alunosComSobra++ }
    if (disponiveis.length > 0) { console.log(`  ⚠ ${disponiveis.length} reposição(ões) sobrando sem falta compatível (data anterior à falta, ou sem falta correspondente) — não tocadas`); alunosComSobra++ }
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`${paresParaInserir.length} pares encontrados · ${alunosComSobra} aluno(s) com sobra pra revisar`)

  if (!APLICAR) {
    console.log('\n🔎 Dry-run — nada foi gravado. Rode com --apply pra gravar de verdade.')
    return
  }

  if (paresParaInserir.length === 0) {
    console.log('\nNada pra gravar.')
    return
  }

  const { error: errInsert } = await supabase
    .from('reposicoes')
    .upsert(paresParaInserir, { onConflict: 'aluno_id,aula_origem_id' })
  if (errInsert) throw errInsert
  console.log(`\n✅ ${paresParaInserir.length} reposições ligadas retroativamente.`)
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
