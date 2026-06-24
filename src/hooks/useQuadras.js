import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

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

export function useQuadrasActions() {
  const qc = useQueryClient()

  async function salvar({ id, ...dados }) {
    const payload = {
      nome: dados.nome,
      modalidade_id: dados.modalidade_id || null,
    }
    if (id) {
      const { error } = await supabase.from('quadras').update(payload).eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('quadras').insert(payload)
      if (error) throw error
    }
    await qc.invalidateQueries({ queryKey: ['quadras'] })
  }

  async function excluir(id) {
    const { error } = await supabase.from('quadras').update({ ativo: false }).eq('id', id)
    if (error) throw error
    await qc.invalidateQueries({ queryKey: ['quadras'] })
  }

  return { salvar, excluir }
}