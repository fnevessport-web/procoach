import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

export const QUADRAS_EMPRESA = {
  procopio: ['Quadra 1', 'Quadra 2', 'Quadra 3', 'Quadra 4', 'Quadra de Padel'],
  beach_arena: ['Quadra 1 Areia', 'Quadra 3 Areia', 'Quadra 5 Areia'],
}

function parseQuadraObs(obs) {
  if (!obs) return ''
  const partes = obs.split('·').map(s => s.trim())
  return partes[1] || ''
}

// ──────────────────────────────────────────────────────────────────────
// Hooks legados (mantidos para compatibilidade)
// ──────────────────────────────────────────────────────────────────────

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
        .select('valor_hora_aula, valor_aula')
        .eq('id', professorId)
        .single()
      const totalAulas = aulas?.length || 0
      const valorHora = prof?.valor_hora_aula || prof?.valor_aula || 0
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
        .from('fechamentos').insert(dados).select().single()
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
        .from('fechamentos').update({ status }).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fechamentos'] })
  })
}

// ──────────────────────────────────────────────────────────────────────
// Novos hooks — Financeiro por empresa
// ──────────────────────────────────────────────────────────────────────

// Custo total de professores agrupado por professor, filtrado por empresa+período
export function useCustoProfessores({ empresa, dataInicio, dataFim }) {
  return useQuery({
    queryKey: ['fin_custos_prof', empresa, dataInicio, dataFim],
    queryFn: async () => {
      if (!empresa || !dataInicio || !dataFim) return []
      const { data: aulas, error } = await supabase
        .from('aulas')
        .select(`
          id, professor_executou_id, turma_id, observacoes,
          turmas(nome, quadras(nome)),
          professores!professor_executou_id(id, nome, foto_url, valor_aula, valor_hora_aula, chave_pix, banco, tipo_pagamento, nome_titular, cpf_titular)
        `)
        .gte('data_aula', dataInicio)
        .lte('data_aula', dataFim)
        .eq('paga_professor', true)
        .eq('status_aula', 'dada')
      if (error) throw error

      const quadras = QUADRAS_EMPRESA[empresa] || []
      const filtradas = (aulas || []).filter(a => {
        const q = a.turma_id ? (a.turmas?.quadras?.nome || '') : parseQuadraObs(a.observacoes)
        return quadras.includes(q)
      })

      const por = {}
      filtradas.forEach(a => {
        const p = a.professores
        if (!p) return
        if (!por[p.id]) {
          const valorUnitario = Number(p.valor_aula || p.valor_hora_aula || 0)
          por[p.id] = { ...p, valorUnitario, totalAulas: 0, totalValor: 0 }
        }
        por[p.id].totalAulas++
        por[p.id].totalValor += por[p.id].valorUnitario
      })

      return Object.values(por).sort((a, b) => b.totalValor - a.totalValor)
    },
    enabled: !!empresa && !!dataInicio && !!dataFim,
    staleTime: 60000,
  })
}

// Aulas de um professor específico no período, filtradas por empresa
export function useAulasProfessorFinanceiro({ professorId, empresa, dataInicio, dataFim }) {
  return useQuery({
    queryKey: ['fin_aulas_prof', professorId, empresa, dataInicio, dataFim],
    queryFn: async () => {
      if (!professorId) return []
      const { data: aulas, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, turma_id, observacoes, status_aula,
          turmas(nome, horario_inicio, quadras(nome))
        `)
        .eq('professor_executou_id', professorId)
        .gte('data_aula', dataInicio)
        .lte('data_aula', dataFim)
        .eq('paga_professor', true)
        .eq('status_aula', 'dada')
        .order('data_aula', { ascending: true })
      if (error) throw error

      const quadras = QUADRAS_EMPRESA[empresa] || []
      return (aulas || []).filter(a => {
        const q = a.turma_id ? (a.turmas?.quadras?.nome || '') : parseQuadraObs(a.observacoes)
        return !empresa || quadras.includes(q)
      })
    },
    enabled: !!professorId && !!dataInicio && !!dataFim,
    staleTime: 60000,
  })
}

// Boleto do professor para um mês/ano específico
export function useBoletosProfessor(professorId) {
  return useQuery({
    queryKey: ['boletos', professorId],
    queryFn: async () => {
      if (!professorId) return []
      const { data, error } = await supabase
        .from('boletos_professor')
        .select('*')
        .eq('professor_id', professorId)
        .order('ano', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!professorId,
  })
}

// IDs de professores com pagamento confirmado no mês/ano
export function usePagamentosConfirmados({ mes, ano }) {
  return useQuery({
    queryKey: ['pagamentos_confirmados', mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boletos_professor')
        .select('professor_id')
        .eq('mes', mes)
        .eq('ano', ano)
        .eq('status', 'pago')
      if (error) throw error
      return new Set((data || []).map(b => b.professor_id))
    },
    enabled: !!mes && !!ano,
    staleTime: 30000,
  })
}

export function useConfirmarPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ professorId, mes, ano }) => {
      const { error } = await supabase
        .from('boletos_professor')
        .upsert({ professor_id: professorId, mes, ano, status: 'pago' }, { onConflict: 'professor_id,mes,ano' })
      if (error) throw error
    },
    onSuccess: (_, { mes, ano, professorId }) => {
      qc.invalidateQueries({ queryKey: ['boletos', professorId] })
      qc.invalidateQueries({ queryKey: ['pagamentos_confirmados', mes, ano] })
    },
  })
}

export function useDesfazerPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ professorId, mes, ano }) => {
      const { error } = await supabase
        .from('boletos_professor')
        .update({ status: 'pendente' })
        .eq('professor_id', professorId)
        .eq('mes', mes)
        .eq('ano', ano)
      if (error) throw error
    },
    onSuccess: (_, { mes, ano, professorId }) => {
      qc.invalidateQueries({ queryKey: ['boletos', professorId] })
      qc.invalidateQueries({ queryKey: ['pagamentos_confirmados', mes, ano] })
    },
  })
}

// ──────────────────────────────────────────────────────────────────────
// Lancamentos financeiros (receita + outros custos)
// Requer tabela: financeiro_lancamentos
//
// SQL para criar no Supabase:
// CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   empresa text NOT NULL,
//   tipo text NOT NULL,   -- 'receita' | 'custo_extra'
//   descricao text,
//   valor numeric(10,2) NOT NULL DEFAULT 0,
//   mes int NOT NULL,
//   ano int NOT NULL,
//   arquivo_url text,
//   arquivo_nome text,
//   criado_em timestamptz DEFAULT now()
// );
// ALTER TABLE financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "admin_all" ON financeiro_lancamentos FOR ALL TO authenticated USING (true);
// ──────────────────────────────────────────────────────────────────────

export function useLancamentosFinanceiro({ empresa, mes, ano }) {
  return useQuery({
    queryKey: ['fin_lancamentos', empresa, mes, ano],
    queryFn: async () => {
      if (!empresa) return []
      const { data, error } = await supabase
        .from('financeiro_lancamentos')
        .select('*')
        .eq('empresa', empresa)
        .eq('mes', mes)
        .eq('ano', ano)
        .order('criado_em', { ascending: true })
      if (error) {
        console.warn('financeiro_lancamentos não existe ainda:', error.message)
        return []
      }
      return data || []
    },
    enabled: !!empresa && !!mes && !!ano,
    staleTime: 30000,
  })
}

export function useSalvarLancamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lancamento) => {
      if (lancamento.id) {
        const { data, error } = await supabase
          .from('financeiro_lancamentos')
          .update(lancamento)
          .eq('id', lancamento.id)
          .select().single()
        if (error) throw error
        return data
      }
      const { data, error } = await supabase
        .from('financeiro_lancamentos')
        .insert(lancamento)
        .select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fin_lancamentos'] }),
  })
}

export function useRemoverLancamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('financeiro_lancamentos')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fin_lancamentos'] }),
  })
}
