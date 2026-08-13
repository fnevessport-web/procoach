import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// "Congelamento" de horário na Agenda Particular — bloqueio pontual (não recorrente) de uma
// célula dia+horário específica (ex: tempo de deslocação entre locais de aula). Diferente de
// uma aula: não tem turma/aluno, só um texto livre (motivo) e impede agendar naquela célula.
export function useBloqueiosAgenda(empresaId, dataInicio, dataFim) {
  return useQuery({
    queryKey: ['bloqueios_agenda', empresaId, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bloqueios_agenda')
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('data', dataInicio)
        .lte('data', dataFim)
      if (error) throw error
      return data
    },
    enabled: !!empresaId && !!dataInicio && !!dataFim,
  })
}

export function useCriarBloqueioAgenda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ empresaId, data, horario, motivo }) => {
      const { data: row, error } = await supabase
        .from('bloqueios_agenda')
        .insert({ empresa_id: empresaId, data, horario, motivo: motivo || null })
        .select()
        .single()
      if (error) throw error
      return row
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bloqueios_agenda'] }),
  })
}

export function useRemoverBloqueioAgenda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('bloqueios_agenda').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bloqueios_agenda'] }),
  })
}
