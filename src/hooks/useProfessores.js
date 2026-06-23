import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

export function useProfessores(modalidadeId = null) {
  return useQuery({
    queryKey: ['professores', modalidadeId],
    queryFn: async () => {
      let q = supabase
        .from('professores')
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

export function useProfessor(id) {
  return useQuery({
    queryKey: ['professor', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores')
        .select('*, modalidades(nome, icone_emoji, cor_hex)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id
  })
}

export function useSalvarProfessor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...dados }) => {
      const sanitized = Object.fromEntries(
        Object.entries(dados).map(([k, v]) => [k, v === '' ? null : v])
      )
      if (sanitized.valor_hora_aula !== null) {
        sanitized.valor_hora_aula = Number(sanitized.valor_hora_aula)
      }
      if (id) {
        const { data: anterior } = await supabase.from('professores').select('*').eq('id', id).single()
        const { data, error } = await supabase.from('professores').update(sanitized).eq('id', id).select().single()
        if (error) throw error
        await logAudit('professores', id, 'UPDATE', anterior, data)
        return data
      } else {
        const { data, error } = await supabase.from('professores').insert(sanitized).select().single()
        if (error) throw error
        await logAudit('professores', data.id, 'INSERT', null, data)
        return data
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professores'] })
  })
}

export function useExcluirProfessor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('professores').update({ ativo: false }).eq('id', id)
      if (error) throw error
      await logAudit('professores', id, 'DELETE', null, null)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professores'] })
  })
}
