import { format, addDays } from 'date-fns'

// Status/cor/progresso da barra de prazo a partir da data-limite real (60 dias contados
// a partir de quando a reposição foi gerada). Barra começa vazia e vai enchendo conforme
// os dias passam; cheia = prazo estourado. Azul normalmente, amarelo com 15 dias ou menos
// restantes, vermelho com 5 dias ou menos (persiste vermelho até o prazo vencer).
export function calcStatusPorPrazo(dataLimite) {
  if (!dataLimite) return { diasRestantes: null, cor: '#3b82f6', progresso: 0, label: '' }
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const limite = new Date(dataLimite + 'T12:00')
  const diasRestantes = Math.round((limite - hoje) / (1000 * 60 * 60 * 24))
  let cor = '#3b82f6'
  if (diasRestantes <= 5) cor = '#ef4444'
  else if (diasRestantes <= 15) cor = '#f59e0b'
  const progresso = Math.min(100, Math.max(0, ((60 - diasRestantes) / 60) * 100))
  const label = diasRestantes <= 0
    ? `+${Math.abs(diasRestantes)}d em atraso`
    : `${diasRestantes}d restantes`
  return { diasRestantes, cor, progresso, label }
}

// Mesmo cálculo, mas a partir da data da falta original (assume janela fixa de 60 dias) —
// usado pelas reposições antigas que não têm `data_limite` gravada no banco (foram criadas
// antes da Fase 2, quando essa coluna não existia).
export function calcReposicaoStatus(dataAula) {
  if (!dataAula) return calcStatusPorPrazo(null)
  const dataLimite = format(addDays(new Date(dataAula + 'T12:00'), 60), 'yyyy-MM-dd')
  return calcStatusPorPrazo(dataLimite)
}
