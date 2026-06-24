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

      if (modalidadeId) {
        query = query.eq('modalidade_id', modalidadeId)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: true,
  })

  const invalidar = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['professores'] })
  }, [queryClient])

  return { professores, isLoading, invalidar }
}