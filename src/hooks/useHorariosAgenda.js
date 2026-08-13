import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Grade de horários configurável por tenant Particular — substitui o array fixo de horas
// (06:00-21:00) que a grade do clube usa hardcoded no JS. Cada profissional tem a própria
// lista, criada com 06:00-22:00 de hora em hora na hora que a conta dele é aberta, e pode
// adicionar horário fora dessa faixa ou "excluir" um que nunca vai usar (soft delete via
// ativo=false — mesmo padrão de professores.ativo/alunos.ativo já usado no projeto).
export function useHorariosAgenda(empresaId) {
  return useQuery({
    queryKey: ['horarios_agenda', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('horarios_agenda')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('horario')
      if (error) throw error
      return data
    },
    enabled: !!empresaId,
  })
}

export function useCriarHorarioAgenda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ empresaId, horario }) => {
      // upsert: se o horário já existia desativado (foi "excluído" antes), reativa em vez de
      // duplicar — a constraint unique(empresa_id, horario) bloquearia um insert simples.
      const { data, error } = await supabase
        .from('horarios_agenda')
        .upsert({ empresa_id: empresaId, horario, ativo: true }, { onConflict: 'empresa_id,horario' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['horarios_agenda'] }),
  })
}

export function useExcluirHorarioAgenda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('horarios_agenda').update({ ativo: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['horarios_agenda'] }),
  })
}
