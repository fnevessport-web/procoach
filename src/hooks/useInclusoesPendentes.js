import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { desfazerMatriculaDaInclusao, vincularMensalistasNaTurma } from '../lib/matriculaTurma'
import { resolverReposicaoFIFO } from './useAulas'

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
          aulas(id, data_aula, turma_id, turmas(nome, horario_inicio, modalidades(nome)), professores!professor_executou_id(nome))
        `)
        .eq('status_inclusao_professor', 'pendente')
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
}

// Decisão da coordenação. Ao aprovar, escolhe também o TIPO da participação (o professor pode ter
// incluído como mensalista algo que é reposição/cortesia):
//   - aprovado como mensalista: matricula na turma (turmas_alunos + aulas seguintes);
//   - aprovado como outro tipo, ou recusado: fica só nesta aula, e desfaz a matrícula automática
//     que inclusões antigas de professor criavam (ver desfazerMatriculaDaInclusao).
export function useDecidirInclusaoPendente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ item, aprovar, tipo }) => {
      const patch = { status_inclusao_professor: aprovar ? 'aprovado' : 'rejeitado' }
      if (aprovar && tipo) patch.tipo_participacao = tipo
      const { error } = await supabase.from('presencas').update(patch).eq('id', item.id)
      if (error) throw error

      const aula = item.aulas
      // Reposição aprovada dá baixa na falta justificada mais antiga do aluno (mesmo FIFO da agenda).
      if (aprovar && tipo === 'reposicao' && aula?.id) await resolverReposicaoFIFO({ alunoId: item.aluno_id, aulaDestinoId: aula.id })
      if (!aula?.turma_id) return {}
      if (aprovar && tipo === 'mensalista') {
        await vincularMensalistasNaTurma({ turma_id: aula.turma_id, data_aula: aula.data_aula }, [{ aluno_id: item.aluno_id }])
        return { matriculado: true }
      }
      return desfazerMatriculaDaInclusao({ alunoId: item.aluno_id, turmaId: aula.turma_id, dataAula: aula.data_aula, inclusaoEm: item.criado_em })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inclusoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aulas'] })
      qc.invalidateQueries({ queryKey: ['turmas'] })
      qc.invalidateQueries({ queryKey: ['relatorio_repos'] })
      qc.invalidateQueries({ queryKey: ['fin_custos_prof'] })
      qc.invalidateQueries({ queryKey: ['fin_aulas_prof'] })
      qc.invalidateQueries({ queryKey: ['fin_aulas_ano_prof'] })
    },
  })
}
