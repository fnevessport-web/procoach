import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { NOMES_PROFESSORES_PESQUISA_SOCIOS } from '../constants/pesquisaSocios'

// Todas as campanhas já criadas (mais recente primeiro), com a contagem de respostas de
// cada uma. RLS de pesquisa_socios_campanhas/respostas só libera pra role 'admin' (ver
// 032_pesquisa_socios.sql) — qualquer outro role recebe lista vazia, nunca erro.
export function useCampanhasPesquisaSocios() {
  return useQuery({
    queryKey: ['pesquisa_socios_campanhas'],
    queryFn: async () => {
      const { data: campanhas, error } = await supabase
        .from('pesquisa_socios_campanhas')
        .select('*')
        .order('criado_em', { ascending: false })
      if (error) throw error

      const { data: respostas, error: e2 } = await supabase
        .from('pesquisa_socios_respostas')
        .select('campanha_id')
      if (e2) throw e2

      const contagemPorCampanha = {}
      ;(respostas || []).forEach(r => { contagemPorCampanha[r.campanha_id] = (contagemPorCampanha[r.campanha_id] || 0) + 1 })

      return (campanhas || []).map(c => ({ ...c, qtdRespostas: contagemPorCampanha[c.id] || 0 }))
    },
  })
}

export function useCriarCampanhaPesquisaSocios() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nome) => {
      const { data, error } = await supabase.from('pesquisa_socios_campanhas').insert({ nome }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pesquisa_socios_campanhas'] }),
  })
}

// Todas as respostas de uma campanha, mais recente primeiro — cada envio é uma linha à
// parte (RPC salvar_resposta_pesquisa_socios só faz INSERT, nunca sobrescreve).
export function useRespostasCampanha(campanhaId) {
  return useQuery({
    queryKey: ['pesquisa_socios_respostas', campanhaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pesquisa_socios_respostas')
        .select('*')
        .eq('campanha_id', campanhaId)
        .order('respondido_em', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!campanhaId,
  })
}

// Os 13 professores fixos da pesquisa (id/nome/foto_url) — usado do lado admin (sessão
// authenticated, leitura direta OK) pra montar os cards de desempenho por professor e a
// navegação de respostas individuais. A página pública usa a RPC
// listar_professores_pesquisa_socios em vez disso (sessão anon não lê `professores` direto).
export function useProfessoresPesquisaSocios() {
  return useQuery({
    queryKey: ['professores_pesquisa_socios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores')
        .select('id, nome, foto_url')
        .in('nome', NOMES_PROFESSORES_PESQUISA_SOCIOS)
        .order('nome')
      if (error) throw error
      return data || []
    },
  })
}
