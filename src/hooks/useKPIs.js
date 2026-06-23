import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

export function useKPIs({ periodoInicio, periodoFim, modalidadeId } = {}) {
  return useQuery({
    queryKey: ['kpis', periodoInicio, periodoFim, modalidadeId],
    queryFn: async () => {
      const inicio = periodoInicio || format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const fim = periodoFim || format(endOfMonth(new Date()), 'yyyy-MM-dd')
      const inicioAnterior = format(startOfMonth(subMonths(new Date(inicio + 'T12:00'), 1)), 'yyyy-MM-dd')
      const fimAnterior = format(endOfMonth(subMonths(new Date(inicio + 'T12:00'), 1)), 'yyyy-MM-dd')

      const [
        { data: aulas },
        { data: presencas },
        { data: professores },
        { data: aulasAnterior }
      ] = await Promise.all([
        supabase.from('aulas')
          .select('id, status, professor_executou_id, turma_id, data_aula, eh_substituicao, turmas(modalidade_id, modalidades(nome, icone_emoji, cor_hex)), professores!professor_executou_id(nome)')
          .gte('data_aula', inicio).lte('data_aula', fim),
        supabase.from('presencas')
          .select('id, presente, aluno_id, aula_id, aulas!inner(data_aula)')
          .gte('aulas.data_aula', inicio).lte('aulas.data_aula', fim),
        supabase.from('professores').select('id, nome, valor_hora_aula').eq('ativo', true),
        supabase.from('aulas')
          .select('id, status, professor_executou_id')
          .gte('data_aula', inicioAnterior).lte('data_aula', fimAnterior)
      ])

      const aulasFiltradas = modalidadeId
        ? aulas?.filter(a => a.turmas?.modalidade_id === modalidadeId)
        : aulas

      const match = aulasFiltradas?.filter(a => a.status === 'match') || []
      const divergencias = aulasFiltradas?.filter(a => a.status === 'divergencia') || []
      const naosDadas = aulasFiltradas?.filter(a => a.status === 'nao_dada') || []
      const subs = aulasFiltradas?.filter(a => a.eh_substituicao) || []

      // Professor com mais aulas
      const aulasProf = {}
      match.forEach(a => {
        if (!aulasProf[a.professor_executou_id]) {
          aulasProf[a.professor_executou_id] = { nome: a.professores?.nome, total: 0, valor: 0 }
        }
        const prof = professores?.find(p => p.id === a.professor_executou_id)
        aulasProf[a.professor_executou_id].total++
        aulasProf[a.professor_executou_id].valor += Number(prof?.valor_hora_aula || 0)
      })

      const profsMaisAulas = Object.entries(aulasProf)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5)
        .map(([id, d]) => ({ id, ...d }))

      // Taxa de presença
      const totalPresencas = presencas?.length || 0
      const presentes = presencas?.filter(p => p.presente).length || 0
      const taxaPresenca = totalPresencas > 0 ? Math.round((presentes / totalPresencas) * 100) : 0

      // Por modalidade
      const modMap = {}
      aulasFiltradas?.forEach(a => {
        const nomeMod = a.turmas?.modalidades?.nome || 'Sem modalidade'
        if (!modMap[nomeMod]) modMap[nomeMod] = { nome: nomeMod, icone: a.turmas?.modalidades?.icone_emoji, cor: a.turmas?.modalidades?.cor_hex, total: 0, match: 0 }
        modMap[nomeMod].total++
        if (a.status === 'match') modMap[nomeMod].match++
      })
      const porModalidade = Object.values(modMap).sort((a, b) => b.total - a.total)

      // Comparativo mes anterior
      const matchAtual = match.length
      const matchAnterior = aulasAnterior?.filter(a => a.status === 'match').length || 0
      const variacaoPerc = matchAnterior > 0
        ? Math.round(((matchAtual - matchAnterior) / matchAnterior) * 100)
        : null

      return {
        totalAulas: aulasFiltradas?.length || 0,
        totalMatch: match.length,
        totalDivergencias: divergencias.length,
        totalNaoDadas: naosDadas.length,
        totalSubs: subs.length,
        taxaPresenca,
        profsMaisAulas,
        porModalidade,
        matchAtual,
        matchAnterior,
        variacaoPerc
      }
    }
  })
}
