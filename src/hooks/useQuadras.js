import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

export function useQuadras(modalidadeId = null) {
  return useQuery({
    queryKey: ['quadras', modalidadeId],
    queryFn: async () => {
      let q = supabase
        .from('quadras')
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

export function useSalvarQuadra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...dados }) => {
      const sanitized = Object.fromEntries(
        Object.entries(dados).map(([k, v]) => [k, v === '' ? null : v])
      )
      if (id) {
        const { data: anterior } = await supabase.from('quadras').select('*').eq('id', id).single()
        const { data, error } = await supabase.from('quadras').update(sanitized).eq('id', id).select().single()
        if (error) throw error
        await logAudit('quadras', id, 'UPDATE', anterior, data)
        return data
      } else {
        const { data, error } = await supabase.from('quadras').insert(sanitized).select().single()
        if (error) throw error
        await logAudit('quadras', data.id, 'INSERT', null, data)
        return data
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quadras'] })
  })
}

export function useExcluirQuadra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('quadras').update({ ativo: false }).eq('id', id)
      if (error) throw error
      await logAudit('quadras', id, 'DELETE', null, null)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quadras'] })
  })
}
