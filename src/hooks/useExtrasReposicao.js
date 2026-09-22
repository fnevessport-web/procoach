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
        .select('*, extras_agendamentos(id, tipo, status, modalidade, slot_id, extras_slots(data_aula, horario_inicio, horario_fim, quadra, professor, formato, nivel, publico))')
        .order('criado_em', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
}

// Nomes de todos os alunos ativos do clube (qualquer modalidade/empresa), só pra cruzar
// contra o nome que a pessoa digitou no link público e destacar quem não bate com ninguém do
// cadastro — não altera nada, é comparação client-side em cima de dado que já existe. Query
// separada da usada em Cadastros (useAlunos) pra não competir com aquele cache.
export function useNomesAlunosAtivos() {
  return useQuery({
    queryKey: ['extras-nomes-alunos-ativos'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('alunos').select('nome').eq('ativo', true)
      if (error) throw error
      return (data || []).map(a => a.nome).filter(Boolean)
    },
  })
}

// Foto dos professores pra tela interna (autenticado, então lê direto da tabela — não precisa
// da view restrita que o link público usa, ver reposicao/api.js useProfessoresPublicoFoto).
export function useProfessoresFotoExtra() {
  return useQuery({
    queryKey: ['extras-professores-foto'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('professores').select('id, nome, foto_url').eq('ativo', true)
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

// Inclusão manual pela equipe (ex.: corrigir duplicidade, encaixar quem não conseguiu pelo
// link) — sem passar pelas regras do link público (limite de 2, individual/grupo, conflito de
// horário): é uma exceção deliberada da equipe, não precisa repetir a validação do aluno.
// Se `inscricaoId` já vem preenchido, só cria o agendamento (reaproveita a inscrição existente,
// pra não gerar outro cadastro duplicado da mesma pessoa); senão cria a inscrição primeiro.
export const useIncluirAlunoExtra = () => useMutacao(async ({ slotId, tipo, modalidade, inscricaoId, nome, telefone }) => {
  let idFinal = inscricaoId
  let chave

  if (idFinal) {
    const { data, error } = await supabase.from('extras_inscricoes').select('chave').eq('id', idFinal).single()
    if (error) throw error
    chave = data.chave
  } else {
    const nomeLimpo = (nome || '').trim().replace(/\s+/g, ' ')
    if (!nomeLimpo) throw new Error('Informe o nome do aluno.')
    const tel = (telefone || '').replace(/\D/g, '')
    const norm = nomeLimpo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
    chave = `${norm}|${tel ? tel.slice(-8) : '00000000'}`
    const { data, error } = await supabase.from('extras_inscricoes').insert({
      nome: nomeLimpo, telefone: tel, chave, turma_atual: [], declaracao_em: new Date().toISOString(), conferencia: 'confirmado',
    }).select('id').single()
    if (error) throw error
    idFinal = data.id
  }

  const { error: errAg } = await supabase.from('extras_agendamentos')
    .insert({ inscricao_id: idFinal, slot_id: slotId, chave, tipo, modalidade, status: 'confirmado' })
  if (errAg) throw errAg
})

// Apaga a inscrição inteira (ex.: duplicidade — alguém se inscreveu 2x). Cascata apaga junto
// os agendamentos dela (extras_agendamentos.inscricao_id tem ON DELETE CASCADE), liberando as
// vagas na hora. Irreversível — a tela sempre confirma antes de chamar isso.
export const useExcluirInscricaoExtra = () => useMutacao(async ({ inscricaoId }) => {
  const { error } = await supabase.from('extras_inscricoes').delete().eq('id', inscricaoId)
  if (error) throw error
})
