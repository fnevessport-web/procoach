import { supabase } from '../lib/supabase'
import { getModalidadeDaAula, getQuadraNome } from '../constants/modalidades'
import { QUADRAS_EMPRESA } from './useFinanceiro'

// Cruzamento automático — lê o relatório de pagantes que o clube manda (planilha
// Nome/Modalidade/Nivel/Turma/ValorProporcional/Data) e bate contra os alunos que
// realmente têm presença marcada em aula no ProCoach no mesmo período. O que sobra sem
// bater é o sinal de "quanto estamos deixando de receber" (ou de rastrear direito).
//
// Validado contra um arquivo real antes de escrever este código (ver conversa) — 3 coisas
// que só apareceram testando com dado de verdade, não dava pra adivinhar:
//  1. O nome do clube quase nunca bate 100% com o nosso — falta nome do meio, sobrenome
//     abreviado, pequena troca de letra (ex.: "Simeoni" vs "Simeone"). Comparar string
//     exata dava ~57% de acerto; comparando por PRIMEIRO + ÚLTIMO nome (ignorando os do
//     meio) sobe pra ~69%, e cobre a esmagadora maioria dessas variações.
//  2. A coluna "Data" da planilha do clube é hora de PROCESSAMENTO da cobrança, não data de
//     aula — por isso o cruzamento é por (nome, modalidade, horário), não por dia calendário.
//  3. "Saibro" no relatório do clube = "Tênis" no ProCoach (nome do piso vs nome do esporte).

export const MAPA_MODALIDADE_CLUBE = {
  saibro: 'Tênis',
  'beach tennis': 'Beach Tennis',
  futevolei: 'Futevôlei',
  'volei de praia': 'Vôlei de Praia',
  padel: 'Padel',
  squash: 'Squash',
  pickleball: 'Pickleball',
}

const MAPA_DIA_CLUBE = { seg: 'segunda', ter: 'terca', qua: 'quarta', qui: 'quinta', sex: 'sexta', sab: 'sabado', dom: 'domingo' }

function semAcento(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
function normalizar(s) {
  return semAcento(s).toUpperCase().replace(/\s+/g, ' ')
}
// Primeiro + último nome, ignorando os do meio — ver nota (1) acima.
function chaveNome(nomeNorm) {
  const partes = nomeNorm.split(' ').filter(Boolean)
  if (partes.length <= 1) return partes[0] || ''
  return `${partes[0]} ${partes.at(-1)}`
}

// "2X SEMANA - SEG E QUA - 18H" / "1X SEMANA - SÁB - 10H" -> { freq, dias[], hora }
function parseTurmaClube(texto) {
  const m = String(texto || '').match(/^(\d)X SEMANA - ([A-ZÀ-Ú]+)(?:\s+E\s+([A-ZÀ-Ú]+))? - (\d{1,2})H$/i)
  if (!m) return null
  const dias = [MAPA_DIA_CLUBE[semAcento(m[2]).slice(0, 3)], m[3] ? MAPA_DIA_CLUBE[semAcento(m[3]).slice(0, 3)] : null].filter(Boolean)
  return { freq: Number(m[1]), dias, hora: `${m[4].padStart(2, '0')}:00` }
}

// Lê a planilha do clube (.xlsx) direto no navegador — mesma lib (exceljs) já usada em
// relatorioExport.js, carregada sob demanda (só quem anexa o arquivo baixa a lib).
export async function parseArquivoClube(file) {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const buffer = await file.arrayBuffer()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('Planilha vazia ou em formato inesperado.')

  const linhas = []
  for (let i = 2; i <= ws.rowCount; i++) {
    const [, nome, modalidade, nivel, turma, valor] = ws.getRow(i).values
    if (!nome) continue
    const nomeNorm = normalizar(nome)
    const modalidadeMapeada = MAPA_MODALIDADE_CLUBE[semAcento(modalidade)] || modalidade
    linhas.push({
      nome: String(nome).trim(),
      nomeNorm,
      chaveNome: chaveNome(nomeNorm),
      modalidadeClube: modalidade,
      modalidade: modalidadeMapeada,
      nivel,
      turmaTexto: turma,
      turmaParsed: parseTurmaClube(turma),
      valor: Number(valor) || 0,
    })
  }
  if (linhas.length === 0) throw new Error('Nenhuma linha reconhecida — confirme que a planilha tem as colunas Nome, Modalidade, Nivel, Turma, ValorProporcional.')
  return linhas
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

const TODAS_QUADRAS = [...QUADRAS_EMPRESA.procopio, ...QUADRAS_EMPRESA.beach_arena]

// Nosso lado: combos únicos (chaveNome, modalidade, horário) com presença de verdade no
// período — cobre as duas unidades, já que o relatório do clube mistura Procópio e Beach
// Arena numa planilha só.
async function buscarNossosCombos({ dataInicio, dataFim }) {
  const aulas = await buscarTodasAsAulas(() => supabase
    .from('aulas')
    .select(`
      id, data_aula, turma_id, observacoes,
      turmas(horario_inicio, quadras(nome), modalidades(nome)),
      presencas(tipo_participacao, alunos(nome))
    `)
    .gte('data_aula', dataInicio)
    .lte('data_aula', dataFim)
    .eq('status_aula', 'dada'))

  const filtradas = (aulas || []).filter(a => {
    const quadra = a.turma_id ? (a.turmas?.quadras?.nome || '') : getQuadraNome(a)
    return TODAS_QUADRAS.includes(quadra)
  })

  const combos = new Map()
  filtradas.forEach(a => {
    const modalidade = getModalidadeDaAula(a)
    const horario = a.turma_id ? (a.turmas?.horario_inicio?.slice(0, 5) || '') : ''
    ;(a.presencas || [])
      .filter(p => p.tipo_participacao !== 'cortesia' && p.alunos?.nome)
      .forEach(p => {
        const chave = `${chaveNome(normalizar(p.alunos.nome))}|${modalidade}|${horario}`
        if (!combos.has(chave)) combos.set(chave, { nome: p.alunos.nome, modalidade, horario, count: 0 })
        combos.get(chave).count++
      })
  })
  return combos
}

// Junta os dois lados. `linhasClube` vem de parseArquivoClube; período deve ser o mesmo
// ciclo de pagamento do clube (o mesmo já usado no Confronto de Alunos em Aula).
export async function cruzarComClube({ linhasClube, dataInicio, dataFim }) {
  const nossosCombos = await buscarNossosCombos({ dataInicio, dataFim })
  const nomesNossos = new Set([...nossosCombos.values()].map(c => chaveNome(normalizar(c.nome))))

  const bateram = []
  const semCorrespondencia = []
  linhasClube.forEach(l => {
    if (!l.turmaParsed) {
      semCorrespondencia.push({ ...l, motivo: 'Não entendi o formato da coluna Turma' })
      return
    }
    const chave = `${l.chaveNome}|${l.modalidade}|${l.turmaParsed.hora}`
    if (nossosCombos.has(chave)) {
      bateram.push(l)
    } else {
      const motivo = nomesNossos.has(l.chaveNome)
        ? 'Aluno existe, mas sem presença nesse horário/modalidade no período'
        : 'Nome não encontrado em nenhuma presença do período'
      semCorrespondencia.push({ ...l, motivo })
    }
  })

  const valorSemCorrespondencia = semCorrespondencia.reduce((s, l) => s + l.valor, 0)

  const porModalidadeMap = {}
  linhasClube.forEach(l => {
    if (!porModalidadeMap[l.modalidade]) porModalidadeMap[l.modalidade] = { modalidade: l.modalidade, total: 0, semCorrespondencia: 0 }
    porModalidadeMap[l.modalidade].total++
  })
  semCorrespondencia.forEach(l => {
    if (porModalidadeMap[l.modalidade]) porModalidadeMap[l.modalidade].semCorrespondencia++
  })
  const porModalidade = Object.values(porModalidadeMap).sort((a, b) => b.semCorrespondencia - a.semCorrespondencia)

  return {
    totalClube: linhasClube.length,
    totalBateram: bateram.length,
    totalSemCorrespondencia: semCorrespondencia.length,
    valorSemCorrespondencia,
    bateram,
    semCorrespondencia,
    porModalidade,
  }
}
