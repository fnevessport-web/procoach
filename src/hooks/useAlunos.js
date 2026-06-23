import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

export function useAlunos(modalidadeId = null) {
  return useQuery({
    queryKey: ['alunos', modalidadeId],
    queryFn: async () => {
      let q = supabase
        .from('alunos')
        .select('*, modalidades(nome, icone_emoji, cor_hex)')
        .eq('ativo', true)
        .order('nome')

      if (modalidadeId) q = q.eq('modalidade_id', modalidadeId)

      const { data, error } = await q
      if (error) throw error
      return data
    }
  })
}

export function useSalvarAluno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...dados }) => {
      if (id) {
        const { data: anterior } = await supabase.from('alunos').select('*').eq('id', id).single()
        const { data, error } = await supabase.from('alunos').update(dados).eq('id', id).select().single()
        if (error) throw error
        await logAudit('alunos', id, 'UPDATE', anterior, data)
        return data
      } else {
        const { data, error } = await supabase.from('alunos').insert(dados).select().single()
        if (error) throw error
        await logAudit('alunos', data.id, 'INSERT', null, data)
        return data
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alunos'] })
  })
}

export function useExcluirAluno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('alunos').update({ ativo: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alunos'] })
  })
}
