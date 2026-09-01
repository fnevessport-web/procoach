import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Lê a pesquisa de satisfação de um professor (link + status + respostas). RLS da
// tabela pesquisas_satisfacao só libera pra role 'admin' (ver 028_pesquisa_satisfacao.sql)
// — qualquer outro role recebe lista vazia, nunca erro, então nem precisa checar role aqui
// antes de chamar (a segurança de verdade é no banco; a checagem de role no componente é
// só pra nem mostrar a aba).
export function usePesquisaSatisfacao(professorId, opcoes = {}) {
  return useQuery({
    queryKey: ['pesquisa_satisfacao', professorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pesquisas_satisfacao')
        .select('*')
        .eq('professor_id', professorId)
        .maybeSingle()
      if (error) throw error
      // Professor cadastrado antes da migration rodar, ou depois dela sem backfill —
      // cria a linha (com token) na hora que o gestor abrir a aba pela primeira vez.
      if (!data) {
        const { data: criada, error: e2 } = await supabase
          .from('pesquisas_satisfacao')
          .insert({ professor_id: professorId })
          .select()
          .single()
        if (e2) throw e2
        return criada
      }
      return data
    },
    enabled: !!professorId && (opcoes.enabled ?? true),
  })
}

export function useReabrirPesquisa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (professorId) => {
      const { error } = await supabase
        .from('pesquisas_satisfacao')
        .update({ respostas: null, respondido_em: null })
        .eq('professor_id', professorId)
      if (error) throw error
    },
    onSuccess: (_, professorId) => qc.invalidateQueries({ queryKey: ['pesquisa_satisfacao', professorId] }),
  })
}
