import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, addDays } from 'date-fns'

function ehPresente(p) {
  return p.status_presenca === 'presente' || p.presente
}

// Alunos que já estão numa sequência de 2+ faltas seguidas (sem contar falta justificada,
// mesma regra de useModalidadeDashboard.js/useRelatorioMensal.js — ela nem quebra nem
// alimenta o streak) E têm aula agendada hoje ou amanhã. É um aviso mais cedo que o "risco
// alto de evasão" oficial (3+, mostrado no card Saúde do Mês/KPIs): a ideia é que o professor
// já veja isso na aula de hoje/amanhã, quando ainda dá tempo de conversar com o aluno antes
// dele virar estatística de evasão.
export function useAlertaFaltasConsecutivas() {
  const hoje = format(new Date(), 'yyyy-MM-dd')
  const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['alerta_faltas_consecutivas', hoje],
    queryFn: async () => {
      // 1. Quem tem aula de turma hoje/amanhã — presencas já vem pré-populada pros mensalistas
      // desde a geração da aula (ver useGerarAulas), então já reflete quem é esperado.
      const { data: aulasProximas, error: erroProximas } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, turma_id,
          turmas(nome, modalidade_id, modalidades(nome), horario_inicio),
          professores!professor_executou_id(id, nome),
          presencas(aluno_id, alunos(id, nome))
        `)
        .in('data_aula', [hoje, amanha])
        .not('turma_id', 'is', null)
        .neq('status_aula', 'cancelada')
      if (erroProximas) throw erroProximas

      // Agrupa por (aluno, modalidade) — a mesma dupla pode aparecer em mais de uma
      // ocorrência (ex.: aula hoje E amanhã, ou dois professores substituindo).
      const alvo = new Map()
      ;(aulasProximas || []).forEach(a => {
        const modalidadeId = a.turmas?.modalidade_id
        if (!modalidadeId) return
        a.presencas?.forEach(p => {
          if (!p.aluno_id) return
          const key = `${p.aluno_id}|${modalidadeId}`
          if (!alvo.has(key)) {
            alvo.set(key, {
              alunoId: p.aluno_id,
              alunoNome: p.alunos?.nome || '—',
              modalidadeId,
              modalidadeNome: a.turmas?.modalidades?.nome || '',
              ocorrencias: [],
            })
          }
          alvo.get(key).ocorrencias.push({
            aulaId: a.id,
            data: a.data_aula,
            turmaNome: a.turmas?.nome,
            horario: a.turmas?.horario_inicio?.slice(0, 5) || '',
            professorId: a.professores?.id || null,
            professorNome: a.professores?.nome || '',
          })
        })
      })
      if (alvo.size === 0) return []

      // 2. Histórico de presença desses alunos (todas as aulas já dadas até hoje), só das
      // modalidades que interessam (as mesmas da aula de hoje/amanhã de cada um).
      const alunoIds = [...new Set([...alvo.values()].map(v => v.alunoId))]
      const { data: historico, error: erroHistorico } = await supabase
        .from('presencas')
        .select('aluno_id, status_presenca, presente, aulas!inner(data_aula, status_aula, turma_id, turmas(modalidade_id))')
        .in('aluno_id', alunoIds)
        .eq('aulas.status_aula', 'dada')
        .lte('aulas.data_aula', hoje)
      if (erroHistorico) throw erroHistorico

      const registros = new Map()
      ;(historico || []).forEach(p => {
        const modalidadeId = p.aulas?.turmas?.modalidade_id
        if (!modalidadeId || !p.aluno_id) return
        const key = `${p.aluno_id}|${modalidadeId}`
        if (!alvo.has(key)) return
        if (p.status_presenca === 'falta_justificada') return
        if (!registros.has(key)) registros.set(key, [])
        registros.get(key).push({ data: p.aulas.data_aula, presente: ehPresente(p) })
      })

      // 3. Streak (mais recente primeiro, para no primeiro "presente")
      const resultado = []
      alvo.forEach((info, key) => {
        const ordenado = (registros.get(key) || []).sort((a, b) => b.data.localeCompare(a.data))
        let streak = 0
        for (const r of ordenado) {
          if (r.presente) break
          streak++
        }
        if (streak >= 2) resultado.push({ ...info, faltasConsecutivas: streak })
      })

      return resultado.sort((a, b) => b.faltasConsecutivas - a.faltasConsecutivas)
    },
    staleTime: 5 * 60 * 1000,
  })
}
