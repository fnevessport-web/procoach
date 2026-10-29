import { format, addDays } from 'date-fns'

// Status/cor/progresso da barra de prazo a partir da data-limite real (30 dias contados
// a partir da aula cancelada, regra do clube desde 29/10/2026; antes eram 60). Barra começa vazia e vai enchendo conforme
// os dias passam; cheia = prazo estourado. Azul normalmente, amarelo com 10 dias ou menos
// restantes, vermelho com 3 dias ou menos (persiste vermelho até o prazo vencer).
const PRAZO = 30

export function calcStatusPorPrazo(dataLimite) {
  if (!dataLimite) return { diasRestantes: null, cor: 'var(--color-state-info)', progresso: 0, label: '' }
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const limite = new Date(dataLimite + 'T12:00')
  const diasRestantes = Math.round((limite - hoje) / (1000 * 60 * 60 * 24))
  let cor = 'var(--color-state-info)'
  if (diasRestantes <= 3) cor = 'var(--color-state-danger)'
  else if (diasRestantes <= 10) cor = 'var(--color-state-warning)'
  const progresso = Math.min(100, Math.max(0, ((PRAZO - diasRestantes) / PRAZO) * 100))
  const label = diasRestantes <= 0
    ? `+${Math.abs(diasRestantes)}d em atraso`
    : `${diasRestantes}d restantes`
  return { diasRestantes, cor, progresso, label }
}

// Mesmo cálculo, mas a partir da data da falta original (assume a janela fixa de 30 dias) —
// usado pelas reposições antigas que não têm `data_limite` gravada no banco (foram criadas
// antes da Fase 2, quando essa coluna não existia).
export function calcReposicaoStatus(dataAula) {
  if (!dataAula) return calcStatusPorPrazo(null)
  const dataLimite = format(addDays(new Date(dataAula + 'T12:00'), PRAZO), 'yyyy-MM-dd')
  return calcStatusPorPrazo(dataLimite)
}
