import { addDays, endOfMonth, format, startOfMonth, subMonths } from 'date-fns'

// Modo demonstração do link (/reposicao?demo=1): aluno fictício montado só na memória do
// navegador, pra equipe ver e validar a visão do aluno. Nada é lido nem gravado no banco.
// Aluno: turma de grupo terça 19h (Intermediário 1) + individual quinta 08h. Qualquer nome
// encontra o aluno; telefone terminado em 9999 entra direto, outro número cai na etapa
// "Seu telefone continua o mesmo?".

export const modoDemo = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')

const ALUNO_ID = 'demo-aluno'
const iso = d => format(d, 'yyyy-MM-dd')
const hoje = new Date()
const HOJE = iso(hoje)

// Aulas fixas do aluno no mês anterior e no atual (terça grupo, quinta individual).
function montarFrequencia() {
  const lista = []
  for (let d = startOfMonth(subMonths(hoje, 1)); d <= endOfMonth(hoje); d = addDays(d, 1)) {
    const dow = d.getDay()
    if (dow !== 2 && dow !== 4) continue
    lista.push({ data: iso(d), horario: dow === 2 ? '19:00' : '08:00', nivel: dow === 2 ? 'Intermediário 1' : 'Individual', tipo: 'mensalista' })
  }
  const passadas = lista.filter(a => a.data < HOJE)
  // Duas chuvas recentes (uma de cada formato) viram os créditos; o resto é presença com
  // algumas faltas pra o painel ficar parecido com o de um aluno de verdade.
  const chuvaGrupo = [...passadas].reverse().find(a => a.nivel !== 'Individual')
  const chuvaInd = [...passadas].reverse().find(a => a.nivel === 'Individual')
  let i = 0
  for (const a of lista) {
    if (a.data >= HOJE) a.status = 'agendada'
    else if (a === chuvaGrupo || a === chuvaInd) a.status = 'chuva'
    else a.status = ['presente', 'presente', 'falta', 'presente', 'presente', 'falta_justificada', 'presente', 'presente'][i++ % 8]
  }
  return { lista, chuvaGrupo, chuvaInd }
}

const { lista: FREQUENCIA, chuvaGrupo, chuvaInd } = montarFrequencia()
const limite = d => iso(addDays(new Date(d + 'T12:00'), 30))

function creditosIniciais() {
  const c = []
  if (chuvaGrupo) c.push({ id: 'demo-c1', data_origem: chuvaGrupo.data, horario_origem: '19:00', formato: 'grupo', nivel_origem: 'Intermediário 1', data_limite: limite(chuvaGrupo.data), historico: [] })
  if (chuvaInd) c.push({ id: 'demo-c2', data_origem: chuvaInd.data, horario_origem: '08:00', formato: 'individual', nivel_origem: 'Individual', data_limite: limite(chuvaInd.data), historico: [] })
  return c
}

// Grade fictícia dos próximos 7 dias: Intermediário 1 e Iniciante 2 (o nível dele e o de baixo),
// individuais livres e uma aula extra no domingo.
const PROFS = ['Douglas', 'Nayara', 'Lucas', 'Marcelo', 'Tiago']
function montarGrade() {
  const aulas = []
  const agora = new Date()
  for (let n = 0; n < 7; n++) {
    const d = addDays(hoje, n)
    const dow = d.getDay()
    const slots = dow === 0
      ? [['09:00', 'Intermediário 1', true], ['10:00', 'Iniciante 2', true]]
      : [['07:00', 'Individual'], ['08:00', 'Iniciante 2'], ['10:00', 'Individual'], ['18:00', 'Intermediário 1'],
         ['19:00', 'Iniciante 2'], ['20:00', 'Intermediário 1'], ['21:00', 'Individual']].filter((_, k) => (k + n) % 3 !== 0)
    slots.forEach(([h, nivel, extra], k) => {
      const inicio = new Date(`${iso(d)}T${h}`)
      if (inicio - agora < 2 * 3600000) return
      const ind = nivel === 'Individual'
      const ocupadas = ind ? 0 : extra ? (k % 2) : 1 + ((n + k) % 3)
      aulas.push({
        aula_id: `demo-${iso(d)}-${h}`, data_aula: iso(d), horario: h, nivel, formato: ind ? 'individual' : 'grupo',
        professor: PROFS[(n + k) % PROFS.length], professor_foto: null,
        capacidade: ind ? 1 : 4, ocupadas, vagas: (ind ? 1 : 4) - ocupadas, extra: !!extra,
      })
    })
  }
  return aulas
}

const estado = { creditos: creditosIniciais(), agendadas: [], grade: montarGrade() }

const painel = () => ({
  ok: true,
  aluno: { id: ALUNO_ID, nome: 'Aluno Demonstração Procopio', menor: false, nivel: 'Intermediário 1' },
  turmas: [
    { dia: 'terca', horario: '19:00', nivel: 'Intermediário 1', professor: 'Douglas' },
    { dia: 'quinta', horario: '08:00', nivel: 'Individual', professor: 'Nayara' },
  ],
  creditos: estado.creditos,
  outros_pendentes: 0,
  agendadas: estado.agendadas,
  frequencia: FREQUENCIA,
})

const esperar = (v, ms = 350) => new Promise(r => setTimeout(() => r(v), ms))

export const demo = {
  identificar: ({ telefone }) => {
    const confere = (telefone || '').endsWith('9999')
    return esperar({ ok: true, telefone_confere: confere, candidatos: [{
      id: ALUNO_ID, nome: 'Aluno Demonstração Procopio', chave: 'demo', telefone_confere: confere,
      telefones: [{ tipo: 'aluno', mascara: '(11) •••••-9999' }],
    }] })
  },
  painel: () => esperar(painel(), 200),
  grade: () => esperar({ ok: true, aulas: estado.grade.filter(a => !estado.agendadas.some(x => x.aula_id === a.aula_id)) }, 200),
  agendar: ({ aulaIds }) => {
    const feitos = []
    for (const id of aulaIds) {
      const a = estado.grade.find(g => g.aula_id === id)
      // Mesma regra do banco: primeiro crédito do mesmo formato; aula de grupo aceita o individual.
      const i = estado.creditos.findIndex(c => c.formato === a.formato)
      const j = i >= 0 ? i : a.formato === 'grupo' ? estado.creditos.findIndex(c => c.formato === 'individual') : -1
      if (j < 0) return esperar({ ok: false, codigo: 'sem_saldo' })
      estado.creditos.splice(j, 1)
      const item = { aula_id: id, data: a.data_aula, horario: a.horario, nivel: a.nivel, professor: a.professor, extra: a.extra }
      estado.agendadas.push(item)
      feitos.push(item)
    }
    return esperar({ ok: true, agendadas: feitos, saldo: estado.creditos.length }, 600)
  },
  ok: () => esperar({ ok: true }),
}
