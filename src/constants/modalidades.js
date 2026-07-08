export const ICONES_MODALIDADES = {
  'Tênis':          '/images/tenis.png',
  'Padel':          '/images/padel.png',
  'Pickleball':     '/images/pickleball.png',
  'Squash':         '/images/squash.png',
  'Beach Tennis':   '/images/beachtennis.png',
  'Futevôlei':      '/images/futevolei.png',
  'Vôlei de Praia': '/images/voleidepraia.png',
}

export const LOGO_EMPRESA = {
  procopio: '/images/logoprocopio.png',
  beach_arena: '/images/logobeacharena.png',
}

export const MODALIDADE_EMPRESA = {
  'Tênis': 'procopio',
  'Padel': 'procopio',
  'Squash': 'procopio',
  'Pickleball': 'procopio',
  'Beach Tennis': 'beach_arena',
  'Futevôlei': 'beach_arena',
  'Vôlei de Praia': 'beach_arena',
}

export const EMPRESAS = [
  { valor: 'procopio', label: 'Procópio' },
  { valor: 'beach_arena', label: 'Beach Arena' },
]

export const QUADRA_MODALIDADE = {
  'Quadra 1': 'Tênis', 'Quadra 2': 'Tênis', 'Quadra 3': 'Tênis', 'Quadra 4': 'Tênis',
  'Quadra de Padel': 'Padel',
  'Quadra 1 Areia': 'Beach Tennis',
  'Quadra 3 Areia': 'Futevôlei',
  'Quadra 5 Areia': 'Vôlei de Praia',
}

// Aulas avulsas guardam quadra/horario/nivel na string "⚡ Avulsa · quadra · HH:MM · nivel"
export function parseObservacoes(obs) {
  if (!obs) return { quadra: '', horario: '', nivel: '' }
  const partes = obs.split('·').map(s => s.trim())
  return { quadra: partes[1] || '', horario: partes[2] || '', nivel: partes[3] || '' }
}

export function getQuadraNome(aula) {
  if (aula.turma_id) return aula.turmas?.quadras?.nome || ''
  return parseObservacoes(aula.observacoes).quadra
}

// Turma-linked usa a modalidade cadastrada na turma; avulsa infere pela quadra
export function getModalidadeDaAula(aula) {
  if (aula.turma_id) return aula.turmas?.modalidades?.nome || ''
  return QUADRA_MODALIDADE[getQuadraNome(aula)] || ''
}

export function horarioParaMinutos(hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

// Avulsas não têm turma vinculada — horário vem da observação "⚡ Avulsa · quadra · HH:MM · nivel"
export function horarioInicioDaAula(aula) {
  if (aula.turma_id) return aula.turmas?.horario_inicio || null
  return parseObservacoes(aula.observacoes).horario || null
}

// Avulsas ocupam 1 slot de 1h na grade, então assumimos 60min de duração
export function horarioFimDaAula(aula) {
  if (aula.turma_id) return aula.turmas?.horario_fim || null
  const inicio = horarioParaMinutos(horarioInicioDaAula(aula))
  if (inicio == null) return null
  const fim = inicio + 60
  return `${String(Math.floor(fim / 60)).padStart(2, '0')}:${String(fim % 60).padStart(2, '0')}`
}

const DIAS_SEMANA_POR_INDICE = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

// Dia da semana pela data real da aula — funciona tanto pra turma quanto pra avulsa
export function diaSemanaDaData(dataStr) {
  const [ano, mes, dia] = dataStr.split('-').map(Number)
  return DIAS_SEMANA_POR_INDICE[new Date(ano, mes - 1, dia).getDay()]
}

export const DIAS_HEATMAP = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

// Mesma convenção usada no painel do professor (DashboardProfessor.jsx): turma
// individual lota com 1 aluno, turma em grupo lota com 4 — não existe coluna de
// capacidade no banco, é regra fixa do produto.
export const VAGAS_INDIVIDUAL = 1
export const VAGAS_GRUPO = 4

// Aula em turma: individual é um nível específico ("Individual") — mesma convenção
// já usada em DashboardProfessor.jsx. Aula avulsa: o nível vem como texto livre na
// observação, então checamos o mesmo valor por convenção.
export function isAulaIndividual(aula) {
  if (aula.turma_id) return aula.turmas?.niveis?.nome === 'Individual'
  return parseObservacoes(aula.observacoes).nivel === 'Individual'
}

// Quantas vezes cada dia da semana ocorre dentro do período — é o denominador da
// média (ex.: "somar as 5 segundas-feiras e dividir por 5"). Usar sempre o fim do
// período até "hoje" (não o fim do mês) quando o mês ainda está em andamento deixa
// essa média automaticamente mais precisa conforme os dias passam, sem precisar
// recalcular nada na mão.
export function contarOcorrenciasPorDiaSemana(periodoInicio, periodoFim) {
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

// Mapa de calor de ocupação (inscritos/vagas) por dia da semana x horário, pra uma
// modalidade — segunda a sábado.
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
//
// `dias`/`horas` retornam só as combinações com dado (pra grades compactas, tipo o
// PDF do Relatório Mensal); `celulas` sempre tem uma entrada por dia da semana
// fixo (DIAS_HEATMAP), pra grades fixas — tipo a tela de Modalidade — poderem
// indexar qualquer dia direto sem checar existência antes.
export function construirHeatmapOcupacao(aulas, periodoInicio, periodoFim, nomeModalidade) {
  const porDataHora = {}
  aulas.forEach(a => {
    if (getModalidadeDaAula(a) !== nomeModalidade) return
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

  const diasComDados = DIAS_HEATMAP.filter(d =>
    Object.keys(baldes).some(chave => chave.startsWith(`${d}_`))
  )
  const horasSet = new Set()
  Object.keys(baldes).forEach(chave => horasSet.add(chave.split('_')[1]))
  const horas = Array.from(horasSet).sort()

  const celulas = {}
  DIAS_HEATMAP.forEach(d => {
    celulas[d] = {}
    const denom = contagemDiaSemana[d] || 1
    Object.keys(baldes).filter(chave => chave.startsWith(`${d}_`)).forEach(chave => {
      const hora = chave.split('_')[1]
      const b = baldes[chave]
      const mediaVagas = b.somaVagas / denom
      celulas[d][hora] = {
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
