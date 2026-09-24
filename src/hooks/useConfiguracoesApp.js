import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const CHAVE = 'mostrar_valores_professor'

// Controla se o PRÓPRIO professor vê valor de hora-aula/aula-dia na tela dele (Financeiro do
// Professor, Dashboard do Professor) — não afeta a tela Financeiro do gestor, que sempre
// mostra tudo (é lá que fica o botão pra ligar/desligar). Default true (visível) se a
// configuração ainda não existir — só fica oculto depois que o gestor desliga de propósito.
export function useMostrarValoresProfessor() {
  return useQuery({
    queryKey: ['config_mostrar_valores_professor'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracoes_app').select('valor').eq('chave', CHAVE).maybeSingle()
      if (error) throw error
      return data ? data.valor !== false : true
    },
    staleTime: 30000,
    refetchInterval: 60000, // professor com a tela aberta vê o gestor ligar/desligar sem precisar recarregar
  })
}

export function useAlternarMostrarValoresProfessor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (mostrar) => {
      const { error } = await supabase.from('configuracoes_app')
        .upsert({ chave: CHAVE, valor: mostrar, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config_mostrar_valores_professor'] }),
  })
}
