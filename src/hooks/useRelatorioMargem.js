import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getModalidadeDaAula, getQuadraNome, calcularDetalheMargensTenis } from '../constants/modalidades'

// Relatório de Margem — uso interno (nunca sai pro professor nem pro relatório que vai pra
// Beyond, ver relatorioPdf.js). Escopo travado em Tênis/Procópio, única unidade com tabela de
// mensalidade confirmada pra calcular receita (ver calcularDetalheMargensTenis).
const EMPRESA_MARGEM = 'procopio'

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

function labelTurma(aula) {
  if (aula.turma_id && aula.turmas) {
    const quadra = aula.turmas.quadras?.nome || ''
    const horario = aula.turmas.horario_inicio?.slice(0, 5) || ''
    return { chave: `turma_${aula.turma_id}`, nome: aula.turmas.nome, detalhe: [horario, quadra].filter(Boolean).join(' · ') }
  }
  const partes = (aula.observacoes || '').split('·').map(s => s.trim())
  const quadra = partes[1] || getQuadraNome(aula)
  const horario = partes[2] || ''
  return { chave: `avulsa_${quadra}_${horario}`, nome: 'Avulsa', detalhe: [horario, quadra].filter(Boolean).join(' · ') }
}

export async function buscarRelatorioMargem({ dataInicio, dataFim }) {
  const aulas = await buscarTodasAsAulas(() => supabase
    .from('aulas')
    .select(`
      id, data_aula, turma_id, observacoes, status_aula, paga_professor, professor_executou_id,
      professores!professor_executou_id(id, nome, valor_aula, valor_hora_aula, valor_aula_beach),
      turmas(nome, horario_inicio, quadras(nome), niveis(nome), modalidades(nome)),
      presencas(tipo_participacao, status_presenca)
    `)
    .gte('data_aula', dataInicio)
    .lte('data_aula', dataFim)
    .eq('status_aula', 'dada')
    .eq('paga_professor', true))

  const aulasTenis = (aulas || []).filter(a => getModalidadeDaAula(a) === 'Tênis' && (a.presencas || []).length > 0)

  // calcularDetalheMargensTenis precisa do valor_aula do professor certo — agrupa por
  // professor pra chamar 1x por professor em vez de 1x por aula.
  const aulasPorProfessor = {}
  aulasTenis.forEach(a => {
    const id = a.professor_executou_id
    if (!id) return
    if (!aulasPorProfessor[id]) aulasPorProfessor[id] = []
    aulasPorProfessor[id].push(a)
  })

  const detalhePorAulaId = {}
  Object.values(aulasPorProfessor).forEach(aulasDoProf => {
    const professor = aulasDoProf[0].professores
    const porAula = calcularDetalheMargensTenis(aulasDoProf, professor, EMPRESA_MARGEM)
    Object.assign(detalhePorAulaId, porAula)
  })

  const linhas = []
  aulasTenis.forEach(a => {
    const detalhe = detalhePorAulaId[a.id]
    if (!detalhe) return
    const qtdAlunos = (a.presencas || []).filter(p => p.tipo_participacao !== 'cortesia' && p.tipo_participacao !== 'reposicao').length
    const turma = labelTurma(a)
    linhas.push({
      data: a.data_aula,
      turmaChave: turma.chave,
      turmaNome: turma.nome,
      turmaDetalhe: turma.detalhe,
      professorId: a.professor_executou_id,
      professorNome: a.professores?.nome || 'Sem professor',
      qtdAlunos,
      ...detalhe,
    })
  })
  linhas.sort((a, b) => a.data.localeCompare(b.data) || a.turmaNome.localeCompare(b.turmaNome, 'pt-BR'))

  const resumo = linhas.reduce((r, l) => {
    r.totalAulas++
    r.receitaTotal += l.receita
    r.custoTotal += l.custoProfessor
    r.margemTotal += l.margem
    if (l.margem > 0.005) r.aulasSuperavit++
    else if (l.margem < -0.005) r.aulasDeficit++
    else r.aulasNeutras++
    return r
  }, { totalAulas: 0, aulasSuperavit: 0, aulasDeficit: 0, aulasNeutras: 0, receitaTotal: 0, custoTotal: 0, margemTotal: 0 })

  const porDiaMap = {}
  linhas.forEach(l => {
    if (!porDiaMap[l.data]) porDiaMap[l.data] = { data: l.data, qtdAulas: 0, receita: 0, custo: 0, margem: 0 }
    porDiaMap[l.data].qtdAulas++
    porDiaMap[l.data].receita += l.receita
    porDiaMap[l.data].custo += l.custoProfessor
    porDiaMap[l.data].margem += l.margem
  })
  const porDia = Object.values(porDiaMap).sort((a, b) => a.data.localeCompare(b.data))

  const porTurmaMap = {}
  linhas.forEach(l => {
    if (!porTurmaMap[l.turmaChave]) {
      porTurmaMap[l.turmaChave] = {
        nome: l.turmaNome, detalhe: l.turmaDetalhe, professores: new Set(),
        qtdAulas: 0, receita: 0, custo: 0, margem: 0,
      }
    }
    const t = porTurmaMap[l.turmaChave]
    t.professores.add(l.professorNome)
    t.qtdAulas++
    t.receita += l.receita
    t.custo += l.custoProfessor
    t.margem += l.margem
  })
  const porTurma = Object.values(porTurmaMap)
    .map(t => ({ ...t, professores: Array.from(t.professores).join(', ') }))
    .sort((a, b) => a.margem - b.margem)

  const porProfessorMap = {}
  linhas.forEach(l => {
    if (!l.professorId) return
    if (!porProfessorMap[l.professorId]) porProfessorMap[l.professorId] = { nome: l.professorNome, qtdAulas: 0, receita: 0, custo: 0, margem: 0 }
    const p = porProfessorMap[l.professorId]
    p.qtdAulas++
    p.receita += l.receita
    p.custo += l.custoProfessor
    p.margem += l.margem
  })
  const porProfessor = Object.values(porProfessorMap)
    .map(p => ({ ...p, margemMedia: p.qtdAulas > 0 ? p.margem / p.qtdAulas : 0 }))
    .sort((a, b) => b.margem - a.margem)

  return { resumo, porDia, porTurma, porProfessor, detalheAulas: linhas }
}

export function useRelatorioMargem({ dataInicio, dataFim }, opcoes = {}) {
  return useQuery({
    queryKey: ['relatorio-margem', dataInicio, dataFim],
    queryFn: () => buscarRelatorioMargem({ dataInicio, dataFim }),
    enabled: (opcoes.enabled ?? true) && !!dataInicio && !!dataFim,
  })
}
