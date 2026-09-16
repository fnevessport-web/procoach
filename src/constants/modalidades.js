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
  'Quadra de Squash': 'Squash',
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

// De 1/8/2026 a 31/8/2026, aula de Tênis em GRUPO com só 1 aluno pagante (ou 100% cortesia —
// zero pagante, só cortesia) virou deficitária pro clube no valor cheio — decisão do
// coordenador foi pagar R$100 fixo nesse caso, em vez do valor normal do professor. A partir de
// 1/9/2026 essa regra pontual foi substituída pela tabela completa por quantidade (ver
// DATA_INICIO_TABELA_VALOR_POR_QTD mais abaixo) — as duas constantes abaixo ficam só pra aulas
// desse mês específico não serem recalculadas com a regra nova (histórico já fechado).
export const DATA_INICIO_REGRA_VALOR_GRUPO_1_ALUNO = '2026-08-01'
export const VALOR_AULA_GRUPO_1_ALUNO = 100

// A partir de 1/9/2026: aula de Tênis em GRUPO (Procópio, qualquer professor) ou Padel em GRUPO
// (só o Marcelo Villalobo Faria — ver PROFESSOR_ID_PADEL_REGRA_VALOR_GRUPO_1_ALUNO) passa a pagar
// um valor fixo por quantidade de alunos PAGANTES (cortesia e reposição nunca contam, ver
// qtdAlunosPagantes) em vez do valor cheio cadastrado do professor. 5+ alunos usa o mesmo valor de
// 4 (grupo não passa disso na prática, mas por segurança não fica sem valor se acontecer). Aula
// com gente mas 0 pagante (só cortesia e/ou só reposição) cai no valor do tier de 1 aluno — é o
// próprio clamp de valorGrupoPorQtd fazendo isso, sem checagem extra.
export const DATA_INICIO_TABELA_VALOR_POR_QTD = '2026-09-01'
const TABELA_VALOR_GRUPO_POR_QTD = { 1: 80, 2: 100, 3: 120, 4: 140 }
function valorGrupoPorQtd(qtd) {
  return TABELA_VALOR_GRUPO_POR_QTD[Math.min(Math.max(qtd, 1), 4)]
}

const MODALIDADES_REGRA_VALOR_GRUPO_1_ALUNO = ['Tênis', 'Padel']
const PROFESSOR_ID_PADEL_REGRA_VALOR_GRUPO_1_ALUNO = '76dafb8e-a18d-4bb4-9d94-eaab055073a7' // Marcelo Villalobo Faria

// Aula de Tênis (qualquer professor) ou de Padel só do Marcelo — mesmo recorte usado tanto pra
// tabela de valor por quantidade quanto pro pagamento de 50% em cancelamento por chuva (ver
// calcularValorAula), e pra decidir se uma aula cancelada por chuva já nasce paga no momento do
// cancelamento (AulasCoordenador.jsx).
export function emEscopoRegraValorGrupo(aula, professorId) {
  const modalidade = getModalidadeDaAula(aula)
  if (!MODALIDADES_REGRA_VALOR_GRUPO_1_ALUNO.includes(modalidade)) return false
  if (modalidade === 'Padel' && professorId !== PROFESSOR_ID_PADEL_REGRA_VALOR_GRUPO_1_ALUNO) return false
  return true
}

// Valor cheio configurado pro professor (valor_aula, ou valor_aula_beach se a aula for
// na Beach Arena e esse campo estiver preenchido) — mesma regra usada nos 3 lugares que
// hoje calculam ganho de professor (Financeiro, Dashboard do Professor, Cadastros).
export function valorCheioProfessor(professor, empresa) {
  const valorBase = Number(professor?.valor_aula || professor?.valor_hora_aula || 0)
  return empresa === 'beach_arena' && professor?.valor_aula_beach
    ? Number(professor.valor_aula_beach)
    : valorBase
}

// Quantos alunos "pagantes" (não-cortesia, não-reposição) estão na lista de presença
// dessa aula — cortesia nunca é cobrada do cliente, e reposição é aluno de outra turma
// cobrindo aula perdida (também não gera cobrança extra nessa aula), então nenhum dos
// dois pode contar pra decidir se a turma em grupo "lotou" ou ficou só com 1 aluno de
// verdade. Sem esse filtro, uma turma com 1 mensalista + 1 reposição contava como "2
// alunos" e pagava o valor cheio ao professor em vez do R$100 fixo — foi a causa dos
// professores pagos a mais em fechamentos passados.
export function qtdAlunosPagantes(aula) {
  return (aula.presencas || []).filter(p => p.tipo_participacao !== 'cortesia' && p.tipo_participacao !== 'reposicao').length
}

// Aula 100% cortesia: teve gente na lista de presença, mas ninguém pagante — só cortesia
// (e opcionalmente reposição, que também não gera cobrança). Usado pra estender o R$100
// fixo (ver VALOR_AULA_GRUPO_1_ALUNO) também pra esse caso.
function ehAulaTodaCortesia(aula) {
  const presencas = aula.presencas || []
  if (presencas.length === 0) return false
  return qtdAlunosPagantes(aula) === 0 && presencas.some(p => p.tipo_participacao === 'cortesia')
}

// Aula "zerada": tinha presença registrada (alguém previsto pra estar lá — mensalista,
// avulso, reposição ou cortesia) mas NENHUM compareceu, e mesmo assim o professor é pago
// normalmente (falta de aluno não é falta do professor). Conta qualquer tipo de
// participação, não só pagante — aqui o que importa é se alguém de fato apareceu, não
// quem seria cobrado por isso. Se só 1 dos vários faltou mas outro veio, não conta (a
// aula rolou). Aula sem NENHUMA presença registrada (turma que nunca teve ninguém
// marcado) fica de fora — isso é "aulasSemAluno" (outra métrica, ver useRelatorioMensal.js).
export function aulaComTodosAusentes(aula) {
  const presencas = aula.presencas || []
  return presencas.length > 0 && presencas.every(p => p.status_presenca !== 'presente')
}

// Valor que o professor recebe por essa aula específica.
// - Turma marcada como especial de reposição (eh_turma_reposicao): 50% da tabela por
//   quantidade, contando TODOS os alunos não-cortesia (aqui reposição CONTA pra quantidade —
//   ao contrário do resto da regra, é o próprio propósito dessa turma). Cancelada não paga
//   nada, qualquer que seja o motivo.
// - Fora do escopo (outra modalidade, ou Padel de professor que não o Marcelo), ou aula
//   individual: sempre o valor cheio cadastrado do professor, sem mudança nenhuma.
// - Grupo dentro do escopo, a partir de DATA_INICIO_TABELA_VALOR_POR_QTD: valor fixo pela
//   tabela por quantidade de pagantes (valorGrupoPorQtd).
// - Grupo dentro do escopo, entre DATA_INICIO_REGRA_VALOR_GRUPO_1_ALUNO e a data acima: regra
//   antiga (R$100 fixo só no caso de sobrar 1 pagante, ou zero pagante com alguma cortesia).
// - Cancelada por Chuva dentro do escopo: 50% do valor que a aula pagaria se não tivesse sido
//   cancelada. Cancelada por qualquer outro motivo (ou chuva fora do escopo): zero.
export function calcularValorAula(aula, professor, empresa) {
  // Aula sem NENHUM aluno vinculado (nem presente, nem falta, nem cortesia — a lista de
  // presença veio vazia) não conta como aula dada pra fim de pagamento, mesmo que
  // status_aula/paga_professor digam o contrário no banco — decisão explícita do
  // coordenador: aula sem aluno nenhum é aula que não teve, não gera custo. Diferente de
  // aulaComTodosAusentes() (que É paga: lá tinha gente esperada e todo mundo faltou).
  if ((aula.presencas || []).length === 0) return 0

  if (aula.turmas?.eh_turma_reposicao) {
    if (aula.status_aula === 'cancelada') return 0
    const qtd = aula.presencas.filter(p => p.tipo_participacao !== 'cortesia').length
    return qtd > 0 ? valorGrupoPorQtd(qtd) * 0.5 : 0
  }

  const valorCheio = valorCheioProfessor(professor, empresa)
  const emEscopo = emEscopoRegraValorGrupo(aula, professor?.id)

  let valorNormal
  if (!emEscopo || isAulaIndividual(aula) || !aula.data_aula || aula.data_aula < DATA_INICIO_REGRA_VALOR_GRUPO_1_ALUNO) {
    valorNormal = valorCheio
  } else if (aula.data_aula < DATA_INICIO_TABELA_VALOR_POR_QTD) {
    valorNormal = (qtdAlunosPagantes(aula) === 1 || ehAulaTodaCortesia(aula)) ? VALOR_AULA_GRUPO_1_ALUNO : valorCheio
  } else {
    valorNormal = valorGrupoPorQtd(qtdAlunosPagantes(aula))
  }

  if (aula.status_aula === 'cancelada') {
    return aula.motivo_cancelamento === 'Chuva' && emEscopo ? valorNormal * 0.5 : 0
  }
  return valorNormal
}

// ──────────────────────────────────────────────────────────────────────
// Margem por aula (receita da mensalidade − repasse ao clube − custo do professor)
//
// Uso interno do coordenador só — visão de "quanto essa aula rendeu de verdade",
// nunca exposta ao professor (nem no painel dele, nem no financeiro dele). Escopo
// deliberadamente restrito a Tênis/Procópio (única unidade com esses valores de
// mensalidade confirmados); Beach Arena e outras modalidades não entram aqui —
// margemAula() retorna null nesses casos, e quem chama trata null como "sem dado".
//
// Mensalista paga um plano MENSAL fixo (419/683/1049), não por aula — o valor de
// cada aula específica é o plano dividido pela quantidade de aulas daquele "combo
// de dias" no mês (ex.: plano 2x/semana em turma de segunda vale 683 ÷ (nº de
// segundas + nº de quartas no mês), porque é assim que o aluno escolheu os 2 dias
// fixos dele). Avulso paga por aula à parte (não é fração de mês, é valor cheio
// direto). Reposição e cortesia não geram receita nova nessa aula (reposição já
// foi paga na aula original perdida; cortesia é de graça).
export const VALOR_MENSALIDADE_GRUPO_1X = 419
export const VALOR_MENSALIDADE_GRUPO_2X = 683
export const VALOR_MENSALIDADE_INDIVIDUAL = 1049
export const VALOR_AVULSO_INDIVIDUAL = 320
export const VALOR_AVULSO_GRUPO = 150
export const PCT_REPASSE_CLUBE = 0.10

// Segunda+quarta e terça+quinta são os dois "combos" de plano 2x/semana; sexta e
// sábado (e qualquer outro dia solto) são 1x/semana isolado — mesma classificação
// pro valor do plano e pro divisor de quantas aulas esse combo teve no mês.
function combo2xDoDia(diaSemana) {
  if (diaSemana === 'segunda' || diaSemana === 'quarta') return ['segunda', 'quarta']
  if (diaSemana === 'terca' || diaSemana === 'quinta') return ['terca', 'quinta']
  return null
}

function valorPlanoMensal(individual, diaSemana) {
  if (individual) return VALOR_MENSALIDADE_INDIVIDUAL
  return combo2xDoDia(diaSemana) ? VALOR_MENSALIDADE_GRUPO_2X : VALOR_MENSALIDADE_GRUPO_1X
}

// Estima o valor de UMA mensalidade de Tênis (não soma nem ajusta por quantos ciclos de
// cobrança o período coberto tem — é o valor de 1 mês só) a partir dos dias da semana em
// que o aluno teve presença. Usado no relatório de "alunos sem cobrança do clube", pra dar
// uma noção de quanto cada um representaria — não confundir com receitaAula/margemAula
// acima, que rateiam o plano por aula dentro de um mês fechado; aqui é o valor cheio do
// plano, porque o uso é "quanto essa mensalidade vale", não "quanto essa aula específica
// rendeu". Retorna null quando os dias não formam um padrão limpo de plano 1x/2x (ex.:
// aparece em 3+ dias da semana diferentes, sinal de dado ambíguo) — melhor não estimar do
// que estimar errado.
export function estimarMensalidadeTenis(individual, diasSemana) {
  if (individual) return VALOR_MENSALIDADE_INDIVIDUAL
  const dias = [...diasSemana]
  if (dias.length === 1) return VALOR_MENSALIDADE_GRUPO_1X
  if (dias.length === 2) {
    const combo = combo2xDoDia(dias[0])
    if (combo && dias.every(d => combo.includes(d))) return VALOR_MENSALIDADE_GRUPO_2X
  }
  return null
}

// Quantas aulas desse "combo de dias" caem no mês — pra individual é só o próprio
// dia (sempre tratado como 1x/semana, mesmo que o mesmo aluno tenha outro horário
// individual em outro dia, ver instrução do coordenador).
function divisorMensalidade(individual, diaSemana, contagemMes) {
  if (individual) return contagemMes[diaSemana] || 1
  const combo = combo2xDoDia(diaSemana)
  if (combo) return combo.reduce((s, d) => s + (contagemMes[d] || 0), 0) || 1
  return contagemMes[diaSemana] || 1
}

// Receita bruta dessa aula específica (antes do repasse ao clube) — soma a fração
// do plano mensal de cada mensalista presente na lista + o valor cheio de cada
// avulso. `contagemMes` é o resultado de contarOcorrenciasPorDiaSemana pro mês
// (calendário inteiro, não o período filtrado na tela) em que a aula caiu.
function receitaAula(aula, contagemMes) {
  if (getModalidadeDaAula(aula) !== 'Tênis') return null
  const individual = isAulaIndividual(aula)
  const diaSemana = diaSemanaDaData(aula.data_aula)
  const presencas = aula.presencas || []
  const qtdMensalistas = presencas.filter(p => p.tipo_participacao === 'mensalista').length
  const qtdAvulsos = presencas.filter(p => p.tipo_participacao === 'avulso').length
  const valorFracaoMensalista = valorPlanoMensal(individual, diaSemana) / divisorMensalidade(individual, diaSemana, contagemMes)
  const valorAvulso = individual ? VALOR_AVULSO_INDIVIDUAL : VALOR_AVULSO_GRUPO
  return qtdMensalistas * valorFracaoMensalista + qtdAvulsos * valorAvulso
}

// Detalhamento completo da conta (receita/repasse/custo/margem) dessa aula específica —
// null quando a aula está fora do escopo (não é Tênis), quem chama trata como "sem dado".
export function detalharMargemAula(aula, professor, empresa, contagemMes) {
  const receita = receitaAula(aula, contagemMes)
  if (receita == null) return null
  const repasseClube = receita * PCT_REPASSE_CLUBE
  const custoProfessor = calcularValorAula(aula, professor, empresa)
  return { receita, repasseClube, custoProfessor, margem: receita - repasseClube - custoProfessor }
}

// Margem líquida dessa aula pro clube: receita − 10% de repasse − custo do professor
// (custo já usa calcularValorAula, então já reflete a regra do R$100/grupo-1-aluno).
// null quando a aula está fora do escopo (não é Tênis) — quem chama trata como "sem dado".
export function margemAula(aula, professor, empresa, contagemMes) {
  return detalharMargemAula(aula, professor, empresa, contagemMes)?.margem ?? null
}

// Calcula a margem de uma lista de aulas de uma vez, agrupando o divisor mensal por
// mês-calendário de cada aula (uma lista pode cobrir vários meses, ex.: histórico
// completo do professor) — evita recalcular contarOcorrenciasPorDiaSemana repetido
// pra aulas do mesmo mês. Retorna o total somado e a margem individual por aula
// (por id), pra quem chama poder mostrar tanto o resumo quanto o detalhe por aula.
export function calcularMargensTenis(aulas, professor, empresa) {
  const contagemPorMes = {}
  function contagemDoMes(dataStr) {
    const mesKey = dataStr.slice(0, 7)
    if (!contagemPorMes[mesKey]) {
      const [ano, mes] = mesKey.split('-').map(Number)
      const ultimoDia = new Date(ano, mes, 0).getDate()
      contagemPorMes[mesKey] = contarOcorrenciasPorDiaSemana(`${mesKey}-01`, `${mesKey}-${String(ultimoDia).padStart(2, '0')}`)
    }
    return contagemPorMes[mesKey]
  }
  const porAula = {}
  let total = 0
  ;(aulas || []).forEach(aula => {
    if (!aula.data_aula) return
    const margem = margemAula(aula, professor, empresa, contagemDoMes(aula.data_aula))
    if (margem == null) return
    porAula[aula.id] = margem
    total += margem
  })
  return { porAula, total }
}

// Mesma ideia de calcularMargensTenis, mas devolvendo o detalhamento completo (receita,
// repasse, custo, margem) por aula em vez de só a margem — usado pelo Relatório de Margem
// (uso interno), que precisa mostrar receita e custo separados, não só o líquido.
export function calcularDetalheMargensTenis(aulas, professor, empresa) {
  const contagemPorMes = {}
  function contagemDoMes(dataStr) {
    const mesKey = dataStr.slice(0, 7)
    if (!contagemPorMes[mesKey]) {
      const [ano, mes] = mesKey.split('-').map(Number)
      const ultimoDia = new Date(ano, mes, 0).getDate()
      contagemPorMes[mesKey] = contarOcorrenciasPorDiaSemana(`${mesKey}-01`, `${mesKey}-${String(ultimoDia).padStart(2, '0')}`)
    }
    return contagemPorMes[mesKey]
  }
  const porAula = {}
  ;(aulas || []).forEach(aula => {
    if (!aula.data_aula) return
    const detalhe = detalharMargemAula(aula, professor, empresa, contagemDoMes(aula.data_aula))
    if (detalhe == null) return
    porAula[aula.id] = detalhe
  })
  return porAula
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
