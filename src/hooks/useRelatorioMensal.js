import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { getQuadraNome, getModalidadeDaAula, construirHeatmapOcupacao, calcularValorAula, aulaComTodosAusentes, MODALIDADE_EMPRESA, VAGAS_GRUPO, VAGAS_INDIVIDUAL } from '../constants/modalidades'
import { QUADRAS_EMPRESA } from './useFinanceiro'
import { getFeriado } from '../constants/feriados'

const SELECT_AULAS = `
  id, data_aula, status_aula, motivo_cancelamento, turma_id, observacoes, professor_executou_id, paga_professor,
  professores!professor_executou_id(nome, valor_aula, valor_hora_aula, valor_aula_beach),
  turmas(nome, quadra_id, quadras(nome), modalidade_id, modalidades(nome), horario_inicio, nivel_id, niveis(nome)),
  presencas(id, aluno_id, status_presenca, tipo_participacao, alunos(nome))
`

// O Supabase/PostgREST corta qualquer select em 1000 linhas por padrão (config.toml
// `max_rows`) — um mês cheio (Procópio + Beach Arena juntas, todo status) passa fácil
// disso (ex.: julho/2026 teve 1560 linhas de aula), e sem paginação a consulta simplesmente
// devolvia as primeiras 1000 sem avisar, derrubando "aulas dadas", o ranking de professores,
// os mapas de calor e a presença por aluno — tudo calculado em cima de um recorte
// incompleto do mês. `.order('id')` é obrigatório aqui: sem uma ordenação estável, cada
// página do `.range()` pode repetir ou pular linhas.
async function buscarTodasAsAulas(construirQuery) {
  const TAMANHO_PAGINA = 1000
  let offset = 0
  let todas = []
  while (true) {
    const { data, error } = await construirQuery().order('id', { ascending: true }).range(offset, offset + TAMANHO_PAGINA - 1)
    if (error) throw error
    todas = todas.concat(data || [])
    if (!data || data.length < TAMANHO_PAGINA) break
    offset += TAMANHO_PAGINA
  }
  return todas
}

function empresaDaAula(aula) {
  const modalidade = getModalidadeDaAula(aula)
  if (MODALIDADE_EMPRESA[modalidade]) return MODALIDADE_EMPRESA[modalidade]
  const quadra = getQuadraNome(aula)
  if (QUADRAS_EMPRESA.procopio.includes(quadra)) return 'procopio'
  if (QUADRAS_EMPRESA.beach_arena.includes(quadra)) return 'beach_arena'
  return null
}

function modalidadesDaEmpresa(empresa) {
  return Object.entries(MODALIDADE_EMPRESA).filter(([, e]) => e === empresa).map(([nome]) => nome)
}

function agregar(aulas) {
  const aulasFiltradas = aulas || []

  const aulasProgramadas = aulasFiltradas.length
  // "Dada" sozinho não prova que a aula aconteceu: toda aula nasce com status_aula='dada'
  // já na hora que a turma é gerada pro mês inteiro (limitação antiga do banco, ver
  // useGerarAulas em useAulas.js), então 94% delas nunca passam por nenhuma confirmação de
  // coordenador — o campo fica só o valor de fábrica. Presença registrada (pelo menos 1
  // aluno marcado, presente ou falta) é o sinal real de que a aula rolou; é o mesmo critério
  // que já vale pra decidir se o professor recebe (paga_professor em useAulas.js). Sem isso,
  // "aulas dadas" contava também os horários vazios que nunca foram nem revisados.
  const aulasDadas = aulasFiltradas.filter(a => a.status_aula === 'dada' && (a.presencas || []).length > 0)
  const aulasCanceladas = aulasFiltradas.filter(a => a.status_aula === 'cancelada')
  const aulasSemAluno = aulasFiltradas.filter(a => a.status_aula === 'dada' && (!a.presencas || a.presencas.length === 0))

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
    if (a.status_aula === 'dada' && (a.presencas || []).length > 0) modMap[nome].dadas++
    modMap[nome].presencas += (a.presencas || []).length
  })
  const porModalidade = Object.values(modMap).sort((a, b) => b.aulas - a.aulas)

  const empresaMap = {}
  aulasFiltradas.forEach(a => {
    const emp = empresaDaAula(a) || 'outro'
    if (!empresaMap[emp]) empresaMap[emp] = { empresa: emp, aulas: 0, dadas: 0, presencas: 0 }
    empresaMap[emp].aulas++
    if (a.status_aula === 'dada' && (a.presencas || []).length > 0) empresaMap[emp].dadas++
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

  // Aulas pagas ao professor onde NENHUM aluno da turma compareceu (100% de falta) — se só
  // 1 faltou mas outro veio, não conta (a aula rolou de verdade). Serve pra medir quanto do
  // que se paga em professor vira custo puro, sem nenhum aluno atendido. Só entram aulas
  // com paga_professor=true (mesmo critério de custo usado no Financeiro).
  const aulasSemComparecimentoLista = aulasDadas.filter(a => a.paga_professor && aulaComTodosAusentes(a))
  const profFaltaMap = {}
  let valorSemComparecimento = 0
  aulasSemComparecimentoLista.forEach(a => {
    const id = a.professor_executou_id
    if (!id) return
    const empresa = empresaDaAula(a)
    const valor = calcularValorAula(a, a.professores, empresa)
    valorSemComparecimento += valor
    if (!profFaltaMap[id]) profFaltaMap[id] = { id, nome: a.professores?.nome || 'Sem professor', qtd: 0, valor: 0 }
    profFaltaMap[id].qtd++
    profFaltaMap[id].valor += valor
  })
  const aulasSemComparecimento = {
    qtd: aulasSemComparecimentoLista.length,
    valor: valorSemComparecimento,
    porProfessor: Object.values(profFaltaMap).sort((a, b) => b.valor - a.valor),
  }

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
    aulasSemComparecimento,
  }
}

// Lista de presença por aluno, separada por modalidade — pra cada aluno que teve pelo menos
// uma presença marcada no período, conta quantas aulas ficou vinculado, quantas presenças,
// faltas e reposições teve, e sinaliza risco de evasão quando a presença cai demais.
function construirPresencaPorAluno(aulasFiltradas) {
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
        // Prioriza quem precisa de atenção — um gestor abrindo uma lista de 150+ alunos deve
        // ver primeiro quem está em risco, não rolar tudo procurando as linhas vermelhas.
        .sort((x, y) => pesoRisco(x.risco) - pesoRisco(y.risco) || x.nome.localeCompare(y.nome, 'pt-BR'))
      return { modalidade, alunos }
    })
    .sort((a, b) => a.modalidade.localeCompare(b.modalidade, 'pt-BR'))

  return resultado
}

function pesoRisco(risco) {
  if (risco.startsWith('Risco alto')) return 0
  if (risco.startsWith('Atenção')) return 1
  if (risco.startsWith('Só aulas') || risco.startsWith('Sem presença')) return 2
  return 3
}

// Contagens usadas tanto nos Insights Executivos quanto pra dar destaque visual — reaproveita
// o mesmo cálculo de risco por aluno já usado no detalhamento, sem duplicar a lógica.
function contarRiscos(presencaPorModalidade) {
  const todos = presencaPorModalidade.flatMap(g => g.alunos)
  return {
    riscoAltoCount: todos.filter(a => a.risco.startsWith('Risco alto')).length,
    atencaoCount: todos.filter(a => a.risco.startsWith('Atenção')).length,
  }
}

export { construirPresencaPorAluno }

const PESO_SEVERIDADE = { critico: 0, atencao: 1, bom: 2, info: 3 }

// Insights Executivos: síntese em texto do "resumo" já calculado (agregar() + riscoAlto/atencaoCount
// + comparativo) — mesma informação que já está nos cards e tabelas, só lida em 10 segundos em vez
// de garimpada manualmente. Usado tanto no preview ao vivo (KPIsPage) quanto no PDF/PNG exportado,
// pra nunca divergir entre as duas telas.
export function gerarInsights(resumo) {
  const insights = []
  const push = (severidade, texto) => insights.push({ severidade, texto })

  if (resumo.comparativo?.semHistoricoAnterior) {
    push('info', 'Ainda não há mês anterior com dados suficientes pra comparar — a comparação mês a mês passa a valer a partir do próximo período.')
  }

  if (resumo.taxaPresenca >= 75) {
    push('bom', `Taxa de presença saudável: ${resumo.taxaPresenca}%.`)
  } else if (resumo.taxaPresenca >= 50) {
    push('atencao', `Taxa de presença em ${resumo.taxaPresenca}% — abaixo do recomendado (75%).`)
  } else if (resumo.aulasProgramadas > 0) {
    push('critico', `Taxa de presença em ${resumo.taxaPresenca}% — bem abaixo do ideal (75%). Vale investigar o motivo das faltas.`)
  }

  if (resumo.taxaRealizacao < 65 && resumo.aulasProgramadas > 0) {
    push('critico', `Só ${resumo.taxaRealizacao}% das aulas programadas foram realizadas — muitas aulas não estão acontecendo.`)
  } else if (resumo.taxaRealizacao < 85 && resumo.aulasProgramadas > 0) {
    push('atencao', `Taxa de realização em ${resumo.taxaRealizacao}%, com espaço pra melhorar.`)
  }

  if (resumo.riscoAltoCount > 0) {
    push('critico', `${resumo.riscoAltoCount} aluno${resumo.riscoAltoCount === 1 ? '' : 's'} em risco alto de evasão (3+ faltas seguidas) — recomenda-se contato direto.`)
  } else if (resumo.aulasProgramadas > 0) {
    push('bom', 'Nenhum aluno em risco alto de evasão neste período.')
  }

  if (resumo.atencaoCount > 0) {
    push('atencao', `${resumo.atencaoCount} aluno${resumo.atencaoCount === 1 ? '' : 's'} com presença abaixo de 75% — vale acompanhar de perto.`)
  }

  const motivos = Object.entries(resumo.motivosCancelamento || {})
  if (motivos.length > 0) {
    const [motivoTop, totalTop] = motivos.sort((a, b) => b[1] - a[1])[0]
    if (motivoTop === 'Não informado' && totalTop >= resumo.aulasCanceladas * 0.5) {
      push('atencao', `${totalTop} cancelamento${totalTop === 1 ? '' : 's'} sem motivo registrado — informar o motivo ao cancelar deixa o relatório mais confiável.`)
    } else if (motivoTop !== 'Não informado') {
      push('info', `"${motivoTop}" foi o principal motivo de cancelamento no período (${totalTop} aula${totalTop === 1 ? '' : 's'}).`)
    }
  }

  const comp = resumo.comparativo
  if (comp && !comp.semHistoricoAnterior) {
    if (comp.variacaoAulasDadas >= 10) push('bom', `Aulas dadas cresceram ${comp.variacaoAulasDadas}% em relação ao mês anterior.`)
    else if (comp.variacaoAulasDadas <= -10) push('critico', `Aulas dadas caíram ${Math.abs(comp.variacaoAulasDadas)}% em relação ao mês anterior.`)

    if (comp.variacaoTaxaPresenca >= 10) push('bom', `Taxa de presença melhorou ${comp.variacaoTaxaPresenca}% em relação ao mês anterior.`)
    else if (comp.variacaoTaxaPresenca <= -10) push('atencao', `Taxa de presença caiu ${Math.abs(comp.variacaoTaxaPresenca)}% em relação ao mês anterior.`)
  }

  if (resumo.rankingProfessores?.length > 0) {
    const lider = resumo.rankingProfessores[0]
    push('info', `${lider.nome} lidera o período com ${lider.total} aula${lider.total === 1 ? '' : 's'} dadas.`)
  }

  return insights
    .sort((a, b) => PESO_SEVERIDADE[a.severidade] - PESO_SEVERIDADE[b.severidade])
    .slice(0, 6)
}

// Versão "leve" — só o resumo executivo, usada pelos cards ao vivo da tela (useRelatorioMensal).
// `modalidades` é um array (vazio/undefined = todas as modalidades da empresa selecionada, ou
// todas de todas as empresas se `empresa` também não vier).
export async function buscarRelatorioMensal({ periodoInicio, periodoFim, empresa, modalidades } = {}) {
  const inicio = periodoInicio || format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const fim = periodoFim || format(endOfMonth(new Date()), 'yyyy-MM-dd')
  const inicioAnterior = format(startOfMonth(subMonths(new Date(inicio + 'T12:00'), 1)), 'yyyy-MM-dd')
  const fimAnterior = format(endOfMonth(subMonths(new Date(inicio + 'T12:00'), 1)), 'yyyy-MM-dd')

  const [aulas, aulasAnterior] = await Promise.all([
    buscarTodasAsAulas(() => supabase.from('aulas').select(SELECT_AULAS).gte('data_aula', inicio).lte('data_aula', fim)),
    buscarTodasAsAulas(() => supabase.from('aulas').select(SELECT_AULAS).gte('data_aula', inicioAnterior).lte('data_aula', fimAnterior)),
  ])

  const filtrar = (lista) => (lista || [])
    .filter(a => !empresa || empresaDaAula(a) === empresa)
    .filter(a => !modalidades || modalidades.length === 0 || modalidades.includes(getModalidadeDaAula(a)))

  const atual = agregar(filtrar(aulas))
  const anterior = agregar(filtrar(aulasAnterior))
  const { riscoAltoCount, atencaoCount } = contarRiscos(construirPresencaPorAluno(filtrar(aulas)))
  const vagas = await buscarVagasDisponiveis({ empresa, modalidades })

  function variacao(chaveAtual, chaveAnterior) {
    if (!chaveAnterior) return null
    return Math.round(((chaveAtual - chaveAnterior) / chaveAnterior) * 100)
  }

  return {
    ...atual,
    riscoAltoCount,
    atencaoCount,
    vagas,
    comparativo: {
      aulasDadasAnterior: anterior.aulasDadas,
      taxaPresencaAnterior: anterior.taxaPresenca,
      alunosUnicosAnterior: anterior.alunosUnicos,
      variacaoAulasDadas: variacao(atual.aulasDadas, anterior.aulasDadas),
      variacaoTaxaPresenca: variacao(atual.taxaPresenca, anterior.taxaPresenca),
      variacaoAlunosUnicos: variacao(atual.alunosUnicos, anterior.alunosUnicos),
      // Clube novo (dados só a partir de junho/2026) — mês anterior sem nenhuma aula programada
      // é esperado, não uma anomalia; sinaliza pra tela mostrar "sem histórico" em vez de "vs 0".
      semHistoricoAnterior: anterior.aulasProgramadas === 0,
    },
    periodo: { inicio, fim },
  }
}

// Busca única e completa pra exportar o relatório de uma unidade: resumo executivo, mapa de
// calor de cada modalidade em escopo (com dado — modalidade sem nenhuma aula no período não
// gera página vazia) e a lista de presença por aluno separada por modalidade. Tudo a partir de
// uma única consulta de aulas do período, pra não repetir a mesma busca 3x nos exports.
export async function buscarRelatorioCompleto({ periodoInicio, periodoFim, empresa, modalidades } = {}) {
  const inicio = periodoInicio || format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const fim = periodoFim || format(endOfMonth(new Date()), 'yyyy-MM-dd')
  const inicioAnterior = format(startOfMonth(subMonths(new Date(inicio + 'T12:00'), 1)), 'yyyy-MM-dd')
  const fimAnterior = format(endOfMonth(subMonths(new Date(inicio + 'T12:00'), 1)), 'yyyy-MM-dd')

  const [aulas, aulasAnterior] = await Promise.all([
    buscarTodasAsAulas(() => supabase.from('aulas').select(SELECT_AULAS).gte('data_aula', inicio).lte('data_aula', fim)),
    buscarTodasAsAulas(() => supabase.from('aulas').select(SELECT_AULAS).gte('data_aula', inicioAnterior).lte('data_aula', fimAnterior)),
  ])

  const modalidadesEmEscopo = modalidades && modalidades.length > 0 ? modalidades : modalidadesDaEmpresa(empresa)

  const filtrar = (lista) => (lista || [])
    .filter(a => !empresa || empresaDaAula(a) === empresa)
    .filter(a => modalidadesEmEscopo.includes(getModalidadeDaAula(a)))

  const aulasFiltradas = filtrar(aulas)
  const aulasAnteriorFiltradas = filtrar(aulasAnterior)

  const atual = agregar(aulasFiltradas)
  const anterior = agregar(aulasAnteriorFiltradas)

  function variacao(chaveAtual, chaveAnterior) {
    if (!chaveAnterior) return null
    return Math.round(((chaveAtual - chaveAnterior) / chaveAnterior) * 100)
  }

  const presenca = { porModalidade: construirPresencaPorAluno(aulasFiltradas) }
  const { riscoAltoCount, atencaoCount } = contarRiscos(presenca.porModalidade)

  const resumo = {
    ...atual,
    riscoAltoCount,
    atencaoCount,
    comparativo: {
      aulasDadasAnterior: anterior.aulasDadas,
      taxaPresencaAnterior: anterior.taxaPresenca,
      alunosUnicosAnterior: anterior.alunosUnicos,
      variacaoAulasDadas: variacao(atual.aulasDadas, anterior.aulasDadas),
      variacaoTaxaPresenca: variacao(atual.taxaPresenca, anterior.taxaPresenca),
      variacaoAlunosUnicos: variacao(atual.alunosUnicos, anterior.alunosUnicos),
      semHistoricoAnterior: anterior.aulasProgramadas === 0,
    },
  }

  const heatmaps = modalidadesEmEscopo
    .map(modalidade => ({ modalidade, heatmap: construirHeatmapOcupacao(aulasFiltradas, inicio, fim, modalidade) }))
    .filter(({ heatmap }) => heatmap.dias.length > 0 && heatmap.horas.length > 0)

  const vagas = await buscarVagasDisponiveis({ empresa, modalidades: modalidadesEmEscopo })

  return { resumo, heatmaps, presenca, vagas, periodo: { inicio, fim }, empresa }
}

export function useRelatorioMensal({ periodoInicio, periodoFim, empresa, modalidades } = {}) {
  return useQuery({
    queryKey: ['relatorio-mensal', periodoInicio, periodoFim, empresa, modalidades],
    queryFn: () => buscarRelatorioMensal({ periodoInicio, periodoFim, empresa, modalidades }),
  })
}

const DIAS_SEMANA_LABEL = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' }

function empresaDaTurma(turma) {
  const modalidade = turma.modalidades?.nome
  if (MODALIDADE_EMPRESA[modalidade]) return MODALIDADE_EMPRESA[modalidade]
  const quadra = turma.quadras?.nome
  if (QUADRAS_EMPRESA.procopio.includes(quadra)) return 'procopio'
  if (QUADRAS_EMPRESA.beach_arena.includes(quadra)) return 'beach_arena'
  return null
}

// Relatório simplificado (aba "Lista de Alunos" em KPIs): uma linha por matrícula ativa
// (turma_id + aluno_id), com dia da semana/horário/turma-nível da turma e as contagens de
// presença dentro do período pedido — diferente de construirPresencaPorAluno (que só lista
// quem teve presença marcada no período), aqui entra todo aluno ativo na turma mesmo que
// ainda não tenha nenhuma aula computada no período (fica com os números zerados).
export async function buscarListaAlunosAtivos({ periodoInicio, periodoFim, empresa, modalidades } = {}) {
  const inicio = periodoInicio || format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const fim = periodoFim || format(endOfMonth(new Date()), 'yyyy-MM-dd')

  const { data: turmas, error: erroTurmas } = await supabase
    .from('turmas')
    .select(`
      id, nome, horario_dia_semana, horario_inicio, modalidade_id,
      modalidades(nome), niveis!nivel_id(nome), quadras!quadra_id(nome),
      turmas_alunos(aluno_id, ativo, alunos(id, nome, ativo))
    `)
    .eq('ativo', true)
  if (erroTurmas) throw erroTurmas

  const modalidadesEmEscopo = modalidades && modalidades.length > 0 ? modalidades : null

  const turmasFiltradas = (turmas || [])
    .filter(t => !empresa || empresaDaTurma(t) === empresa)
    .filter(t => !modalidadesEmEscopo || modalidadesEmEscopo.includes(t.modalidades?.nome))

  const turmaIds = turmasFiltradas.map(t => t.id)
  if (turmaIds.length === 0) return []

  const aulas = await buscarTodasAsAulas(() => supabase
    .from('aulas')
    .select('id, turma_id, presencas(aluno_id, status_presenca)')
    .in('turma_id', turmaIds)
    .gte('data_aula', inicio)
    .lte('data_aula', fim))

  const contagem = {}
  ;(aulas || []).forEach(a => {
    ;(a.presencas || []).forEach(p => {
      if (!p.aluno_id) return
      const chave = `${a.turma_id}_${p.aluno_id}`
      if (!contagem[chave]) contagem[chave] = { presentes: 0, faltas: 0, faltasJustificadas: 0 }
      if (p.status_presenca === 'presente') contagem[chave].presentes++
      else if (p.status_presenca === 'falta') contagem[chave].faltas++
      else if (p.status_presenca === 'falta_justificada') contagem[chave].faltasJustificadas++
    })
  })

  const linhas = []
  turmasFiltradas.forEach(t => {
    (t.turmas_alunos || [])
      .filter(ta => ta.ativo && ta.alunos?.ativo !== false && ta.alunos?.nome)
      .forEach(ta => {
        const c = contagem[`${t.id}_${ta.aluno_id}`] || { presentes: 0, faltas: 0, faltasJustificadas: 0 }
        const totalAulas = c.presentes + c.faltas + c.faltasJustificadas
        const totalMarcado = c.presentes + c.faltas
        const pctFrequencia = totalMarcado > 0 ? Math.round((c.presentes / totalMarcado) * 100) : 0
        linhas.push({
          alunoId: ta.aluno_id,
          nome: ta.alunos.nome,
          turmaId: t.id,
          turma: t.nome,
          nivel: t.niveis?.nome || '',
          diaSemana: DIAS_SEMANA_LABEL[t.horario_dia_semana] || t.horario_dia_semana || '',
          horario: t.horario_inicio?.slice(0, 5) || '',
          totalAulas,
          presentes: c.presentes,
          faltas: c.faltas,
          faltasJustificadas: c.faltasJustificadas,
          pctFrequencia,
        })
      })
  })

  return linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function useListaAlunosAtivos({ periodoInicio, periodoFim, empresa, modalidades } = {}) {
  return useQuery({
    queryKey: ['lista-alunos-ativos', periodoInicio, periodoFim, empresa, modalidades],
    queryFn: () => buscarListaAlunosAtivos({ periodoInicio, periodoFim, empresa, modalidades }),
  })
}

// Vagas disponíveis: quanto ainda dá pra vender nas turmas que já existem — turma em grupo
// tem 4 vagas, individual tem 1 (mesma convenção do mapa de calor); "vaga livre" é a
// capacidade menos os alunos ATIVOS matriculados agora. É sempre um retrato do momento em
// que o relatório é gerado (matrícula não é histórica, não dá pra saber "quantas vagas
// tinha em 15/07"), não um número do período do relatório como o resto. Turma sem nenhum
// aluno ativo entra como "inativa": continua ocupando horário na grade e gerando aula toda
// semana, mas não tem ninguém matriculado — a capacidade inteira dela vira vaga livre.
const SELECT_TURMAS_COM_ALUNOS = `
  id, nome, horario_dia_semana, horario_inicio, modalidade_id, ativo,
  modalidades(nome), niveis!nivel_id(nome), quadras!quadra_id(nome),
  turmas_alunos(aluno_id, ativo, alunos(id, ativo))
`

function mapearTurmaParaDetalhe(t) {
  const ativos = (t.turmas_alunos || []).filter(ta => ta.ativo && ta.alunos?.ativo !== false).length
  const individual = t.niveis?.nome === 'Individual'
  const capacidade = individual ? VAGAS_INDIVIDUAL : VAGAS_GRUPO
  return {
    turmaId: t.id,
    turma: t.nome,
    modalidade: t.modalidades?.nome || '',
    nivel: t.niveis?.nome || '',
    diaSemana: DIAS_SEMANA_LABEL[t.horario_dia_semana] || t.horario_dia_semana || '',
    horario: t.horario_inicio?.slice(0, 5) || '',
    quadra: t.quadras?.nome || '',
    ativo: t.ativo !== false,
    capacidade,
    ativos,
    vagasLivres: Math.max(0, capacidade - ativos),
    inativa: ativos === 0,
  }
}

// Busca turmas + matrícula ativa cruas, já filtradas por empresa/modalidade — usada tanto
// por buscarVagasDisponiveis (só turmas ativas) quanto por buscarTurmasCadastro (ativas E
// desativadas, pro export de cadastro completo), pra não duplicar a query e o mapeamento.
async function buscarTurmasComDetalhe({ empresa, modalidades, apenasAtivas = true } = {}) {
  let query = supabase.from('turmas').select(SELECT_TURMAS_COM_ALUNOS)
  if (apenasAtivas) query = query.eq('ativo', true)
  const { data: turmas, error } = await query
  if (error) throw error

  const modalidadesEmEscopo = modalidades && modalidades.length > 0 ? modalidades : null

  const turmasFiltradas = (turmas || [])
    .filter(t => !empresa || empresaDaTurma(t) === empresa)
    .filter(t => !modalidadesEmEscopo || modalidadesEmEscopo.includes(t.modalidades?.nome))

  return turmasFiltradas.map(mapearTurmaParaDetalhe)
}

// Turmas cadastradas — ativas E desativadas — com capacidade/ocupação de cada uma. Usada
// pro export em CSV/Excel pedido pelo clube: cadastro completo, não só as com problema
// (diferente de buscarVagasDisponiveis, que só olha turma ativa).
export async function buscarTurmasCadastro({ empresa, modalidades } = {}) {
  const detalhe = await buscarTurmasComDetalhe({ empresa, modalidades, apenasAtivas: false })
  return detalhe.sort((a, b) =>
    (a.diaSemana || '').localeCompare(b.diaSemana || '') || a.horario.localeCompare(b.horario)
  )
}

export async function buscarVagasDisponiveis({ empresa, modalidades } = {}) {
  const detalhe = await buscarTurmasComDetalhe({ empresa, modalidades, apenasAtivas: true })

  const turmasInativas = detalhe.filter(t => t.inativa).sort((a, b) => a.turma.localeCompare(b.turma, 'pt-BR'))
  const turmasComVaga = detalhe.filter(t => !t.inativa && t.vagasLivres > 0).sort((a, b) => b.vagasLivres - a.vagasLivres)

  const totalCapacidade = detalhe.reduce((s, t) => s + t.capacidade, 0)
  const totalAtivos = detalhe.reduce((s, t) => s + t.ativos, 0)
  const totalVagasLivres = detalhe.reduce((s, t) => s + t.vagasLivres, 0)
  const pctPreenchido = totalCapacidade > 0 ? Math.round((totalAtivos / totalCapacidade) * 100) : 0

  const porModalidadeMap = {}
  detalhe.forEach(t => {
    const nome = t.modalidade || 'Sem modalidade'
    if (!porModalidadeMap[nome]) porModalidadeMap[nome] = { modalidade: nome, capacidade: 0, ativos: 0, vagasLivres: 0, turmasInativas: 0 }
    porModalidadeMap[nome].capacidade += t.capacidade
    porModalidadeMap[nome].ativos += t.ativos
    porModalidadeMap[nome].vagasLivres += t.vagasLivres
    if (t.inativa) porModalidadeMap[nome].turmasInativas++
  })
  const porModalidade = Object.values(porModalidadeMap)
    .map(m => ({ ...m, pctPreenchido: m.capacidade > 0 ? Math.round((m.ativos / m.capacidade) * 100) : 0 }))
    .sort((a, b) => b.capacidade - a.capacidade)

  return {
    totalTurmas: detalhe.length,
    totalCapacidade,
    totalAtivos,
    totalVagasLivres,
    pctPreenchido,
    turmasInativas,
    turmasComVaga,
    porModalidade,
  }
}

export function useVagasDisponiveis({ empresa, modalidades } = {}) {
  return useQuery({
    queryKey: ['vagas-disponiveis', empresa, modalidades],
    queryFn: () => buscarVagasDisponiveis({ empresa, modalidades }),
  })
}
