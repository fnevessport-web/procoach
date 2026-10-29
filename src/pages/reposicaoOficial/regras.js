import { format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const PRAZO_DIAS = 30
export const WHATSAPP_EXIBIDO = '(11) 96913-0246'
const WHATSAPP_NUMERO = '5511969130246'

// Toda saída "fale com a equipe" já leva a mensagem pronta, pra quem atende entender o caso
// de cara sem precisar perguntar de novo.
export const linkWhats = texto => `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`

export const DIAS_SEMANA = [
  { key: 'seg', label: 'SEG' }, { key: 'ter', label: 'TER' }, { key: 'qua', label: 'QUA' },
  { key: 'qui', label: 'QUI' }, { key: 'sex', label: 'SEX' }, { key: 'sab', label: 'SÁB' },
]
export const FAIXAS_HORARIO = [
  { key: '06-09', label: '6h às 9h' }, { key: '09-12', label: '9h às 12h' }, { key: '12-15', label: '12h às 15h' },
  { key: '15-18', label: '15h às 18h' }, { key: '18-22', label: '18h às 22h' },
]

const NOME_DIA = { segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb', domingo: 'Dom' }
const ORDEM_DIA = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']
export const nomeDiaSemana = d => NOME_DIA[d] || d
export const ordenarTurmas = turmas =>
  [...turmas].sort((a, b) => ORDEM_DIA.indexOf(a.dia) - ORDEM_DIA.indexOf(b.dia) || (a.horario || '').localeCompare(b.horario || ''))

const data = s => parse(s, 'yyyy-MM-dd', new Date())
export const dataCurta = s => format(data(s), 'dd/MM')
export const diaCurto = s => format(data(s), 'EEE dd/MM', { locale: ptBR }).replace('.', '')
export function diaLongo(s) {
  const t = format(data(s), "EEEE, dd 'de' MMMM", { locale: ptBR })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

// Cor de cada nível na grade, no mesmo espírito da grade do clube (iniciante verde, intermediário
// âmbar, avançado saibro, individual azul, Kids lima), sempre com os tokens do tema.
export function corNivel(nivel) {
  const n = (nivel || '').trim()
  if (n === 'Individual') return 'var(--color-state-info)'
  if (n.includes('Competitivo')) return 'var(--color-state-danger)'
  if (n.startsWith('Kids')) return 'var(--color-brand-lima)'
  if (n.startsWith('Iniciante')) return 'var(--color-state-success)'
  if (n.startsWith('Intermedi')) return 'var(--color-state-warning)'
  if (n.startsWith('Avan')) return 'var(--color-action-primary)'
  return 'var(--color-text-light-muted)'
}

// "Kids 2 - 7 a 10 anos" → { titulo: 'Kids 2', sub: '7 a 10 anos' }
export function partesNivel(nivel) {
  const n = (nivel || '').trim()
  const i = n.indexOf(' - ')
  return i > 0 ? { titulo: n.slice(0, i), sub: n.slice(i + 3) } : { titulo: n, sub: '' }
}

export const primeiroNome = nome => (nome || '').trim().split(/\s+/)[0] || ''

export function resumoCreditos(creditos) {
  const grupo = creditos.filter(c => c.formato === 'grupo').length
  const individual = creditos.filter(c => c.formato === 'individual').length
  return { grupo, individual, total: grupo + individual }
}
