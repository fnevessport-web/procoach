import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, subDays } from 'date-fns'
import { useProfessores } from './useProfessores'
import { QUADRAS_EMPRESA } from './useFinanceiro'

function getEmpresaPorQuadra(quadraNome) {
  if (QUADRAS_EMPRESA.procopio.includes(quadraNome)) return 'procopio'
  if (QUADRAS_EMPRESA.beach_arena.includes(quadraNome)) return 'beach_arena'
  return null
}

function horarioParaMinutos(hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function minutosAgora() {
  const agora = new Date()
  return agora.getHours() * 60 + agora.getMinutes()
}

// Só aulas de turma têm horario_fim confiável — avulsas ficam de fora do "ao vivo agora"
function aulaEmAndamento(aula) {
  if (!aula.turma_id) return false
  const inicio = horarioParaMinutos(aula.turmas?.horario_inicio)
  const fim = horarioParaMinutos(aula.turmas?.horario_fim)
  if (inicio == null || fim == null) return false
  const agora = minutosAgora()
  return agora >= inicio && agora < fim
}

// Mesma tolerância de 10min usada em AulasCoordenador/useFinanceiro para "aula já começou"
function aulaJaComecou(aula) {
  if (!aula.turma_id) return true
  const inicio = horarioParaMinutos(aula.turmas?.horario_inicio)
  if (inicio == null) return true
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

  const aoVivoAgora = aulasHoje
    .filter(aulaEmAndamento)
    .map(a => {
      const quadraNome = a.turmas?.quadras?.nome || ''
      const presentes = a.presencas?.filter(p => p.status_presenca === 'presente' || p.presente).length || 0
      const faltas = a.presencas?.filter(p => p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada').length || 0
      return { ...a, quadraNome, empresa: getEmpresaPorQuadra(quadraNome), presentes, faltas }
    })
    .sort((a, b) => (a.turmas?.horario_inicio || '').localeCompare(b.turmas?.horario_inicio || ''))

  const aulasJaComecaram = aulasHoje.filter(aulaJaComecou)
  let presentes = 0, faltas = 0
  aulasJaComecaram.forEach(a => {
    a.presencas?.forEach(p => {
      if (p.status_presenca === 'presente' || p.presente) presentes++
      else if (p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada') faltas++
    })
  })
  const totalAulas = aulasHoje.length
  const alunosEsperados = aulasHoje.reduce((s, a) => s + (a.presencas?.length || 0), 0)
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
    const aulaAtual = aulasHoje.find(a => a.professores?.id === prof.id && aulaEmAndamento(a))
    if (aulaAtual) {
      return { ...prof, status: 'ativo', aula: aulaAtual, quadraNome: aulaAtual.turmas?.quadras?.nome || '' }
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

  return {
    aoVivoAgora,
    hojeAcumulado,
    professoresAgora,
    isLoading: loadingHoje || loadingProf,
  }
}
