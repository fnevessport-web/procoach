import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { getQuadraNome, getModalidadeDaAula, construirHeatmapOcupacao, MODALIDADE_EMPRESA } from '../constants/modalidades'
import { QUADRAS_EMPRESA } from './useFinanceiro'
import { getFeriado } from '../constants/feriados'

const SELECT_AULAS = `
  id, data_aula, status_aula, motivo_cancelamento, turma_id, observacoes, professor_executou_id,
  professores!professor_executou_id(nome),
  turmas(nome, quadra_id, quadras(nome), modalidade_id, modalidades(nome), horario_inicio, nivel_id, niveis(nome)),
  presencas(id, aluno_id, status_presenca, tipo_participacao, alunos(nome))
`

function empresaDaAula(aula) {
  const modalidade = getModalidadeDaAula(aula)
  if (MODALIDADE_EMPRESA[modalidade]) return MODALIDADE_EMPRESA[modalidade]
  const quadra = getQuadraNome(aula)
  if (QUADRAS_EMPRESA.procopio.includes(quadra)) return 'procopio'
  if (QUADRAS_EMPRESA.beach_arena.includes(quadra)) return 'beach_arena'
  return null
}

function agregar(aulas) {
  const aulasFiltradas = aulas || []

  const aulasProgramadas = aulasFiltradas.length
  const aulasDadas = aulasFiltradas.filter(a => a.status_aula === 'dada')
  const aulasCanceladas = aulasFiltradas.filter(a => a.status_aula === 'cancelada')
  const aulasSemAluno = aulasFiltradas.filter(a => !a.presencas || a.presencas.length === 0)

  const motivosCancelamento = {}
  aulasCanceladas.forEach(a => {
    const motivo = a.motivo_cancelamento || 'Não informado'
    motivosCancelamento[motivo] = (motivosCancelamento[motivo] || 0) + 1
  })
  const canceladasPorChuva = motivosCancelamento['Chuva'] || 0

  const todasPresencas = aulasFiltradas.flatMap(a => a.presencas || [])
  const presentes = todasPresencas.filter(p => p.status_presenca === 'presente').length
  const faltas = todasPresencas.filter(p => p.status_presenca === 'falta').length
  const faltasJustificadas = todasPresencas.filter(p => p.status_presenca === 'falta_justificada').length
  const totalMarcadas = presentes + faltas + faltasJustificadas
  const taxaPresenca = totalMarcadas > 0 ? Math.round((presentes / totalMarcadas) * 100) : 0
  const alunosUnicos = new Set(todasPresencas.filter(p => p.aluno_id).map(p => p.aluno_id)).size

  const porTipoParticipacao = {}
  todasPresencas.forEach(p => {
    const tipo = p.tipo_participacao || 'mensalista'
    porTipoParticipacao[tipo] = (porTipoParticipacao[tipo] || 0) + 1
  })

  const modMap = {}
  aulasFiltradas.forEach(a => {
    const nome = getModalidadeDaAula(a) || 'Sem modalidade'
    if (!modMap[nome]) modMap[nome] = { nome, aulas: 0, dadas: 0, presencas: 0 }
    modMap[nome].aulas++
    if (a.status_aula === 'dada') modMap[nome].dadas++
    modMap[nome].presencas += (a.presencas || []).length
  })
  const porModalidade = Object.values(modMap).sort((a, b) => b.aulas - a.aulas)

  const empresaMap = {}
  aulasFiltradas.forEach(a => {
    const emp = empresaDaAula(a) || 'outro'
    if (!empresaMap[emp]) empresaMap[emp] = { empresa: emp, aulas: 0, dadas: 0, presencas: 0 }
    empresaMap[emp].aulas++
    if (a.status_aula === 'dada') empresaMap[emp].dadas++
    empresaMap[emp].presencas += (a.presencas || []).length
  })
  const porEmpresa = Object.values(empresaMap).sort((a, b) => b.aulas - a.aulas)

  const aulasEmFeriado = aulasFiltradas.filter(a => getFeriado(a.data_aula) && (a.presencas || []).length > 0)

  const profMap = {}
  aulasDadas.forEach(a => {
    const id = a.professor_executou_id
    if (!id) return
    if (!profMap[id]) profMap[id] = { id, nome: a.professores?.nome || 'Sem professor', total: 0 }
    profMap[id].total++
  })
  const rankingProfessores = Object.values(profMap).sort((a, b) => b.total - a.total)

  return {
    aulasProgramadas,
    aulasDadas: aulasDadas.length,
    aulasCanceladas: aulasCanceladas.length,
    aulasSemAluno: aulasSemAluno.length,
    taxaRealizacao: aulasProgramadas > 0 ? Math.round((aulasDadas.length / aulasProgramadas) * 100) : 0,
    motivosCancelamento,
    canceladasPorChuva,
    presentes,
    faltas,
    faltasJustificadas,
    taxaPresenca,
    alunosUnicos,
    porTipoParticipacao,
    porModalidade,
    porEmpresa,
    aulasEmFeriado: aulasEmFeriado.length,
    rankingProfessores,
  }
}

export async function buscarRelatorioMensal({ periodoInicio, periodoFim, empresa, modalidade } = {}) {
  const inicio = periodoInicio || format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const fim = periodoFim || format(endOfMonth(new Date()), 'yyyy-MM-dd')
  const inicioAnterior = format(startOfMonth(subMonths(new Date(inicio + 'T12:00'), 1)), 'yyyy-MM-dd')
  const fimAnterior = format(endOfMonth(subMonths(new Date(inicio + 'T12:00'), 1)), 'yyyy-MM-dd')

  const [{ data: aulas, error: erroAtual }, { data: aulasAnterior, error: erroAnterior }] = await Promise.all([
    supabase.from('aulas').select(SELECT_AULAS).gte('data_aula', inicio).lte('data_aula', fim),
    supabase.from('aulas').select(SELECT_AULAS).gte('data_aula', inicioAnterior).lte('data_aula', fimAnterior),
  ])
  if (erroAtual) throw erroAtual
  if (erroAnterior) throw erroAnterior

  const filtrar = (lista) => lista
    .filter(a => !empresa || empresaDaAula(a) === empresa)
    .filter(a => !modalidade || getModalidadeDaAula(a) === modalidade)

  const atual = agregar(filtrar(aulas))
  const anterior = agregar(filtrar(aulasAnterior))

  function variacao(chaveAtual, chaveAnterior) {
    if (!chaveAnterior) return null
    return Math.round(((chaveAtual - chaveAnterior) / chaveAnterior) * 100)
  }

  return {
    ...atual,
    comparativo: {
      aulasDadasAnterior: anterior.aulasDadas,
      taxaPresencaAnterior: anterior.taxaPresenca,
      alunosUnicosAnterior: anterior.alunosUnicos,
      variacaoAulasDadas: variacao(atual.aulasDadas, anterior.aulasDadas),
      variacaoTaxaPresenca: variacao(atual.taxaPresenca, anterior.taxaPresenca),
      variacaoAlunosUnicos: variacao(atual.alunosUnicos, anterior.alunosUnicos),
    },
    heatmapTenis: construirHeatmapOcupacao(aulas || [], inicio, fim, 'Tênis'),
    periodo: { inicio, fim },
  }
}

// Lista de presença por aluno, separada por modalidade — pra cada aluno que teve pelo menos
// uma presença marcada no período, conta quantas aulas ficou vinculado, quantas presenças e
// faltas teve, e sinaliza risco de evasão quando a presença cai demais. Ignora o filtro de
// modalidade da tela de propósito: o objetivo aqui é justamente separar tudo por modalidade
// num relatório só, igual pedido ("todos os nomes separado por modalidade").
export async function buscarRelatorioPresencaAlunos({ periodoInicio, periodoFim, empresa } = {}) {
  const inicio = periodoInicio || format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const fim = periodoFim || format(endOfMonth(new Date()), 'yyyy-MM-dd')

  const { data: aulas, error } = await supabase
    .from('aulas').select(SELECT_AULAS)
    .gte('data_aula', inicio).lte('data_aula', fim)
  if (error) throw error

  const aulasFiltradas = (aulas || []).filter(a => !empresa || empresaDaAula(a) === empresa)

  const porModalidade = {}
  aulasFiltradas.forEach(a => {
    const modalidade = getModalidadeDaAula(a) || 'Sem modalidade'
    if (!porModalidade[modalidade]) porModalidade[modalidade] = {}
    const grupo = porModalidade[modalidade]
    ;(a.presencas || []).forEach(p => {
      if (!p.aluno_id) return
      if (!grupo[p.aluno_id]) {
        grupo[p.aluno_id] = { nome: p.alunos?.nome || 'Aluno sem nome', aulasVinculadas: 0, presentes: 0, faltas: 0, faltasJustificadas: 0, reposicoes: 0, registros: [] }
      }
      const registro = grupo[p.aluno_id]
      registro.aulasVinculadas++
      const presente = p.status_presenca === 'presente'
      const falta = p.status_presenca === 'falta'
      const faltaJustificada = p.status_presenca === 'falta_justificada'
      if (presente) registro.presentes++
      else if (falta) registro.faltas++
      else if (faltaJustificada) registro.faltasJustificadas++
      // Reposição é um tipo de participação (não um status de presença) — o aluno tá ali
      // repondo uma aula perdida em outro dia. Conta à parte, sem tirar da contagem de
      // presença/falta acima, só pra deixar visível quantas dessas aulas foram reposição.
      if (p.tipo_participacao === 'reposicao') registro.reposicoes++
      // Falta justificada (aula cancelada por chuva, atestado etc.) não é culpa do aluno —
      // não entra na % de presença nem na sequência de risco de evasão, como se a aula não
      // tivesse acontecido pra fins dessas duas contas.
      if (presente || falta) registro.registros.push({ data: a.data_aula, presente })
    })
  })

  const resultado = Object.entries(porModalidade)
    .map(([modalidade, alunosMap]) => {
      const alunos = Object.values(alunosMap)
        .map(({ registros, ...a }) => {
          const totalMarcado = a.presentes + a.faltas
          const pctPresenca = totalMarcado > 0 ? Math.round((a.presentes / totalMarcado) * 100) : 0

          // Mesmo critério de "risco de evasão" já usado no painel da modalidade
          // (useModalidadeDashboard.js) — 3+ faltas seguidas, olhando pra trás a partir da
          // aula mais recente do período — só que aqui restrito ao mês do relatório.
          const ordenado = [...registros].sort((x, y) => y.data.localeCompare(x.data))
          let faltasConsecutivas = 0
          for (const r of ordenado) {
            if (r.presente) break
            faltasConsecutivas++
          }

          let risco = ''
          if (totalMarcado === 0) risco = a.faltasJustificadas > 0 ? 'Só aulas canceladas/justificadas no período' : 'Sem presença confirmada'
          else if (faltasConsecutivas >= 3) risco = `Risco alto de evasão — ${faltasConsecutivas} faltas seguidas`
          else if (pctPresenca < 75) risco = 'Atenção — presença baixa'
          return { ...a, pctPresenca, risco }
        })
        .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))
      return { modalidade, alunos }
    })
    .sort((a, b) => a.modalidade.localeCompare(b.modalidade, 'pt-BR'))

  return { periodo: { inicio, fim }, porModalidade: resultado }
}

export function useRelatorioMensal({ periodoInicio, periodoFim, empresa, modalidade } = {}) {
  return useQuery({
    queryKey: ['relatorio-mensal', periodoInicio, periodoFim, empresa, modalidade],
    queryFn: () => buscarRelatorioMensal({ periodoInicio, periodoFim, empresa, modalidade }),
  })
}
