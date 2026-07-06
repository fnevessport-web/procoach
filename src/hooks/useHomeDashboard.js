import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, subDays, addDays } from 'date-fns'
import { useProfessores } from './useProfessores'
import { QUADRAS_EMPRESA } from './useFinanceiro'
import { parseObservacoes, getQuadraNome, getModalidadeDaAula, horarioParaMinutos, horarioInicioDaAula, horarioFimDaAula } from '../constants/modalidades'

function getEmpresaPorQuadra(quadraNome) {
  if (QUADRAS_EMPRESA.procopio.includes(quadraNome)) return 'procopio'
  if (QUADRAS_EMPRESA.beach_arena.includes(quadraNome)) return 'beach_arena'
  return null
}

function getTurmaNome(aula) {
  if (!aula.turma_id) return parseObservacoes(aula.observacoes).nivel || 'Avulsa'
  return aula.turmas?.nome || '—'
}

// Avulsas sempre contam como ativas (já nascem com aluno) — turma só conta se a aula do dia tem alguém presente
// (usa presenças reais da aula, não a matrícula fixa da turma — pega também alunos de reposição)
function aulaTemAluno(aula) {
  if (!aula.turma_id) return true
  return (aula.presencas?.length || 0) > 0
}

function minutosAgora() {
  const agora = new Date()
  return agora.getHours() * 60 + agora.getMinutes()
}

// Tolerância de 10min após o término oficial: é o intervalo normal entre aulas
// (professor emendando atraso ou só bebendo água antes da próxima) — evita o
// widget "Ao Vivo" ficar vazio bem no meio desse intervalo.
function aulaEmAndamento(aula) {
  const inicio = horarioParaMinutos(horarioInicioDaAula(aula))
  const fim = horarioParaMinutos(horarioFimDaAula(aula))
  if (inicio == null || fim == null) return false
  const agora = minutosAgora()
  return agora >= inicio && agora < fim + 10
}

// Mesma tolerância de 10min usada em AulasCoordenador/useFinanceiro para "aula já começou"
function aulaJaComecou(aula) {
  const inicio = horarioParaMinutos(horarioInicioDaAula(aula))
  if (inicio == null) return false
  return minutosAgora() >= inicio - 10
}

export function useHomeDashboard() {
  const hoje = format(new Date(), 'yyyy-MM-dd')
  const ontem = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  const { data: aulasHoje = [], isLoading: loadingHoje } = useQuery({
    queryKey: ['home_dashboard_aulas', hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, turma_id, status_aula, observacoes,
          turmas(nome, horario_inicio, horario_fim, quadras(nome), modalidades(nome, icone_emoji, cor_hex)),
          professores!professor_executou_id(id, nome, foto_url),
          presencas(id, status_presenca, presente)
        `)
        .eq('data_aula', hoje)
        .neq('status_aula', 'cancelada')
      if (error) throw error
      return data || []
    },
    refetchInterval: 20000,
    staleTime: 15000,
  })

  const { data: ontemStats = { totalAulas: 0, totalAlunos: 0 } } = useQuery({
    queryKey: ['home_dashboard_ontem', ontem],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas')
        .select('id, presencas(id)')
        .eq('data_aula', ontem)
        .neq('status_aula', 'cancelada')
      if (error) throw error
      const totalAulas = data?.length || 0
      const totalAlunos = (data || []).reduce((s, a) => s + (a.presencas?.length || 0), 0)
      return { totalAulas, totalAlunos }
    },
    staleTime: 60000,
  })

  const { professores: todosProfessores, isLoading: loadingProf } = useProfessores(null)

  const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const { data: alertaSemProfessor = [] } = useQuery({
    queryKey: ['home_dashboard_sem_professor', hoje, amanha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula,
          turmas!inner(nome, horario_inicio, quadras(nome), niveis(nome), turmas_alunos!inner(id, ativo))
        `)
        .in('data_aula', [hoje, amanha])
        .neq('status_aula', 'cancelada')
        .is('professor_executou_id', null)
        .eq('turmas.turmas_alunos.ativo', true)
      if (error) throw error
      return data || []
    },
    staleTime: 60000,
  })

  const aulasAtivasHoje = aulasHoje.filter(aulaTemAluno)

  const aoVivoAgora = aulasAtivasHoje
    .filter(aulaEmAndamento)
    .map(a => {
      const quadraNome = getQuadraNome(a)
      const turmaNome = getTurmaNome(a)
      const modalidadeNome = getModalidadeDaAula(a)
      const horarioInicio = horarioInicioDaAula(a)
      const horarioFim = horarioFimDaAula(a)
      const presentes = a.presencas?.filter(p => p.status_presenca === 'presente' || p.presente).length || 0
      const faltas = a.presencas?.filter(p => p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada').length || 0
      return { ...a, quadraNome, turmaNome, modalidadeNome, horarioInicio, horarioFim, empresa: getEmpresaPorQuadra(quadraNome), presentes, faltas }
    })
    .sort((a, b) => (a.horarioInicio || '').localeCompare(b.horarioInicio || ''))

  const aulasJaComecaram = aulasAtivasHoje.filter(aulaJaComecou)
  let presentes = 0, faltas = 0
  aulasJaComecaram.forEach(a => {
    a.presencas?.forEach(p => {
      if (p.status_presenca === 'presente' || p.presente) presentes++
      else if (p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada') faltas++
    })
  })
  const totalAulas = aulasAtivasHoje.length
  const alunosEsperados = aulasAtivasHoje.reduce((s, a) => s + (a.presencas?.length || 0), 0)
  const totalConfirmado = presentes + faltas
  const pctPresenca = totalConfirmado > 0 ? Math.round((presentes / totalConfirmado) * 100) : 0

  const hojeAcumulado = {
    totalAulas,
    deltaAulas: totalAulas - ontemStats.totalAulas,
    alunosEsperados,
    deltaAlunos: alunosEsperados - ontemStats.totalAlunos,
    presentes,
    faltas,
    pctPresenca,
  }

  const professoresAtivos = (todosProfessores || []).filter(p => p.ativo !== false)

  const professoresAgora = professoresAtivos.map(prof => {
    const aulaAtual = aulasHoje.find(a => a.professores?.id === prof.id && aulaTemAluno(a) && aulaEmAndamento(a))
    if (aulaAtual) {
      return { ...prof, status: 'ativo', aula: aulaAtual, quadraNome: getQuadraNome(aulaAtual) }
    }
    const agora = minutosAgora()
    const proximas = aulasHoje
      .filter(a => a.professores?.id === prof.id && a.turma_id)
      .filter(a => {
        const inicio = horarioParaMinutos(a.turmas?.horario_inicio)
        return inicio != null && inicio > agora
      })
      .sort((a, b) => a.turmas.horario_inicio.localeCompare(b.turmas.horario_inicio))
    return { ...prof, status: 'livre', proximoHorario: proximas[0]?.turmas?.horario_inicio?.slice(0, 5) || null }
  }).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ativo' ? -1 : 1
    return (a.nome || '').localeCompare(b.nome || '')
  })

  const alertasSemProfessor = alertaSemProfessor.map(a => ({
    id: a.id,
    ehHoje: a.data_aula === hoje,
    turmaNome: a.turmas?.nome || '—',
    nivelNome: a.turmas?.niveis?.nome || '',
    horarioInicio: a.turmas?.horario_inicio?.slice(0, 5) || '',
    quadraNome: a.turmas?.quadras?.nome || '',
  })).sort((a, b) => (a.ehHoje === b.ehHoje ? 0 : a.ehHoje ? -1 : 1) || a.horarioInicio.localeCompare(b.horarioInicio))

  return {
    aoVivoAgora,
    hojeAcumulado,
    professoresAgora,
    alertasSemProfessor,
    isLoading: loadingHoje || loadingProf,
  }
}
