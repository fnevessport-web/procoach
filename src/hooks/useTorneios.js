import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Torneios internos — jogos vinculados a um torneio (ranking_jogos.origem='torneio') valem o
// dobro em vitória/derrota normal (ver PONTOS_POR_RESULTADO em pontuacaoBeyond.js). Este
// arquivo só cuida do cadastro/ciclo de vida do torneio em si; o jogo em si continua sendo
// criado por useCriarJogo (useRanking.js), passando origem+torneioId.
export function useTorneios(modalidadeId) {
  return useQuery({
    queryKey: ['ranking_torneios', modalidadeId],
    enabled: !!modalidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ranking_torneios')
        .select('*, ranking_categorias(nome)')
        .eq('modalidade_id', modalidadeId)
        .order('data_inicio', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
}

export function useCriarTorneio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ nome, modalidadeId, categoriaId, dataInicio, dataFim }) => {
      const { data, error } = await supabase.from('ranking_torneios').insert({
        nome,
        modalidade_id: modalidadeId,
        categoria_id: categoriaId || null,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
      }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ranking_torneios'] }),
  })
}

// planejado -> em_andamento -> encerrado, ou cancelado a qualquer momento antes de encerrar.
// Não impede criar jogo em torneio encerrado/cancelado no banco (RLS é a mesma de tudo mais
// nesse módulo), mas a Aba Ranking só oferece torneios planejado/em_andamento na hora de
// escolher em qual torneio um jogo entra.
export function useAtualizarStatusTorneio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ torneioId, status }) => {
      const { error } = await supabase.from('ranking_torneios').update({ status }).eq('id', torneioId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ranking_torneios'] }),
  })
}
