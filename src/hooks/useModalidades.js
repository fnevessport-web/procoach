import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useModalidades() {
  return useQuery({
    queryKey: ['modalidades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modalidades')
        .select('*')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return data
    },
    staleTime: 1000 * 60 * 10
  })
}
