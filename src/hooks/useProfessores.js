import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useProfessores(modalidadeId) {
  const queryClient = useQueryClient()

  const { data: professores = [], isLoading } = useQuery({
    queryKey: ['professores', modalidadeId],
    queryFn: async () => {
      let query = supabase
        .from('professores')
        .select('*, modalidades(nome)')
        .order('nome')

      const { data, error } = await query
      if (error) throw error
      if (modalidadeId) {
        return (data || []).filter(p =>
          p.modalidade_id === modalidadeId ||
          (p.modalidades_ids && p.modalidades_ids.includes(modalidadeId))
        )
      }
      return data || []
    },
    enabled: true,
  })

  const invalidar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['professores'] })
  }, [queryClient])

  return { professores, isLoading, invalidar }
}