import { format } from 'date-fns'
import { supabase } from './supabase'

// Matrícula de mensalista numa turma: vincula em turmas_alunos e cria a presença dele em todas
// as aulas já geradas dessa turma a partir da data da aula (ou de hoje, o que vier antes).
// Antes morava dentro de AulasCoordenador.jsx; saiu pra cá porque a aprovação de inclusão
// (AprovarInclusoesPage) também precisa matricular quando aprova "como mensalista".
export async function vincularMensalistasNaTurma(aula, mensalistas) {
  if (!aula.turma_id || mensalistas.length === 0) return
  const alunoIds = mensalistas.map(p => p.aluno_id)

  await supabase.from('turmas_alunos').upsert(
    alunoIds.map(aluno_id => ({ turma_id: aula.turma_id, aluno_id, ativo: true })),
    { onConflict: 'turma_id,aluno_id' }
  )

  const piso = aula.data_aula < format(new Date(), 'yyyy-MM-dd') ? aula.data_aula : format(new Date(), 'yyyy-MM-dd')
  const { data: aulasFuturas } = await supabase
    .from('aulas').select('id')
    .eq('turma_id', aula.turma_id)
    .gte('data_aula', piso)
    .lte('data_aula', '2026-12-31')
  const idsAulasFuturas = (aulasFuturas || []).map(a => a.id)
  if (idsAulasFuturas.length === 0) return

  const { data: presencasExistentes } = await supabase
    .from('presencas').select('aula_id, aluno_id')
    .in('aula_id', idsAulasFuturas).in('aluno_id', alunoIds)
  const jaTem = new Set((presencasExistentes || []).map(p => `${p.aula_id}_${p.aluno_id}`))

  const faltantes = []
  for (const aulaFuturaId of idsAulasFuturas) {
    for (const alunoId of alunoIds) {
      if (!jaTem.has(`${aulaFuturaId}_${alunoId}`)) {
        faltantes.push({ aula_id: aulaFuturaId, aluno_id: alunoId, presente: false, status_presenca: 'presente', tipo_participacao: 'mensalista' })
      }
    }
  }
  if (faltantes.length > 0) {
    await supabase.from('presencas').insert(faltantes)
  }
}

// Folga pra considerar que a matrícula/presenças foram criadas pelo MESMO salvamento da inclusão.
const JANELA_MS = 15 * 60 * 1000

// Até 30/09/2026, professor incluindo aluno como mensalista já matriculava na hora (turmas_alunos +
// presença em todas as aulas seguintes, e essas presenças contavam no pagamento sem aprovação).
// Quando a coordenação aprova a inclusão como outro tipo, ou recusa, desfaz SÓ o que aquela
// inclusão criou: a matrícula se ela nasceu junto com a inclusão (quem já era da turma antes
// continua), e as presenças automáticas das aulas seguintes que ninguém marcou como presente.
export async function desfazerMatriculaDaInclusao({ alunoId, turmaId, dataAula, inclusaoEm }) {
  if (!turmaId || !inclusaoEm) return { matriculaDesfeita: false, presencasRemovidas: 0 }
  const desde = new Date(new Date(inclusaoEm).getTime() - JANELA_MS).toISOString()

  const { data: matricula } = await supabase.from('turmas_alunos')
    .select('id, criado_em').eq('turma_id', turmaId).eq('aluno_id', alunoId).maybeSingle()
  const matriculaDaInclusao = !!matricula && matricula.criado_em >= desde
  if (!matriculaDaInclusao) return { matriculaDesfeita: false, presencasRemovidas: 0 }

  const { error: errMat } = await supabase.from('turmas_alunos').update({ ativo: false }).eq('id', matricula.id)
  if (errMat) throw errMat

  const { data: futuras, error: errFut } = await supabase.from('presencas')
    .select('id, aulas!inner(turma_id, data_aula)')
    .eq('aluno_id', alunoId).eq('aulas.turma_id', turmaId).gt('aulas.data_aula', dataAula)
    .eq('tipo_participacao', 'mensalista').is('status_inclusao_professor', null)
    .eq('presente', false).gte('criado_em', desde)
  if (errFut) throw errFut
  const ids = (futuras || []).map(p => p.id)
  if (ids.length) {
    const { error } = await supabase.from('presencas').delete().in('id', ids)
    if (error) throw error
  }
  return { matriculaDesfeita: true, presencasRemovidas: ids.length }
}
