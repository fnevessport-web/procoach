import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Aulas extras da chuva (reposição de Tênis + presente), separadas da agenda oficial — ver
// scripts/2026-09-20_reposicao_extra_publica.sql. Tabelas extras_slots / extras_inscricoes /
// extras_agendamentos; a página pública /reposicao escreve por funções, esta tela (logada) lê e
// ajusta direto (RLS: authenticated pode tudo, como no resto do schema).

const CHAVE_AGENDA = ['extras-agenda']
const CHAVE_INSCRITOS = ['extras-inscritos']

// Agenda: cada horário com quem está agendado nele.
export function useExtrasAgenda() {
  return useQuery({
    queryKey: CHAVE_AGENDA,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('extras_slots')
        .select('*, extras_agendamentos(id, status, tipo, inscricao_id, criado_em, extras_inscricoes(id, nome, telefone, turma_atual, conferencia, observacao))')
        .order('data_aula').order('horario_inicio').order('quadra')
      if (error) throw error
      return data || []
    },
  })
}

// Inscritos: cada pessoa com tudo que agendou (pra conferir se é aluno ativo).
export function useExtrasInscritos() {
  return useQuery({
    queryKey: CHAVE_INSCRITOS,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('extras_inscricoes')
        .select('*, extras_agendamentos(id, tipo, status, modalidade, extras_slots(data_aula, horario_inicio, horario_fim, quadra, professor, formato, nivel, publico))')
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
}

function useMutacao(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE_AGENDA })
      qc.invalidateQueries({ queryKey: CHAVE_INSCRITOS })
    },
  })
}

export const useAtualizarProfessorExtra = () => useMutacao(async ({ slotId, professor }) => {
  const { error } = await supabase.from('extras_slots').update({ professor: professor.trim() || null }).eq('id', slotId)
  if (error) throw error
})

// Cancelar libera a vaga na hora (a contagem só considera status = confirmado).
export const useCancelarAgendamentoExtra = () => useMutacao(async ({ agendamentoId }) => {
  const { error } = await supabase.from('extras_agendamentos').update({ status: 'cancelado' }).eq('id', agendamentoId)
  if (error) throw error
})

export const useAtualizarConferenciaExtra = () => useMutacao(async ({ inscricaoId, conferencia, observacao }) => {
  const patch = {}
  if (conferencia !== undefined) patch.conferencia = conferencia
  if (observacao !== undefined) patch.observacao = observacao?.trim() || null
  const { error } = await supabase.from('extras_inscricoes').update(patch).eq('id', inscricaoId)
  if (error) throw error
})
