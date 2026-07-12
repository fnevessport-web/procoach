import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// "Professor atual de um aluno numa modalidade" = professor_titular_id de toda turma em que
// o aluno esta ativo (turmas_alunos.ativo) dentro daquela modalidade. Funcao pura (sem hook)
// pra poder ser chamada tanto pelo hook de tela quanto de dentro de uma mutation (regra de
// confirmacao multi-professor ao salvar avaliacao) — reusada em tres lugares: lista + atalho
// de mensagem no Card do Aluno, resolucao de quem precisa confirmar uma avaliacao (fase 2) e
// a metrica agregada de turma (fase 3).
export async function buscarProfessoresDoAlunoNaModalidade(alunoId, modalidadeId) {
  const { data, error } = await supabase
    .from('turmas_alunos')
    .select('turmas!inner(modalidade_id, professores(id, nome, foto_url))')
    .eq('aluno_id', alunoId)
    .eq('ativo', true)
    .eq('turmas.modalidade_id', modalidadeId)
  if (error) throw error

  const porProfessor = {}
  data?.forEach(row => {
    const prof = row.turmas?.professores
    if (prof && !porProfessor[prof.id]) {
      porProfessor[prof.id] = { professorId: prof.id, nome: prof.nome, fotoUrl: prof.foto_url }
    }
  })
  const professores = Object.values(porProfessor)
  if (!professores.length) return []

  // conversas_participantes/alertas usam user_id (auth), não professor_id — resolve o vínculo
  // pra quem já tem login no ProCoach (professor sem perfil ainda não recebe atalho de
  // mensagem nem entra na regra de confirmação, já que não teria como confirmar)
  const { data: perfis } = await supabase
    .from('perfis_usuario')
    .select('user_id, professor_id')
    .in('professor_id', professores.map(p => p.professorId))
  const userIdPorProfessor = Object.fromEntries((perfis || []).map(p => [p.professor_id, p.user_id]))

  return professores.map(p => ({ ...p, userId: userIdPorProfessor[p.professorId] || null }))
}

export function useProfessoresDoAlunoNaModalidade(alunoId, modalidadeId) {
  return useQuery({
    queryKey: ['professores_aluno_modalidade', alunoId, modalidadeId],
    enabled: !!alunoId && !!modalidadeId,
    queryFn: () => buscarProfessoresDoAlunoNaModalidade(alunoId, modalidadeId),
  })
}
