import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { format } from 'date-fns'

export function useAulas({ data, professorId, modalidadeId, status } = {}) {
  return useQuery({
    queryKey: ['aulas', data, professorId, modalidadeId, status],
    queryFn: async () => {
      let q = supabase
        .from('aulas')
        .select(`
          *,
          turmas(nome, horario_inicio, horario_fim, horario_dia_semana, modalidades(nome, icone_emoji, cor_hex)),
          professores!professor_executou_id(id, nome),
          prof_titular:professores!professor_titular_id(id, nome),
          presencas(id, aluno_id, presente, status_presenca, tipo_participacao, alunos(id, nome))
        `)
        .order('data_aula', { ascending: false })

      if (data) q = q.eq('data_aula', data)
      if (professorId) q = q.eq('professor_executou_id', professorId)
      if (status) q = q.eq('status', status)

      const { data: aulas, error } = await q
      if (error) throw error

      if (modalidadeId) {
        return aulas.filter(a => a.turmas?.modalidades?.id === modalidadeId ||
          (typeof modalidadeId === 'string' && a.turmas?.modalidades?.nome))
      }

      return aulas
    },
    staleTime: 30000
  })
}

export function useAulasPendentes() {
  return useQuery({
    queryKey: ['aulas', 'pendentes'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('aulas')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pendente', 'divergencia'])
      if (error) throw error
      return count || 0
    },
    refetchInterval: 60000
  })
}

export function useConfirmarAulaProfessor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ aulaId, presencas, ehSubstituicao, professorTitularId, observacoes }) => {
      const { data: anterior } = await supabase.from('aulas').select('*').eq('id', aulaId).single()
      const novoStatus = anterior.status === 'confirmada_coord' ? 'match' : 'confirmada_professor'

      const { data, error } = await supabase
        .from('aulas')
        .update({
          status: novoStatus,
          eh_substituicao: ehSubstituicao,
          professor_titular_id: professorTitularId,
          observacoes,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', aulaId)
        .select()
        .single()

      if (error) throw error

      if (presencas?.length > 0) {
        const rows = presencas.map(p => ({
          aula_id: aulaId,
          aluno_id: p.aluno_id,
          presente: p.presente
        }))
        await supabase.from('presencas').upsert(rows, { onConflict: 'aula_id,aluno_id' })
      }

      await logAudit('aulas', aulaId, 'UPDATE', anterior, data)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aulas'] })
  })
}

export function useConfirmarAulaCoordenador() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ aulaId, confirmada, observacoes }) => {
      const { data: anterior } = await supabase.from('aulas').select('*').eq('id', aulaId).single()

      let novoStatus
      if (!confirmada) {
        novoStatus = 'divergencia'
      } else if (anterior.status === 'confirmada_professor') {
        novoStatus = 'match'
      } else {
        novoStatus = 'confirmada_coord'
      }

      const { data, error } = await supabase
        .from('aulas')
        .update({
          status: novoStatus,
          observacoes: observacoes || anterior.observacoes,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', aulaId)
        .select()
        .single()

      if (error) throw error
      await logAudit('aulas', aulaId, 'UPDATE', anterior, data)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aulas'] })
  })
}

export function useMarcarNaoDada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ aulaId, motivo }) => {
      const { data, error } = await supabase
        .from('aulas')
        .update({ status: 'nao_dada', motivo_nao_dada: motivo, atualizado_em: new Date().toISOString() })
        .eq('id', aulaId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aulas'] })
  })
}

export function useAtualizarStatusAula() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ aulaId, statusAula, pagaProfessor }) => {
      const { data, error } = await supabase
        .from('aulas')
        .update({
          status_aula: statusAula,
          paga_professor: pagaProfessor,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', aulaId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aulas'] })
  })
}

export function useSalvarPresencas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ aulaId, presencas }) => {
      const rows = presencas.map(p => ({
        aula_id: aulaId,
        aluno_id: p.aluno_id,
        presente: p.status_presenca === 'presente',
        status_presenca: p.status_presenca,
        tipo_participacao: p.tipo_participacao || 'mensalista',
      }))
      const { error } = await supabase
        .from('presencas')
        .upsert(rows, { onConflict: 'aula_id,aluno_id' })
      if (error) throw error

      const faltasJustificadas = presencas.filter(p => p.status_presenca === 'falta_justificada')
      if (faltasJustificadas.length > 0) {
        const repos = faltasJustificadas.map(p => ({
          aluno_id: p.aluno_id,
          aula_origem_id: aulaId,
          status: 'pendente'
        }))
        await supabase.from('reposicoes').upsert(repos, { onConflict: 'aluno_id,aula_origem_id' })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aulas'] })
  })
}

export function useGerarAulas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ turmaId, dataInicio, dataFim }) => {
      // 1. Busca turma com professor e alunos ativos
      const { data: turma } = await supabase
        .from('turmas')
        .select(`
          *,
          professores!professor_titular_id(id),
          turmas_alunos(aluno_id, ativo)
        `)
        .eq('id', turmaId)
        .single()

      if (!turma) throw new Error('Turma não encontrada')

      // Alunos fixos da turma (mensalistas)
      const alunosFixos = turma.turmas_alunos
        ?.filter(ta => ta.ativo)
        .map(ta => ta.aluno_id) || []

      const diasSemana = {
        'domingo': 0, 'segunda': 1, 'terca': 2,
        'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6
      }
      const diaSemanaNum = diasSemana[turma.horario_dia_semana?.toLowerCase()] ?? 1

      const aulasParaInserir = []
      const inicio = new Date(dataInicio)
      const fim = new Date(dataFim)

      for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === diaSemanaNum) {
          aulasParaInserir.push({
            turma_id: turmaId,
            professor_executou_id: turma.professores?.id || turma.professor_titular_id,
            data_aula: format(new Date(d), 'yyyy-MM-dd'),
            status: 'pendente',
            status_aula: 'dada',
            paga_professor: true,
            eh_substituicao: false
          })
        }
      }

      if (aulasParaInserir.length === 0) return 0

      // 2. Insere as aulas
      const { data: aulasCriadas, error } = await supabase
        .from('aulas')
        .insert(aulasParaInserir)
        .select('id')
      if (error) throw error

      // 3. Para cada aula criada, insere presenças dos alunos fixos
      if (alunosFixos.length > 0 && aulasCriadas?.length > 0) {
        const presencasParaInserir = []
        for (const aula of aulasCriadas) {
          for (const alunoId of alunosFixos) {
            presencasParaInserir.push({
              aula_id: aula.id,
              aluno_id: alunoId,
              presente: false,
              status_presenca: 'presente',
              tipo_participacao: 'mensalista',
            })
          }
        }
        await supabase.from('presencas').insert(presencasParaInserir)
      }

      return aulasCriadas.length
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aulas'] })
  })
}