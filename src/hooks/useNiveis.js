import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useNiveis(modalidadeId = null) {
  return useQuery({
    queryKey: ['niveis', modalidadeId],
    queryFn: async () => {
      let q = supabase
        .from('niveis')
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

export function useNiveisActions() {
  const qc = useQueryClient()

  async function salvar({ id, ...dados }) {
    const payload = {
      nome: dados.nome,
      modalidade_id: dados.modalidade_id || null,
    }
    if (id) {
      const { error } = await supabase.from('niveis').update(payload).eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('niveis').insert(payload)
      if (error) throw error
    }
    await qc.invalidateQueries({ queryKey: ['niveis'] })
  }

  async function excluir(id) {
    const { error } = await supabase.from('niveis').update({ ativo: false }).eq('id', id)
    if (error) throw error
    await qc.invalidateQueries({ queryKey: ['niveis'] })
  }

  return { salvar, excluir }
}