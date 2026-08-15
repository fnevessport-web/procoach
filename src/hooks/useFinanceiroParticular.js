import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Diferente do Financeiro do clube (FinanceiroPage.jsx), aqui não existe boleto/NF/liberação
// nem multi-empresa dentro da mesma tela — só "pago"/"pendente" por aluno ou contratante
// terceiro, então em vez de pré-gerar uma linha "pendente" pro mês inteiro (padrão do clube),
// a UI computa o pendente por omissão (sem registro em pagamentos_* = pendente) e só grava no
// banco quando o usuário efetivamente marca como pago — menos escrita, sem risco de duplicar.
// Resiliente à migration 027 ainda não ter rodado: erro de tabela inexistente cai pra lista
// vazia (tudo aparece como pendente-não-gravado) em vez de quebrar a tela.
export function usePagamentosAlunos({ empresaId, mes, ano }) {
  return useQuery({
    queryKey: ['pagamentos_alunos_particular', empresaId, mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos_alunos').select('*')
        .eq('empresa_id', empresaId).eq('mes', mes).eq('ano', ano)
      if (error) return []
      return data || []
    },
    enabled: !!empresaId && !!mes && !!ano,
  })
}

export function usePagamentosContratantes({ empresaId, mes, ano }) {
  return useQuery({
    queryKey: ['pagamentos_contratantes_particular', empresaId, mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos_contratantes').select('*')
        .eq('empresa_id', empresaId).eq('mes', mes).eq('ano', ano)
      if (error) return []
      return data || []
    },
    enabled: !!empresaId && !!mes && !!ano,
  })
}

// tipo: 'aluno' | 'contratante'. Upsert pela constraint unique(aluno_id,mes,ano) /
// unique(contratante_id,mes,ano) — cria se não existir, atualiza se já existir, sem precisar
// carregar o id do registro antes.
export function useSalvarPagamentoParticular(tipo) {
  const table = tipo === 'aluno' ? 'pagamentos_alunos' : 'pagamentos_contratantes'
  const onConflict = tipo === 'aluno' ? 'aluno_id,mes,ano' : 'contratante_id,mes,ano'
  const queryKey = tipo === 'aluno' ? 'pagamentos_alunos_particular' : 'pagamentos_contratantes_particular'
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.from(table).upsert(payload, { onConflict }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  })
}
