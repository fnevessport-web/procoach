import { addHours, format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const MAX_REPOSICOES = 2

export const WHATSAPP_EXIBIDO = '+55 11 96913-0246'
export const WHATSAPP_LINK = 'https://wa.me/5511969130246?text=' +
  encodeURIComponent('Olá! Fiz o agendamento de aulas extras pelo link e gostaria de falar com a Procopio.')
export const WHATSAPP_LINK_GRADE_REGULAR = 'https://wa.me/5511969130246?text=' +
  encodeURIComponent('Olá! Gostaria de agendar uma reposição em uma turma da grade regular, conforme a disponibilidade de vagas.')
export const WHATSAPP_LINK_SEM_HORARIO = 'https://wa.me/5511969130246?text=' +
  encodeURIComponent('Olá! Nenhum horário de reposição me atendeu. Gostaria de verificar os horários da grade regular para repor as minhas aulas.')

export const DIAS = [
  { key: 'seg', label: 'SEG' }, { key: 'ter', label: 'TER' }, { key: 'qua', label: 'QUA' },
  { key: 'qui', label: 'QUI' }, { key: 'sex', label: 'SEX' }, { key: 'sab', label: 'SÁB' },
]
const DOW_POR_DIA = { seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 0 }

// Das 6h às 21h, igual à grade de disponibilidade dos professores.
export const HORARIOS = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

// Mesma lista de níveis do cadastro de alunos (AlunosPage/AvaliarAluno).
export const NIVEIS_ADULTO = ['Iniciante 1', 'Iniciante 2', 'Intermediário 1', 'Intermediário 2', 'Avançado']
export const NIVEIS_KIDS = ['Kids Iniciante', 'Kids Intermediário', 'Kids Avançado']

// Ícones são traços brancos — sempre exibidos sobre fundo verde-court.
export const MODALIDADES_PRESENTE = [
  { nome: 'Beach Tennis', img: '/images/beachtennis.png' },
  { nome: 'Futevôlei', img: '/images/futevolei.png' },
  { nome: 'Vôlei de Praia', img: '/images/voleidepraia.png' },
  { nome: 'Squash', img: '/images/squash.png' },
  { nome: 'Padel', img: '/images/padel.png' },
]
export const IMG_MODALIDADE = Object.fromEntries(MODALIDADES_PRESENTE.map(m => [m.nome, m.img]))
IMG_MODALIDADE['Tênis'] = '/images/tenis.png'

export const TURMA_VAZIA = { dias: [], horario: '', formato: '', nivel: '' }

// Regra de elegibilidade da reposição: quem faz só Grupo repõe só em Grupo; quem faz Individual
// (sozinho ou junto com Grupo) pode repor em Individual ou Grupo. O servidor confere a mesma regra.
export const fazIndividual = turmas => turmas.some(t => t.formato === 'individual')
export const fazGrupo = turmas => turmas.some(t => t.formato === 'grupo')

// Aluno que faz SÓ aula individual e escolheu uma aula em grupo: está gastando o crédito de aula
// individual numa aula em grupo — precisa concordar explicitamente (tela de confirmação).
// Quem faz Individual E Grupo não entra aqui (tem crédito de grupo pra usar).
export const usaCreditoIndividualEmGrupo = (turmas, slot) =>
  slot.formato === 'grupo' && fazIndividual(turmas) && !fazGrupo(turmas)

// ---- datas/horas -------------------------------------------------------------------------

export function dataDoSlot(slot) {
  return parse(slot.data_aula, 'yyyy-MM-dd', new Date())
}

export function rotuloDiaCurto(dataStr) {
  return format(parse(dataStr, 'yyyy-MM-dd', new Date()), "EEE dd/MM", { locale: ptBR }).replace('.', '')
}

export function rotuloDiaLongo(dataStr) {
  const t = format(parse(dataStr, 'yyyy-MM-dd', new Date()), "EEEE, dd 'de' MMMM", { locale: ptBR })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export const hora = h => (h ? h.slice(0, 5) : '')

// Cronológico (data, depois horário) — a ordem em que a pessoa vai comparecer, não a ordem em
// que clicou.
export const ordenarSlots = slots =>
  [...slots].sort((a, b) => `${a.data_aula} ${a.horario_inicio}`.localeCompare(`${b.data_aula} ${b.horario_inicio}`))

export function faixaHorario(slot) {
  return slot.horario_fim ? `${hora(slot.horario_inicio)} às ${hora(slot.horario_fim)}` : hora(slot.horario_inicio)
}

// ---- rótulos de exibição -------------------------------------------------------------------

// Nível/turma como aparece pro aluno. Kids/Juvenil ganham prefixo "Kids ·" (a não ser que o
// próprio texto já diga Kids/Juvenil); aula individual sem nível vira só "Individual".
export function rotuloNivel(slot) {
  const n = (slot.nivel || '').trim()
  if (slot.publico === 'kids') return !n ? 'Kids' : /^(juvenil|kids)/i.test(n) ? n : `Kids · ${n}`
  if (n) return n
  return slot.formato === 'individual' ? 'Individual' : ''
}

// Professor "a definir" (planilha do Tênis) não leva o "Prof." na frente.
const ehADefinir = p => /^a definir$/i.test((p || '').trim())
export const nomeProfessor = p => (!p ? '' : ehADefinir(p) ? 'Professor a definir' : p)
export const rotuloProfessor = p => (!p ? '' : ehADefinir(p) ? 'Professor a definir' : `Prof. ${p}`)

// Mapa curado "nome curto usado na grade extra" -> "nome completo cadastrado em professores",
// só pra achar a foto certa. Curado à mão (não é fuzzy-match automático) porque tem professor
// homônimo no cadastro (3 "Bruno", 2 "Marcelo" — um de Tênis, outro só de Padel) que um match
// automático por nome pegaria errado. Atualizar aqui quando um professor novo entrar na grade.
export const MAPA_PROFESSOR_FOTO = {
  'eric': 'Eric Jun Domiciano Higashi',
  'nayara': 'Nayara Santos',
  'joao': 'João Vitor Martins de França',
  'tiago guedes': 'Tiago Guedes',
  'charles': 'Charles de Melo Silva',
  'marcelo': 'Marcelo Ribeiro Rocha', // o de Tênis — tem outro Marcelo que é só de Padel
  'bruno borges': 'Bruno Borges da Silva', // tem mais 2 "Bruno" no cadastro
}
function normalizarTexto(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
}
// `professores` é a lista { id, nome, foto_url } já carregada (view pública ou tabela, conforme
// o contexto) — devolve null se não achar mapeamento ou foto, pra quem chama cair na silhueta.
export function fotoProfessor(p, professores) {
  if (!p || ehADefinir(p)) return null
  const nomeCompleto = MAPA_PROFESSOR_FOTO[normalizarTexto(p)]
  if (!nomeCompleto) return null
  return (professores || []).find(x => x.nome === nomeCompleto)?.foto_url || null
}

// ---- vagas -------------------------------------------------------------------------------

// Verde com folga, âmbar quando está acabando (≤ 1/3 das vagas), vermelho quando lotou.
export function estadoVagas(slot) {
  if (slot.vagas_restantes <= 0) return { chave: 'lotado', cor: 'var(--color-state-danger)', texto: 'Lotado' }
  const escasso = slot.vagas_restantes <= Math.max(1, Math.floor(slot.capacidade / 3))
  const n = slot.vagas_restantes
  return {
    chave: escasso ? 'poucas' : 'livre',
    cor: escasso ? 'var(--color-state-warning)' : 'var(--color-state-success)',
    texto: `${n} ${n === 1 ? 'vaga' : 'vagas'}`,
  }
}

// ---- choque de horário -------------------------------------------------------------------
// Aula sem horario_fim conta como 1h. Turma atual é semanal: choca se o dia da semana da aula
// extra está entre os dias da turma e o horário se sobrepõe (turma = 1h a partir do horário).

function intervaloSlot(slot) {
  const ini = parse(`${slot.data_aula} ${hora(slot.horario_inicio)}`, 'yyyy-MM-dd HH:mm', new Date())
  const fim = slot.horario_fim
    ? parse(`${slot.data_aula} ${hora(slot.horario_fim)}`, 'yyyy-MM-dd HH:mm', new Date())
    : addHours(ini, 1)
  return [ini, fim]
}

// Retorna { texto } descrevendo com o que a aula choca, ou null. `outros` = slots já escolhidos
// (reposição + presente) que não sejam o próprio slot testado.
export function encontrarConflito(slot, { turmas = [], outros = [] }) {
  const [ini, fim] = intervaloSlot(slot)

  for (const o of outros) {
    if (o.slot_id === slot.slot_id) continue
    const [oIni, oFim] = intervaloSlot(o)
    if (oIni < fim && ini < oFim) {
      return {
        texto: `Você já tem uma aula de ${o.modalidade} agendada em ${rotuloDiaCurto(o.data_aula)} às ${hora(o.horario_inicio)}, e não dá para estar em dois lugares ao mesmo tempo.`,
      }
    }
  }

  const dow = ini.getDay()
  for (const t of turmas) {
    if (!t.horario || !t.dias?.some(d => DOW_POR_DIA[d] === dow)) continue
    const ti = parse(`${slot.data_aula} ${t.horario}`, 'yyyy-MM-dd HH:mm', new Date())
    if (ti < fim && ini < addHours(ti, 1)) {
      return { texto: `Esse horário coincide com a sua aula atual de ${rotuloDiaCurto(slot.data_aula).split(' ')[0]} às ${t.horario}.` }
    }
  }
  return null
}

// ---- textos ------------------------------------------------------------------------------

export const TEXTO_DECLARACAO =
  'Declaro que as informações que preenchi são verdadeiras. Estou ciente de que a Procopio, ' +
  'como empresa operadora, irá conferir todos os agendamentos e poderá entrar em contato caso ' +
  'seja necessário ajustar algum horário.'

// ---- estilo compartilhado -----------------------------------------------------------------

// Kids = lima (com texto verde-court); adulto = azul-petróleo (state-info). A legenda da tela de
// cadastro usa exatamente estas duas cores.
export const COR_ADULTO = 'var(--color-state-info)'
export const COR_KIDS = 'var(--color-brand-lima)'

export const estiloInput = {
  width: '100%', padding: '12px 14px', borderRadius: '10px', boxSizing: 'border-box', fontSize: '15px', outline: 'none',
  backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-light-primary)',
}
