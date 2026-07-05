import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, startOfMonth, subMonths, differenceInCalendarDays } from 'date-fns'
import { MODALIDADE_EMPRESA } from '../constants/modalidades'

const CAPACIDADE_TURMA = 4
const DIAS_SEMANA_HEATMAP = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const HORAS_HEATMAP = Array.from({ length: 16 }, (_, i) => 6 + i) // 06h..21h

function horarioParaMinutos(hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function ehPresente(p) {
  return p.status_presenca === 'presente' || p.presente
}

function ehFalta(p) {
  return p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada'
}

export function useModalidadeDashboard(nomeModalidade) {
  const hoje = new Date()
  const hojeStr = format(hoje, 'yyyy-MM-dd')
  const inicioMesAtual = startOfMonth(hoje)
  const inicioMesAtualStr = format(inicioMesAtual, 'yyyy-MM-dd')
  const inicioMesAnterior = startOfMonth(subMonths(hoje, 1))
  const diaAtual = hoje.getDate()
  const fimJanelaAnterior = new Date(inicioMesAnterior)
  fimJanelaAnterior.setDate(diaAtual)
  const janelaHistorico = format(inicioMesAnterior, 'yyyy-MM-dd')

  const { data: modalidade, isLoading: loadingModalidade } = useQuery({
    queryKey: ['modalidade_por_nome', nomeModalidade],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modalidades')
        .select('id, nome, icone_emoji, cor_hex')
        .eq('nome', nomeModalidade)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!nomeModalidade,
  })

  const modalidadeId = modalidade?.id

  const { data: alunosModalidade = [], isLoading: loadingAlunos } = useQuery({
    queryKey: ['modalidade_dashboard_alunos', modalidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alunos')
        .select('id')
        .eq('modalidade_id', modalidadeId)
        .eq('ativo', true)
      if (error) throw error
      return data || []
    },
    enabled: !!modalidadeId,
  })

  const { data: turmasModalidade = [], isLoading: loadingTurmas } = useQuery({
    queryKey: ['modalidade_dashboard_turmas', modalidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('turmas')
        .select('id, nome, horario_inicio, horario_dia_semana, quadras(nome), turmas_alunos(id, ativo)')
        .eq('modalidade_id', modalidadeId)
        .eq('ativo', true)
      if (error) throw error
      return data || []
    },
    enabled: !!modalidadeId,
  })

  const { data: aulasModalidade = [], isLoading: loadingAulas } = useQuery({
    queryKey: ['modalidade_dashboard_aulas', nomeModalidade, janelaHistorico],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aulas')
        .select(`
          id, data_aula, status_aula,
          turmas!inner(nome, horario_inicio, horario_fim, horario_dia_semana, modalidades!inner(nome)),
          professores!professor_executou_id(id, nome),
          presencas(id, presente, status_presenca, aluno_id, alunos(id, nome))
        `)
        .eq('turmas.modalidades.nome', nomeModalidade)
        .gte('data_aula', janelaHistorico)
        .lte('data_aula', hojeStr)
        .neq('status_aula', 'cancelada')
      if (error) throw error
      return data || []
    },
    enabled: !!nomeModalidade,
  })

  const temDados = alunosModalidade.length > 0
  const empresa = MODALIDADE_EMPRESA[nomeModalidade] || null

  // ── Acontecendo agora ──────────────────────────────────────────
  const agoraMin = hoje.getHours() * 60 + hoje.getMinutes()
  const aulasAgora = aulasModalidade.filter(a => {
    if (a.data_aula !== hojeStr) return false
    const inicio = horarioParaMinutos(a.turmas?.horario_inicio)
    const fim = horarioParaMinutos(a.turmas?.horario_fim)
    if (inicio == null || fim == null) return false
    return agoraMin >= inicio && agoraMin < fim
  })

  const acontecendoAgora = aulasAgora.length === 0 ? null : {
    horario: format(hoje, 'HH:mm'),
    aulas: aulasAgora.length,
    alunosEsperados: aulasAgora.reduce((s, a) => s + (a.presencas?.length || 0), 0),
    presentes: aulasAgora.reduce((s, a) => s + (a.presencas?.filter(ehPresente).length || 0), 0),
    faltas: aulasAgora.reduce((s, a) => s + (a.presencas?.filter(ehFalta).length || 0), 0),
  }

  // ── Visão geral do mês ─────────────────────────────────────────
  function statsPeriodo(inicioStr, fimStr) {
    const emJanela = aulasModalidade.filter(a =>
      a.data_aula >= inicioStr && a.data_aula <= fimStr && a.status_aula === 'dada'
    )
    let presentes = 0, faltas = 0
    emJanela.forEach(a => a.presencas?.forEach(p => {
      if (ehPresente(p)) presentes++
      else if (ehFalta(p)) faltas++
    }))
    const total = presentes + faltas
    return { aulas: emJanela.length, presentes, faltas, pct: total > 0 ? Math.round((presentes / total) * 100) : 0 }
  }

  const statsMesAtual = statsPeriodo(inicioMesAtualStr, hojeStr)
  const statsMesAnterior = statsPeriodo(format(inicioMesAnterior, 'yyyy-MM-dd'), format(fimJanelaAnterior, 'yyyy-MM-dd'))

  const mes = {
    alunosAtivos: alunosModalidade.length,
    aulasRealizadas: statsMesAtual.aulas,
    pctAtual: statsMesAtual.pct,
    pctAnterior: statsMesAnterior.pct,
    diasComparados: diaAtual,
    labelMesAtual: format(hoje, 'MMMM'),
    labelMesAnterior: format(inicioMesAnterior, 'MMMM'),
  }

  // ── Mapa de calor (dia da semana x horário) ─────────────────────
  const bucketCalor = {}
  aulasModalidade.forEach(a => {
    if (a.status_aula !== 'dada') return
    const dia = a.turmas?.horario_dia_semana
    const hora = a.turmas?.horario_inicio ? parseInt(a.turmas.horario_inicio.slice(0, 2), 10) : null
    if (!dia || hora == null) return
    const key = `${dia}-${hora}`
    if (!bucketCalor[key]) bucketCalor[key] = { presentes: 0, faltas: 0 }
    a.presencas?.forEach(p => {
      if (ehPresente(p)) bucketCalor[key].presentes++
      else if (ehFalta(p)) bucketCalor[key].faltas++
    })
  })

  const mapaCalor = DIAS_SEMANA_HEATMAP.flatMap(dia => HORAS_HEATMAP.map(hora => {
    const b = bucketCalor[`${dia}-${hora}`]
    const total = b ? b.presentes + b.faltas : 0
    const pct = total > 0 ? Math.round((b.presentes / total) * 100) : null
    const nivel = pct == null ? 'sem_dados' : pct >= 80 ? 'lotado' : pct >= 40 ? 'medio' : 'vazio'
    return { dia, hora, pct, nivel }
  }))

  // ── Ocupação das turmas ──────────────────────────────────────────
  const ocupacaoTurmas = turmasModalidade
    .map(t => {
      const ocupacao = t.turmas_alunos?.filter(ta => ta.ativo).length || 0
      const nivel = ocupacao >= CAPACIDADE_TURMA ? 'cheio' : ocupacao >= 2 ? 'medio' : 'baixo'
      return {
        id: t.id,
        nome: t.nome,
        horario: t.horario_inicio?.slice(0, 5) || '',
        diaSemana: t.horario_dia_semana || '',
        quadraNome: t.quadras?.nome || '',
        ocupacao,
        capacidade: CAPACIDADE_TURMA,
        nivel,
      }
    })
    .sort((a, b) => (a.diaSemana || '').localeCompare(b.diaSemana || '') || a.horario.localeCompare(b.horario))

  // ── Top alunos — frequência (mês atual) ─────────────────────────
  const alunoStats = {}
  aulasModalidade.forEach(a => {
    if (a.status_aula !== 'dada' || a.data_aula < inicioMesAtualStr || a.data_aula > hojeStr) return
    a.presencas?.forEach(p => {
      if (!p.aluno_id) return
      if (!alunoStats[p.aluno_id]) alunoStats[p.aluno_id] = { nome: p.alunos?.nome || '—', presentes: 0, faltas: 0 }
      if (ehPresente(p)) alunoStats[p.aluno_id].presentes++
      else if (ehFalta(p)) alunoStats[p.aluno_id].faltas++
    })
  })
  const topAlunos = Object.entries(alunoStats)
    .map(([id, s]) => {
      const total = s.presentes + s.faltas
      return { id, nome: s.nome, aulas: total, pct: total > 0 ? Math.round((s.presentes / total) * 100) : 0 }
    })
    .sort((a, b) => b.pct - a.pct || b.aulas - a.aulas)

  // ── Risco de evasão (3+ faltas consecutivas) ────────────────────
  const registrosPorAluno = {}
  aulasModalidade.forEach(a => {
    if (a.status_aula !== 'dada') return
    a.presencas?.forEach(p => {
      if (!p.aluno_id) return
      if (!registrosPorAluno[p.aluno_id]) registrosPorAluno[p.aluno_id] = { nome: p.alunos?.nome || '—', registros: [] }
      registrosPorAluno[p.aluno_id].registros.push({ data: a.data_aula, presente: ehPresente(p) })
    })
  })

  const riscoEvasao = Object.entries(registrosPorAluno)
    .map(([id, info]) => {
      const ordenado = [...info.registros].sort((a, b) => b.data.localeCompare(a.data))
      let streak = 0
      for (const r of ordenado) {
        if (r.presente) break
        streak++
      }
      if (streak < 3) return null
      const ultimaData = ordenado[0]?.data
      const dias = ultimaData ? differenceInCalendarDays(hoje, new Date(ultimaData + 'T12:00:00')) : null
      return { id, nome: info.nome, faltasConsecutivas: streak, diasDesdeUltimaAula: dias }
    })
    .filter(Boolean)
    .sort((a, b) => b.faltasConsecutivas - a.faltasConsecutivas)

  // ── Ranking de professores (mês atual) ──────────────────────────
  const profStats = {}
  aulasModalidade.forEach(a => {
    if (a.data_aula < inicioMesAtualStr || a.data_aula > hojeStr || !a.professores) return
    if (!profStats[a.professores.id]) profStats[a.professores.id] = { nome: a.professores.nome, aulas: 0 }
    profStats[a.professores.id].aulas++
  })
  const rankingProfessores = Object.entries(profStats).map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => b.aulas - a.aulas)
  const maxAulasProf = rankingProfessores[0]?.aulas || 1
  rankingProfessores.forEach(p => { p.pct = Math.round((p.aulas / maxAulasProf) * 100) })

  return {
    modalidade,
    empresa,
    temDados,
    acontecendoAgora,
    mes,
    mapaCalor,
    ocupacaoTurmas,
    topAlunos,
    riscoEvasao,
    rankingProfessores,
    isLoading: loadingModalidade || loadingAlunos || loadingTurmas || loadingAulas,
  }
}
