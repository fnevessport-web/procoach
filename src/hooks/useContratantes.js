import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// "Contratante" = quem paga a aula, no modo Particular — 'aluno' cobra do aluno cadastrado
// (ex: "Particular"); 'terceiro' cobra direto dessa entidade (ex: um clube/empresa que
// contrata o profissional por aula/mês), sem nenhum aluno envolvido na cobrança.
export function useContratantes(empresaId) {
  return useQuery({
    queryKey: ['contratantes', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratantes')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return data
    },
    enabled: !!empresaId,
  })
}

export function useCriarContratante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ empresaId, nome, tipo, tipoCobranca, valorHoraAula, valorFixo }) => {
      const { data, error } = await supabase
        .from('contratantes')
        .insert({
          empresa_id: empresaId, nome, tipo,
          tipo_cobranca: tipoCobranca || null,
          valor_hora_aula: valorHoraAula || null,
          valor_fixo: valorFixo || null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contratantes'] }),
  })
}

export function useEditarContratante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...dados }) => {
      const { data, error } = await supabase.from('contratantes').update(dados).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contratantes'] }),
  })
}

export function useExcluirContratante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('contratantes').update({ ativo: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contratantes'] }),
  })
}
