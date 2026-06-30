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
          turmas(nome, horario_inicio, horario_fim, horario_dia_semana, quadras(nome), modalidades(nome, icone_emoji, cor_hex)),
          professores!professor_executou_id(id, nome),
          prof_titular:professores!professor_titular_id(id, nome),
          presencas(id, aluno_id, presente, status_presenca, tipo_participacao, alerta_nivel, nivel_avaliado_prof, obs_nivel_prof, alunos(id, nome, alerta_nivel, nivel_avaliado_prof, obs_nivel_prof))
        `)
        .order('data_aula', { ascending: false })

      if (data) q = q.eq('data_aula', data)
      if (professorId) q = q.eq('professor_executou_id', professorId)
      if (status) q = q.eq('status', status)

      const { data: aulas, error } = await q
      if (error) throw error

      if (modalidadeId) {
        return aulas.filter(a =>
          !a.turma_id || // inclui aulas avulsas sempre
          a.turmas?.modalidades?.id === modalidadeId ||
          (typeof modalidadeId === 'string' && a.turmas?.modalidades?.nome)
        )
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

export function useRelatorioReposicoes() {
  return useQuery({
    queryKey: ['relatorio_repos'],
    queryFn: async () => {
      const hoje = new Date()
      const dataFim = format(hoje, 'yyyy-MM-dd')
      const umAnoAtras = new Date(hoje)
      umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1)
      const dataInicio = format(umAnoAtras, 'yyyy-MM-dd')

      const { data: faltas, error } = await supabase
        .from('presencas')
        .select(`
          id, aluno_id, aula_id,
          alunos(id, nome, nivel_avaliado_prof, modalidades_ids),
          aulas!inner(id, data_aula, turma_id,
            turmas(id, nome, modalidades(id, nome, icone_emoji, cor_hex))
          )
        `)
        .eq('status_presenca', 'falta_justificada')
        .gte('aulas.data_aula', dataInicio)
        .lte('aulas.data_aula', dataFim)
      if (error) throw error
      if (!faltas?.length) return []

      // Busca modalidades dos alunos para aulas avulsas (sem turma)
      const modalidadeIds = new Set()
      faltas.forEach(f => {
        if (!f.aulas?.turma_id) f.alunos?.modalidades_ids?.forEach(id => modalidadeIds.add(id))
      })
      let modalidadesMap = {}
      if (modalidadeIds.size > 0) {
        const { data: mods } = await supabase
          .from('modalidades')
          .select('id, nome, cor_hex, icone_emoji')
          .in('id', [...modalidadeIds])
        mods?.forEach(m => { modalidadesMap[m.id] = m })
      }

      const aulaIdsUnicos = [...new Set(faltas.map(f => f.aula_id))]
      const { data: repos } = await supabase
        .from('reposicoes')
        .select('id, aluno_id, aula_origem_id, status')
        .in('aula_origem_id', aulaIdsUnicos)

      const reposMap = {}
      repos?.forEach(r => {
        if (!reposMap[r.aluno_id]) reposMap[r.aluno_id] = {}
        reposMap[r.aluno_id][r.aula_origem_id] = r
      })

      const porAluno = {}
      faltas.forEach(f => {
        const aluno = f.alunos
        if (!aluno) return
        const aula = f.aulas
        const modalidadeTurma = aula?.turmas?.modalidades || null
        const modalidadeAluno = !modalidadeTurma && aluno.modalidades_ids?.length
          ? modalidadesMap[aluno.modalidades_ids[0]] || null
          : null
        const modalidade = modalidadeTurma || modalidadeAluno

        if (!porAluno[aluno.id]) {
          porAluno[aluno.id] = { id: aluno.id, nome: aluno.nome, nivel: aluno.nivel_avaliado_prof, modalidade, faltas: [] }
        }
        if (!porAluno[aluno.id].modalidade && modalidade) {
          porAluno[aluno.id].modalidade = modalidade
        }
        porAluno[aluno.id].faltas.push({
          presencaId: f.id,
          aulaId: f.aula_id,
          dataAula: aula?.data_aula,
          turmaNome: aula?.turmas?.nome || null,
          reposicao: reposMap[aluno.id]?.[f.aula_id] || null,
        })
      })

      return Object.values(porAluno).map(a => {
        const pendentes = a.faltas.filter(f => !f.reposicao || f.reposicao.status === 'pendente')
        const agendadas = a.faltas.filter(f => f.reposicao?.status === 'agendado')
        return { ...a, pendentes, agendadas }
      }).sort((a, b) => b.pendentes.length - a.pendentes.length)
    },
    staleTime: 60000,
  })
}

export function useAulasDiaParaReposicao(data) {
  return useQuery({
    queryKey: ['aulas_dia_repos', data],
    queryFn: async () => {
      if (!data) return []
      const { data: aulas, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, turma_id,
          turmas(id, nome, horario_inicio, horario_fim, quadras(id, nome), niveis(nome)),
          presencas(id, aluno_id)
        `)
        .eq('data_aula', data)
        .not('turma_id', 'is', null)
        .neq('status_aula', 'cancelada')
      if (error) throw error
      return (aulas || []).sort((a, b) =>
        (a.turmas?.horario_inicio || '').localeCompare(b.turmas?.horario_inicio || '')
      )
    },
    enabled: !!data,
    staleTime: 30000,
  })
}

export function useAulasDisponiveisReposicao() {
  const hoje = format(new Date(), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['aulas_disp_repos', hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, turma_id,
          turmas(id, nome, horario_inicio, horario_fim, quadras(nome)),
          presencas(id, aluno_id)
        `)
        .gte('data_aula', hoje)
        .not('turma_id', 'is', null)
        .neq('status_aula', 'cancelada')
        .order('data_aula', { ascending: true })
        .limit(200)
      if (error) throw error
      return (data || []).filter(a => (a.presencas?.length || 0) < 4)
    },
    staleTime: 60000,
  })
}

export function useAgendarReposicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ reposicaoId, aulaOrigemId, aulaId, alunoId }) => {
      const { error: errPres } = await supabase
        .from('presencas')
        .upsert({
          aula_id: aulaId,
          aluno_id: alunoId,
          presente: false,
          status_presenca: 'presente',
          tipo_participacao: 'reposicao',
        }, { onConflict: 'aula_id,aluno_id' })
      if (errPres) throw errPres

      if (reposicaoId) {
        const { error } = await supabase
          .from('reposicoes').update({ status: 'agendado' }).eq('id', reposicaoId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('reposicoes')
          .upsert({ aluno_id: alunoId, aula_origem_id: aulaOrigemId, status: 'agendado' }, { onConflict: 'aluno_id,aula_origem_id' })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['relatorio_repos'] })
      qc.invalidateQueries({ queryKey: ['aulas'] })
      qc.invalidateQueries({ queryKey: ['aulas_disp_repos'] })
    }
  })
}

export function useGerarAulas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ turmaId, dataInicio, dataFim, professorOverrideId }) => {
      const { data: turma } = await supabase
        .from('turmas')
        .select(`*, professores!professor_titular_id(id), turmas_alunos(aluno_id, ativo)`)
        .eq('id', turmaId)
        .single()

      if (!turma) throw new Error('Turma não encontrada')

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
            professor_executou_id: professorOverrideId || turma.professores?.id || turma.professor_titular_id,
            data_aula: format(new Date(d), 'yyyy-MM-dd'),
            status: 'pendente',
            status_aula: 'dada',
            paga_professor: true,
            eh_substituicao: false
          })
        }
      }

      if (aulasParaInserir.length === 0) return 0

      const { data: aulasCriadas, error } = await supabase
        .from('aulas')
        .insert(aulasParaInserir)
        .select('id')
      if (error) throw error

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