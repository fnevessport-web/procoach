import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Professor substituto do modo Particular — reaproveita a tabela `professores` já existente
// do clube (mesmo padrão de alunos/turmas: nullable, escopado por empresa_id, clube 100%
// intocado porque nunca filtra por empresa_id) em vez de criar uma tabela nova só pra isso.
export function useColaboradores(empresaId) {
  return useQuery({
    queryKey: ['colaboradores_particular', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores')
        .select('id, nome, telefone, valor_aula_combinado, ativo')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return data
    },
    enabled: !!empresaId,
  })
}

export function useCriarColaborador() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ empresaId, nome, telefone, valorAulaCombinado }) => {
      const { data, error } = await supabase
        .from('professores')
        .insert({ empresa_id: empresaId, nome, telefone: telefone || null, valor_aula_combinado: valorAulaCombinado || null, ativo: true })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colaboradores_particular'] }),
  })
}

export function useExcluirColaborador() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('professores').update({ ativo: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colaboradores_particular'] }),
  })
}
