import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// A Evolução Técnica desse projeto é (por enquanto) só de Tênis — resolve o id em runtime em
// vez de cravar o uuid no código, já que ele é gerado e pode mudar de ambiente pra ambiente.
export function useModalidadeTenisId() {
  const { data } = useQuery({
    queryKey: ['modalidade_tenis_id'],
    queryFn: async () => {
      const { data, error } = await supabase.from('modalidades').select('id').eq('nome', 'Tênis').maybeSingle()
      if (error) throw error
      return data?.id || null
    },
    staleTime: Infinity,
  })
  return data
}
