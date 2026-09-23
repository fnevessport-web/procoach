import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Presenças que um PROFESSOR incluiu na própria aula (status_inclusao_professor) — nascem
// 'pendente' e não contam pro pagamento (ver qtdAlunosPagantes em modalidades.js) até a
// coordenação decidir aqui. Ver scripts/2026-09-23_aprovacao_inclusao_professor.sql.
export function useInclusoesPendentes() {
  return useQuery({
    queryKey: ['inclusoes-pendentes'],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presencas')
        .select(`
          id, aluno_id, tipo_participacao, motivo_inclusao, criado_por_nome, criado_em,
          alunos(nome),
          aulas(id, data_aula, turmas(nome, horario_inicio, modalidades(nome)), professores!professor_executou_id(nome))
        `)
        .eq('status_inclusao_professor', 'pendente')
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
}

export function useDecidirInclusaoPendente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ presencaId, aprovar }) => {
      const { error } = await supabase.from('presencas')
        .update({ status_inclusao_professor: aprovar ? 'aprovado' : 'rejeitado' })
        .eq('id', presencaId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inclusoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aulas'] })
      qc.invalidateQueries({ queryKey: ['fin_custos_prof'] })
      qc.invalidateQueries({ queryKey: ['fin_aulas_prof'] })
      qc.invalidateQueries({ queryKey: ['fin_aulas_ano_prof'] })
    },
  })
}
