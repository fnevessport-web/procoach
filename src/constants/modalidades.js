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
