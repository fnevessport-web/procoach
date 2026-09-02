import { supabase } from '../lib/supabase'
import { getModalidadeDaAula, getQuadraNome, MODALIDADE_EMPRESA, diaSemanaDaData } from '../constants/modalidades'
import { QUADRAS_EMPRESA } from './useFinanceiro'

const LABEL_DIA_SEMANA = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' }
const ORDEM_DIA_SEMANA = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']

// Cruzamento automático — lê o relatório de pagantes que o clube manda (planilha
// Nome/Modalidade/Nivel/Turma/ValorProporcional/Data) e bate contra os alunos que
// realmente têm presença marcada em aula no ProCoach no mesmo período. Separado por
// empresa (Procópio/Beach Arena), com dois sentidos de conferência:
//  - linhas do clube sem correspondência no ProCoach (pode ser erro de grafia, ou aluno
//    que o clube cobra mas a gente não tem registrado);
//  - alunos nossos sem correspondência no clube (o sinal mais direto de "deixando de
//    receber" — a gente dá aula, o clube não tá cobrando por ela).
//
// Validado contra um arquivo real antes de escrever este código (ver conversa) — 3 coisas
// que só apareceram testando com dado de verdade, não dava pra adivinhar:
//  1. O nome do clube quase nunca bate 100% com o nosso. Duas variações diferentes:
//     (a) nome do meio faltando/sobrenome composto abreviado (ex.: "Adrienne Simeoni Lima
//         Borges" vs "Adrienne Simeone Lima Borges") — resolvido comparando só primeiro +
//         último nome, ignorando os do meio;
//     (b) erro de digitação DENTRO do primeiro ou último nome (ex.: cadastrada como "Laura
//         Shimizzu" no ProCoach, o clube manda "Laura Emy Shimizu" — sobrenome com uma
//         letra a mais) — isso o comparador de (a) sozinho não pega, porque compara o
//         token inteiro. Por isso tem uma segunda passada por distância de edição
//         (Levenshtein) nos nomes que não bateram exato, tolerando 1-2 letras de diferença.
//     Correspondência por distância de edição nunca é 100% garantida — por isso fica numa
//     categoria própria ("prováveis", pra revisar), não junto com "bateram" exato.
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

// Nome do clube vem em CAIXA ALTA ("LAURA EMY SHIMIZU") — usado pra sugerir a grafia
// corrigida no cadastro do ProCoach quando o coordenador confirma que é a mesma pessoa
// (ver "prováveis" em cruzarComClube). Preposição minúscula só quando não é a primeira
// palavra (evita "De Castro" no começo do nome); apóstrofo/hífen preserva capitalização
// dos dois lados (ex.: "D'ANGELO" -> "D'Angelo").
const PREPOSICOES_MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
export function nomeProprioPortugues(nomeCaixaAlta) {
  return String(nomeCaixaAlta || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((palavra, i) => {
      if (i > 0 && PREPOSICOES_MINUSCULAS.has(palavra)) return palavra
      return palavra.split(/([-'’])/).map(seg => (seg === '-' || seg === "'" || seg === '’') ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)).join('')
    })
    .join(' ')
}

function semAcento(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
function normalizar(s) {
  return semAcento(s).toUpperCase().replace(/\s+/g, ' ')
}
// Primeiro + último nome, ignorando os do meio — ver nota (1a) acima.
function chaveNome(nomeNorm) {
  const partes = nomeNorm.split(' ').filter(Boolean)
  if (partes.length <= 1) return partes[0] || ''
  return `${partes[0]} ${partes.at(-1)}`
}

// Distância de edição clássica (quantas trocas/inclusões/remoções de letra pra virar uma
// string na outra) — usada só na segunda passada, pra pegar erro de digitação tipo
// "Shimizu"/"Shimizzu" que a comparação exata de token não resolve. Implementação simples
// O(n·m); nomes de aluno são curtos, sem problema de performance mesmo com centenas de linha.
function distanciaEdicao(a, b) {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}
// Tolerância proporcional ao tamanho do nome — 1 letra de diferença num nome de 4 letras é
// bem mais significativo que numa string de 12.
function nomesParecidos(chaveA, chaveB) {
  if (chaveA === chaveB) return true
  const [primA, ...restoA] = chaveA.split(' ')
  const [primB, ...restoB] = chaveB.split(' ')
  const ultA = restoA.at(-1) || primA, ultB = restoB.at(-1) || primB
  const tolerancia = (s) => (s.length >= 8 ? 2 : 1)
  const primeiroBate = primA === primB || distanciaEdicao(primA, primB) <= tolerancia(primA)
  const ultimoBate = ultA === ultB || distanciaEdicao(ultA, ultB) <= tolerancia(ultA)
  return primeiroBate && ultimoBate
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

function empresaDaQuadra(quadra) {
  if (QUADRAS_EMPRESA.procopio.includes(quadra)) return 'procopio'
  if (QUADRAS_EMPRESA.beach_arena.includes(quadra)) return 'beach_arena'
  return null
}

// Nosso lado: combos únicos (chaveNome, modalidade, horário, empresa) com presença de
// verdade no período — array (não Map), porque a lista reversa (nossos sem correspondência
// no clube) precisa poder listar cada combo individualmente, não só checar existência.
async function buscarNossosCombos({ dataInicio, dataFim }) {
  const aulas = await buscarTodasAsAulas(() => supabase
    .from('aulas')
    .select(`
      id, data_aula, turma_id, observacoes,
      turmas(horario_inicio, quadras(nome), modalidades(nome)),
      presencas(tipo_participacao, status_presenca, alunos(nome))
    `)
    .gte('data_aula', dataInicio)
    .lte('data_aula', dataFim)
    .eq('status_aula', 'dada'))

  const combosMap = new Map()
  ;(aulas || []).forEach(a => {
    const quadra = a.turma_id ? (a.turmas?.quadras?.nome || '') : getQuadraNome(a)
    const empresa = empresaDaQuadra(quadra)
    if (!empresa) return
    const modalidade = getModalidadeDaAula(a)
    const horario = a.turma_id ? (a.turmas?.horario_inicio?.slice(0, 5) || '') : ''
    const diaSemana = diaSemanaDaData(a.data_aula)
    ;(a.presencas || [])
      .filter(p => p.tipo_participacao !== 'cortesia' && p.alunos?.nome)
      .forEach(p => {
        const nomeNorm = normalizar(p.alunos.nome)
        const chave = `${chaveNome(nomeNorm)}|${modalidade}|${horario}|${empresa}`
        if (!combosMap.has(chave)) {
          combosMap.set(chave, { nome: p.alunos.nome, chaveNome: chaveNome(nomeNorm), modalidade, horario, empresa, count: 0, presencas: 0, faltas: 0, diasSemana: new Set(), matched: false })
        }
        const combo = combosMap.get(chave)
        combo.count++
        if (p.status_presenca === 'presente') combo.presencas++
        else combo.faltas++
        if (diaSemana) combo.diasSemana.add(diaSemana)
      })
  })
  // Dias da semana como string ordenada (ex.: "Segunda, Quarta") — turma 2x/semana junta as
  // duas aulas no mesmo combo (mesmo horário), então o combo pode cobrir mais de um dia.
  return [...combosMap.values()].map(c => ({
    ...c,
    diasSemanaLabel: ORDEM_DIA_SEMANA.filter(d => c.diasSemana.has(d)).map(d => LABEL_DIA_SEMANA[d]).join(', '),
  }))
}

// Junta os dois lados. `linhasClube` vem de parseArquivoClube; período deve ser o mesmo
// ciclo de pagamento do clube (o mesmo já usado no Confronto de Alunos em Aula). Retorna
// os resultados já separados por empresa.
export async function cruzarComClube({ linhasClube, dataInicio, dataFim }) {
  const nossosCombos = await buscarNossosCombos({ dataInicio, dataFim })

  // Índice exato pra passada 1 (rápida); passada 2 (fuzzy) varre só quem sobrou, filtrando
  // por modalidade+horário pra não comparar nome contra nome de aula totalmente diferente.
  const indiceExato = new Map()
  nossosCombos.forEach(c => indiceExato.set(`${c.chaveNome}|${c.modalidade}|${c.horario}`, c))

  const bateram = []
  const provaveis = []
  const semCorrespondencia = []

  linhasClube.forEach(l => {
    // Empresa é fixa por modalidade no ProCoach (Tênis/Padel/Squash/Pickleball = Procópio,
    // Beach Tennis/Futevôlei/Vôlei de Praia = Beach Arena) — dá pra saber de qual unidade é
    // a linha mesmo quando ela não bate com nenhum combo nosso.
    const empresaDaLinha = MODALIDADE_EMPRESA[l.modalidade] || null
    if (!l.turmaParsed) {
      semCorrespondencia.push({ ...l, empresa: empresaDaLinha, motivo: 'Não entendi o formato da coluna Turma' })
      return
    }
    const chaveExata = `${l.chaveNome}|${l.modalidade}|${l.turmaParsed.hora}`
    const comboExato = indiceExato.get(chaveExata)
    if (comboExato) {
      comboExato.matched = true
      bateram.push({ ...l, empresa: comboExato.empresa })
      return
    }
    // Passada 2: mesmo modalidade+horário, nome parecido (tolera erro de digitação)
    const candidato = nossosCombos.find(c => !c.matched && c.modalidade === l.modalidade && c.horario === l.turmaParsed.hora && nomesParecidos(c.chaveNome, l.chaveNome))
    if (candidato) {
      candidato.matched = true
      provaveis.push({ ...l, empresa: candidato.empresa, nomeProcoach: candidato.nome })
      return
    }
    const existeEmOutroLugar = nossosCombos.some(c => nomesParecidos(c.chaveNome, l.chaveNome))
    semCorrespondencia.push({
      ...l,
      empresa: empresaDaLinha,
      motivo: existeEmOutroLugar
        ? 'Aluno existe, mas sem presença nesse horário/modalidade no período'
        : 'Nome não encontrado em nenhuma presença do período',
    })
  })

  // Sentido reverso: nossos combos que nenhuma linha do clube bateu (exato ou provável) —
  // o sinal de "aula que demos e o clube não cobrou por ela". Validado com dado real: ~25%
  // desses casos têm o MESMO nome do aluno em outra linha do clube (modalidade/horário
  // diferente) — geralmente é turma/horário cadastrado errado no ProCoach, não aluno
  // realmente fora da lista do clube. Por isso a lista é dividida em duas categorias, não
  // uma coisa só, senão o valor "perdido" fica inflado com falso-positivo.
  const nossosSemCorrespondencia = nossosCombos.filter(c => !c.matched).map(c => ({
    ...c,
    apareceEmOutraTurmaDoClube: linhasClube.some(l => l.chaveNome === c.chaveNome),
  }))

  // Valor médio pago pelo clube por modalidade (a partir do próprio arquivo dele) — usado
  // só pra estimar quanto uma aula "nossa sem correspondência" provavelmente valeria, já
  // que não temos o valor real que o clube cobraria por ela. Estimativa, não fato.
  const valorMedioPorModalidade = {}
  const somaPorModalidade = {}
  linhasClube.forEach(l => {
    if (!somaPorModalidade[l.modalidade]) somaPorModalidade[l.modalidade] = { soma: 0, qtd: 0 }
    somaPorModalidade[l.modalidade].soma += l.valor
    somaPorModalidade[l.modalidade].qtd++
  })
  Object.entries(somaPorModalidade).forEach(([mod, { soma, qtd }]) => { valorMedioPorModalidade[mod] = qtd > 0 ? soma / qtd : 0 })

  const nossosSemCorrespondenciaComValor = nossosSemCorrespondencia.map(c => ({
    ...c,
    valorEstimado: valorMedioPorModalidade[c.modalidade] || 0,
  }))
  // Só entra na estimativa de receita perdida quem NÃO aparece em nenhum outro lugar da
  // lista do clube — é o sinal forte. Quem aparece em outra turma/horário fica de fora da
  // soma (é caso de revisar cadastro, não de somar como receita perdida).
  const valorEstimadoPerdido = nossosSemCorrespondenciaComValor
    .filter(c => !c.apareceEmOutraTurmaDoClube)
    .reduce((s, c) => s + c.valorEstimado, 0)

  // ---------- Separa tudo por empresa ----------
  function porEmpresa(empresa) {
    const bateramEmp = bateram.filter(l => l.empresa === empresa)
    const provaveisEmp = provaveis.filter(l => l.empresa === empresa)
    const semCorrespondenciaEmp = semCorrespondencia.filter(l => l.empresa === empresa)
    const todasLinhasEmpresa = [...bateramEmp, ...provaveisEmp, ...semCorrespondenciaEmp]
    const nossosSemCorrespondenciaEmpresa = nossosSemCorrespondenciaComValor.filter(c => c.empresa === empresa)

    const porModalidadeMap = {}
    todasLinhasEmpresa.forEach(l => {
      if (!porModalidadeMap[l.modalidade]) porModalidadeMap[l.modalidade] = { modalidade: l.modalidade, total: 0, semCorrespondencia: 0 }
      porModalidadeMap[l.modalidade].total++
    })
    semCorrespondenciaEmp.forEach(l => { if (porModalidadeMap[l.modalidade]) porModalidadeMap[l.modalidade].semCorrespondencia++ })

    return {
      empresa,
      totalLinhasClube: todasLinhasEmpresa.length,
      totalBateram: bateramEmp.length,
      totalProvaveis: provaveisEmp.length,
      totalSemCorrespondencia: semCorrespondenciaEmp.length,
      valorSemCorrespondencia: semCorrespondenciaEmp.reduce((s, l) => s + l.valor, 0),
      semCorrespondencia: semCorrespondenciaEmp,
      provaveis: provaveisEmp,
      porModalidade: Object.values(porModalidadeMap).sort((a, b) => b.total - a.total),
      nossosSemCorrespondencia: nossosSemCorrespondenciaEmpresa,
      valorEstimadoPerdido: nossosSemCorrespondenciaEmpresa
        .filter(c => !c.apareceEmOutraTurmaDoClube)
        .reduce((s, c) => s + c.valorEstimado, 0),
    }
  }

  return {
    totalClube: linhasClube.length,
    totalBateram: bateram.length,
    totalProvaveis: provaveis.length,
    totalSemCorrespondencia: semCorrespondencia.length,
    valorSemCorrespondencia: semCorrespondencia.reduce((s, l) => s + l.valor, 0),
    bateram,
    provaveis,
    semCorrespondencia,
    nossosSemCorrespondencia: nossosSemCorrespondenciaComValor,
    valorEstimadoPerdido,
    procopio: porEmpresa('procopio'),
    beachArena: porEmpresa('beach_arena'),
  }
}
