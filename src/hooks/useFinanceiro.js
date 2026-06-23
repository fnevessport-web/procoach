import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

export function useFechamentos(professorId = null) {
  return useQuery({
    queryKey: ['fechamentos', professorId],
    queryFn: async () => {
      let q = supabase
        .from('fechamentos')
        .select('*, professores(nome, banco, agencia, conta, tipo_conta, pix, valor_hora_aula)')
        .order('criado_em', { ascending: false })

      if (professorId) q = q.eq('professor_id', professorId)

      const { data, error } = await q
      if (error) throw error
      return data
    }
  })
}

export function useCalcularFechamento() {
  return useMutation({
    mutationFn: async ({ professorId, periodoInicio, periodoFim }) => {
      const { data: aulas, error } = await supabase
        .from('aulas')
        .select('id, data_aula, turmas(horario_inicio, horario_fim)')
        .eq('professor_executou_id', professorId)
        .eq('status', 'match')
        .gte('data_aula', periodoInicio)
        .lte('data_aula', periodoFim)

      if (error) throw error

      const { data: prof } = await supabase
        .from('professores')
        .select('valor_hora_aula')
        .eq('id', professorId)
        .single()

      const totalAulas = aulas?.length || 0
      const valorHora = prof?.valor_hora_aula || 0
      const totalBruto = totalAulas * valorHora

      return { totalAulas, valorHora, totalBruto, aulas }
    }
  })
}

export function useCriarFechamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados) => {
      const { data, error } = await supabase
        .from('fechamentos')
        .insert(dados)
        .select()
        .single()
      if (error) throw error
      await logAudit('fechamentos', data.id, 'INSERT', null, data)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fechamentos'] })
  })
}

export function useAtualizarFechamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { data, error } = await supabase
        .from('fechamentos')
        .update({ status })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fechamentos'] })
  })
}
