import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { getQuadraNome, getModalidadeDaAula, diaSemanaDaData, horarioInicioDaAula, MODALIDADE_EMPRESA } from '../constants/modalidades'
import { QUADRAS_EMPRESA } from './useFinanceiro'
import { getFeriado } from '../constants/feriados'

const SELECT_AULAS = `
  id, data_aula, status_aula, motivo_cancelamento, turma_id, observacoes, professor_executou_id,
  professores!professor_executou_id(nome),
  turmas(nome, quadra_id, quadras(nome), modalidade_id, modalidades(nome), horario_inicio, nivel_id, niveis(nome)),
  presencas(id, aluno_id, status_presenca, tipo_participacao)
`

const DIAS_TABELA_HEATMAP = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

// Mesma convenção usada no painel do professor (DashboardProfessor.jsx): turma
// individual lota com 1 aluno, turma em grupo lota com 4 — não existe coluna de
// capacidade no banco, é regra fixa do produto.
const VAGAS_INDIVIDUAL = 1
const VAGAS_GRUPO = 4

function parseObsNivel(obs) {
  if (!obs) return ''
  const partes = obs.split('·').map(s => s.trim())
  return partes[3] || ''
}

// Aula em turma: individual é um nível específico ("Individual") — mesma convenção
// já usada em DashboardProfessor.jsx. Aula avulsa: o nível vem como texto livre na
// observação, então checamos o mesmo valor por convenção.
function isAulaIndividual(a) {
  if (a.turma_id) return a.turmas?.niveis?.nome === 'Individual'
  return parseObsNivel(a.observacoes) === 'Individual'
}

// Quantas vezes cada dia da semana ocorre dentro do período — é o denominador da
// média (ex.: "somar as 5 segundas-feiras e dividir por 5").
function contarOcorrenciasPorDiaSemana(periodoInicio, periodoFim) {
  const contagem = {}
  const [anoIni, mesIni, diaIni] = periodoInicio.split('-').map(Number)
  const [anoFim, mesFim, diaFim] = periodoFim.split('-').map(Number)
  const cursor = new Date(anoIni, mesIni - 1, diaIni)
  const fim = new Date(anoFim, mesFim - 1, diaFim)
  while (cursor <= fim) {
    const dataStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    const dia = diaSemanaDaData(dataStr)
    contagem[dia] = (contagem[dia] || 0) + 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return contagem
}

// Mapa de calor de alunos inscritos (presença + falta, todo mundo que estava
// escalado) por dia da semana x horário, só Tênis, segunda a sábado.
//
// Em cada ocorrência de data+horário, soma os inscritos de TODAS as turmas
// simultâneas daquele slot (ex.: uma turma em grupo + uma individual às 7h da
// mesma segunda viram um único número somado). Depois, o valor da célula é a
// MÉDIA dessas somas semanais pelo número de vezes que aquele dia da semana
// ocorreu no período (ex.: soma das 5 segundas-feiras dividida por 5) — e não uma
// média por sessão, que sub-contaria slots com turmas simultâneas.
//
// A "força" da célula (usada pra colorir o mapa) é a OCUPAÇÃO — inscritos sobre
// vagas totais do slot — não o número bruto de gente. Uma turma em grupo cheia (4)
// + individual cheia (1) = 5 pessoas em 5 vagas = 100% cheio, mesmo peso que duas
// turmas em grupo cheias (4+4=8 pessoas em 8 vagas, também 100%).
function construirHeatmapTenis(aulas, periodoInicio, periodoFim) {
  const porDataHora = {}
  aulas.forEach(a => {
    if (getModalidadeDaAula(a) !== 'Tênis') return
    const horaStr = horarioInicioDaAula(a)
    if (!horaStr) return
    const hora = horaStr.slice(0, 2)
    const chave = `${a.data_aula}_${hora}`
    const inscritos = (a.presencas || []).length
    const individual = isAulaIndividual(a)
    const vagas = individual ? VAGAS_INDIVIDUAL : VAGAS_GRUPO
    if (!porDataHora[chave]) porDataHora[chave] = { data: a.data_aula, hora, total: 0, grupo: 0, individual: 0, vagasTotal: 0 }
    porDataHora[chave].total += inscritos
    porDataHora[chave].vagasTotal += vagas
    if (individual) porDataHora[chave].individual += inscritos
    else porDataHora[chave].grupo += inscritos
  })

  const baldes = {}
  Object.values(porDataHora).forEach(({ data, hora, total, grupo, individual, vagasTotal }) => {
    const dia = diaSemanaDaData(data)
    const chave = `${dia}_${hora}`
    if (!baldes[chave]) baldes[chave] = { somaTotal: 0, somaGrupo: 0, somaIndividual: 0, somaVagas: 0 }
    baldes[chave].somaTotal += total
    baldes[chave].somaGrupo += grupo
    baldes[chave].somaIndividual += individual
    baldes[chave].somaVagas += vagasTotal
  })

  const contagemDiaSemana = contarOcorrenciasPorDiaSemana(periodoInicio, periodoFim)

  const diasComDados = DIAS_TABELA_HEATMAP.filter(d =>
    Object.keys(baldes).some(chave => chave.startsWith(`${d}_`))
  )
  const horasSet = new Set()
  Object.keys(baldes).forEach(chave => horasSet.add(chave.split('_')[1]))
  const horas = Array.from(horasSet).sort()

  const celulas = {}
  diasComDados.forEach(d => {
    celulas[d] = {}
    const denom = contagemDiaSemana[d] || 1
    horas.forEach(h => {
      const b = baldes[`${d}_${h}`]
      if (!b) { celulas[d][h] = null; return }
      const mediaVagas = b.somaVagas / denom
      celulas[d][h] = {
        media: b.somaTotal / denom,
        mediaGrupo: b.somaGrupo / denom,
        mediaIndividual: b.somaIndividual / denom,
        mediaVagas,
        ocupacao: mediaVagas > 0 ? Math.min(1, (b.somaTotal / denom) / mediaVagas) : 0,
      }
    })
  })

  return { dias: diasComDados, horas, celulas }
}

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
    heatmapTenis: construirHeatmapTenis(aulas || [], inicio, fim),
    periodo: { inicio, fim },
  }
}

export function useRelatorioMensal({ periodoInicio, periodoFim, empresa, modalidade } = {}) {
  return useQuery({
    queryKey: ['relatorio-mensal', periodoInicio, periodoFim, empresa, modalidade],
    queryFn: () => buscarRelatorioMensal({ periodoInicio, periodoFim, empresa, modalidade }),
  })
}
