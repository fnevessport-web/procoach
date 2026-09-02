import { supabase } from '../lib/supabase'
import { getModalidadeDaAula, getQuadraNome, MODALIDADE_EMPRESA } from '../constants/modalidades'
import { QUADRAS_EMPRESA } from './useFinanceiro'

// Relatório de confronto — lista, dia a dia, todo aluno que esteve marcado numa aula da(s)
// modalidade(s) escolhida(s) no período (mesmo se faltou: o clube cobra pela matrícula/
// presença marcada, não pela presença de fato) pra bater contra a lista de pagantes que o
// clube manda. Só cortesia fica de fora (aluno de cortesia nunca é cobrado do cliente,
// então não pode aparecer como "pagante" nessa conta) — reposição e avulso entram
// normalmente, diferente da regra de pagamento de professor (que também tira reposição).

// Modalidades da Procópio (mesmas 4 do MODALIDADE_EMPRESA) — é o universo que o relatório
// do clube cobre pra essa unidade. Usada tanto pro filtro da tela quanto pro default (tudo
// marcado) quando nenhum filtro é passado.
export const MODALIDADES_PROCOPIO = Object.entries(MODALIDADE_EMPRESA)
  .filter(([, empresa]) => empresa === 'procopio')
  .map(([modalidade]) => modalidade)

// O clube chama a modalidade de Tênis de "Saibro" (nome do piso da quadra) no relatório
// deles — o ProCoach usa "Tênis". Mesma coisa, nome diferente; esse apelido só existe pra
// deixar isso óbvio na hora de bater o relatório nosso contra o deles, não é usado em
// nenhuma consulta/filtro (essas continuam por "Tênis", que é o nome real salvo no banco).
export const APELIDO_CLUBE = { 'Tênis': 'Saibro' }
export function nomeComApelidoClube(modalidade) {
  return APELIDO_CLUBE[modalidade] ? `${modalidade} (${APELIDO_CLUBE[modalidade]}, no relatório do clube)` : modalidade
}

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
    const horario = aula.turmas.horario_inicio?.slice(0, 5) || ''
    const quadra = aula.turmas.quadras?.nome || ''
    return { nome: aula.turmas.nome || 'Turma', detalhe: [horario, quadra].filter(Boolean).join(' · ') }
  }
  const partes = (aula.observacoes || '').split('·').map(s => s.trim())
  const quadra = partes[1] || getQuadraNome(aula)
  const horario = partes[2] || ''
  return { nome: 'Avulsa', detalhe: [horario, quadra].filter(Boolean).join(' · ') }
}

const LABEL_TIPO = { mensalista: 'Mensalista', avulso: 'Avulso', reposicao: 'Reposição' }
const LABEL_STATUS = { presente: 'Presente', falta: 'Falta', falta_justificada: 'Falta justificada' }

// `modalidades`: lista das modalidades a incluir (nomes reais do ProCoach, ex. ['Tênis',
// 'Padel']) — vazio/undefined cai no default (todas as 4 da Procópio).
export async function buscarConfrontoAlunos({ dataInicio, dataFim, modalidades }) {
  const modalidadesEmEscopo = modalidades && modalidades.length > 0 ? modalidades : MODALIDADES_PROCOPIO

  const aulas = await buscarTodasAsAulas(() => supabase
    .from('aulas')
    .select(`
      id, data_aula, turma_id, observacoes,
      turmas(nome, horario_inicio, quadras(nome), modalidades(nome)),
      presencas(tipo_participacao, status_presenca, alunos(nome))
    `)
    .gte('data_aula', dataInicio)
    .lte('data_aula', dataFim)
    .eq('status_aula', 'dada'))

  const aulasFiltradas = (aulas || []).filter(a => {
    const modalidade = getModalidadeDaAula(a)
    if (!modalidadesEmEscopo.includes(modalidade)) return false
    const quadra = a.turma_id ? (a.turmas?.quadras?.nome || '') : getQuadraNome(a)
    return QUADRAS_EMPRESA.procopio.includes(quadra)
  })

  const linhas = []
  aulasFiltradas.forEach(a => {
    const turma = labelTurma(a)
    const modalidade = getModalidadeDaAula(a)
    ;(a.presencas || [])
      .filter(p => p.tipo_participacao !== 'cortesia' && p.alunos?.nome)
      .forEach(p => {
        linhas.push({
          data: a.data_aula,
          modalidade,
          modalidadeLabel: nomeComApelidoClube(modalidade),
          turmaNome: turma.nome,
          turmaDetalhe: turma.detalhe,
          aluno: p.alunos.nome,
          tipo: LABEL_TIPO[p.tipo_participacao] || p.tipo_participacao || 'Mensalista',
          status: LABEL_STATUS[p.status_presenca] || p.status_presenca || '—',
        })
      })
  })
  linhas.sort((a, b) => a.data.localeCompare(b.data) || a.modalidade.localeCompare(b.modalidade, 'pt-BR') || a.turmaNome.localeCompare(b.turmaNome, 'pt-BR') || a.aluno.localeCompare(b.aluno, 'pt-BR'))

  const porDiaMap = {}
  linhas.forEach(l => {
    if (!porDiaMap[l.data]) porDiaMap[l.data] = []
    porDiaMap[l.data].push(l)
  })
  const porDia = Object.entries(porDiaMap)
    .map(([data, itens]) => ({ data, itens }))
    .sort((a, b) => a.data.localeCompare(b.data))

  // Lista única de nomes distintos no período — útil pra um confronto rápido, sem precisar
  // ficar catando nome repetido em cada dia.
  const nomesUnicos = [...new Set(linhas.map(l => l.aluno))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  return {
    modalidadesEmEscopo,
    linhas,
    porDia,
    nomesUnicos,
    totalRegistros: linhas.length,
    totalAlunosUnicos: nomesUnicos.length,
    totalDias: porDia.length,
  }
}
