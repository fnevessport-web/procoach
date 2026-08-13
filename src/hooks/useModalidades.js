import { useQuery, useQueryClient } from '@tanstack/react-query'
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

export function useModalidadesActions() {
  const qc = useQueryClient()

  async function salvar({ id, ...dados }) {
    const payload = {
      nome: dados.nome,
      icone_emoji: dados.icone_emoji || null,
      cor_hex: dados.cor_hex || null,
    }
    if (id) {
      const { error } = await supabase.from('modalidades').update(payload).eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('modalidades').insert(payload)
      if (error) throw error
    }
    await qc.invalidateQueries({ queryKey: ['modalidades'] })
  }

  async function excluir(id) {
    const { error } = await supabase.from('modalidades').update({ ativo: false }).eq('id', id)
    if (error) throw error
    await qc.invalidateQueries({ queryKey: ['modalidades'] })
  }

  return { salvar, excluir }
}
