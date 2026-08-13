import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Grade de horários do clube (Cadastro > Horários) — substitui os arrays de horário fixos que
// existiam hardcoded no JS. Cada linha tem os dias da semana em que aparece na grade (ex: um
// horário só de fim de semana), pra dar controle de verdade sem precisar mexer em código.
export function useHorariosGrade() {
  return useQuery({
    queryKey: ['horarios_grade'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('horarios_grade')
        .select('*')
        .eq('ativo', true)
        .order('horario')
      if (error) throw error
      return data
    },
    staleTime: 1000 * 60 * 10,
  })
}

export function useHorariosGradeActions() {
  const qc = useQueryClient()

  async function salvar({ id, ...dados }) {
    const payload = {
      horario: dados.horario,
      dias_semana: dados.dias_semana,
    }
    if (id) {
      const { error } = await supabase.from('horarios_grade').update(payload).eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('horarios_grade').insert(payload)
      if (error) throw error
    }
    await qc.invalidateQueries({ queryKey: ['horarios_grade'] })
  }

  async function excluir(id) {
    const { error } = await supabase.from('horarios_grade').update({ ativo: false }).eq('id', id)
    if (error) throw error
    await qc.invalidateQueries({ queryKey: ['horarios_grade'] })
  }

  return { salvar, excluir }
}
