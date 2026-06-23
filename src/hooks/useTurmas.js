import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

export function useTurmas(modalidadeId = null) {
  return useQuery({
    queryKey: ['turmas', modalidadeId],
    queryFn: async () => {
      let q = supabase
        .from('turmas')
        .select(`
          *,
          modalidades(nome, icone_emoji, cor_hex),
          professores!professor_titular_id(nome),
          niveis!nivel_id(nome),
          quadras!quadra_id(nome),
          turmas_alunos(aluno_id, ativo, alunos(nome))
        `)
        .eq('ativo', true)
        .order('nome')

      if (modalidadeId) q = q.eq('modalidade_id', modalidadeId)

      const { data, error } = await q
      if (error) throw error
      return data
    }
  })
}

export function useTurma(id) {
  return useQuery({
    queryKey: ['turma', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('turmas')
        .select(`
          *,
          modalidades(nome, icone_emoji, cor_hex),
          professores!professor_titular_id(id, nome),
          niveis!nivel_id(id, nome),
          quadras!quadra_id(id, nome),
          turmas_alunos(id, aluno_id, ativo, alunos(id, nome))
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id
  })
}

export function useSalvarTurma() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, alunos_ids = [], ...dados }) => {
      let turmaId = id
      if (id) {
        const { data: anterior } = await supabase.from('turmas').select('*').eq('id', id).single()
        const { data, error } = await supabase.from('turmas').update(dados).eq('id', id).select().single()
        if (error) throw error
        await logAudit('turmas', id, 'UPDATE', anterior, data)
      } else {
        const { data, error } = await supabase.from('turmas').insert(dados).select().single()
        if (error) throw error
        turmaId = data.id
        await logAudit('turmas', turmaId, 'INSERT', null, data)
      }

      // Sync alunos
      await supabase.from('turmas_alunos').update({ ativo: false }).eq('turma_id', turmaId)
      if (alunos_ids.length > 0) {
        const rows = alunos_ids.map(aluno_id => ({ turma_id: turmaId, aluno_id, ativo: true }))
        await supabase.from('turmas_alunos').upsert(rows, { onConflict: 'turma_id,aluno_id' })
      }

      return turmaId
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['turmas'] })
      qc.invalidateQueries({ queryKey: ['turma'] })
    }
  })
}
