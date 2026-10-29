import { addMonths, endOfMonth, format, getDay, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Frequência do aluno no mês anterior + mês atual (em novembro mostra outubro e novembro).
// Usado no link público de reposição e na ficha do aluno — por isso usa os aliases genéricos
// de tema só onde precisa e, no resto, tokens -light-* (as duas telas são do contexto Claro).
//
// `frequencia`: [{ data: 'yyyy-MM-dd', status: 'presente'|'falta'|'falta_justificada'|'chuva'|'cancelada'|'agendada' }]
export const STATUS_FREQ = {
  presente: { rotulo: 'Presenças', cor: 'var(--color-state-success)' },
  falta: { rotulo: 'Faltas', cor: 'var(--color-state-danger)' },
  falta_justificada: { rotulo: 'Faltas avisadas', cor: 'var(--color-state-warning)' },
  chuva: { rotulo: 'Canceladas por chuva', cor: 'var(--color-state-info)' },
  cancelada: { rotulo: 'Canceladas (outros)', cor: 'var(--color-text-light-muted)' },
  agendada: { rotulo: 'Próximas', cor: 'var(--color-border-light)' },
}
const ORDEM = ['presente', 'falta_justificada', 'falta', 'chuva', 'cancelada', 'agendada']
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function CartaoMes({ inicio, itens }) {
  const titulo = format(inicio, "MMMM 'de' yyyy", { locale: ptBR })
  const cont = Object.fromEntries(ORDEM.map(k => [k, itens.filter(i => i.status === k).length]))
  const total = itens.length
  const realizadas = cont.presente + cont.falta + cont.falta_justificada
  const pct = realizadas ? Math.round((cont.presente / realizadas) * 100) : null

  const porDia = {}
  itens.forEach(i => { (porDia[i.data] ??= []).push(i.status) })
  const fim = endOfMonth(inicio)
  const vazios = getDay(inicio)
  const dias = Array.from({ length: fim.getDate() }, (_, i) => format(new Date(inicio.getFullYear(), inicio.getMonth(), i + 1), 'yyyy-MM-dd'))

  return (
    <div style={{
      flex: '1 1 260px', minWidth: 0, borderRadius: '16px', padding: '16px', boxSizing: 'border-box',
      backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 700, textTransform: 'capitalize', color: 'var(--color-text-light-primary)' }}>{titulo}</span>
        {pct != null && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-light-secondary)' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--color-state-success)' }}>{pct}%</span> de presença
          </span>
        )}
      </div>

      {/* Barra empilhada: proporção de cada situação no mês */}
      <div style={{ display: 'flex', height: '8px', borderRadius: '999px', overflow: 'hidden', backgroundColor: 'var(--color-border-light-subtle)', marginBottom: '12px', gap: total ? '2px' : 0 }}>
        {ORDEM.filter(k => cont[k]).map(k => (
          <span key={k} style={{ flex: cont[k], backgroundColor: STATUS_FREQ[k].cor }} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 10px', marginBottom: '14px' }}>
        {ORDEM.filter(k => cont[k] || ['presente', 'falta', 'chuva'].includes(k)).map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: STATUS_FREQ[k].cor, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>{STATUS_FREQ[k].rotulo}</span>
            <strong style={{ color: 'var(--color-text-light-primary)', fontSize: '13px' }}>{cont[k]}</strong>
          </div>
        ))}
      </div>

      {/* Calendário do mês: cada aula vira uma bolinha na cor da situação */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
        {SEMANA.map((d, i) => <span key={i} style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-light-muted)' }}>{d}</span>)}
        {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} />)}
        {dias.map(d => {
          const st = porDia[d] || []
          return (
            <div key={d} style={{
              aspectRatio: '1', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
              backgroundColor: st.length ? 'var(--color-surface-light-raised)' : 'transparent',
              border: st.length ? '1px solid var(--color-border-light)' : '1px solid transparent',
            }}>
              <span style={{ fontSize: '10.5px', fontWeight: st.length ? 700 : 500, color: st.length ? 'var(--color-text-light-primary)' : 'var(--color-text-light-muted)' }}>
                {Number(d.slice(8))}
              </span>
              {st.length > 0 && (
                <span style={{ display: 'flex', gap: '2px' }}>
                  {st.slice(0, 3).map((s, i) => (
                    <span key={i} style={{
                      width: '5px', height: '5px', borderRadius: '50%', backgroundColor: STATUS_FREQ[s]?.cor,
                      outline: s === 'agendada' ? '1px solid var(--color-text-light-muted)' : 'none',
                    }} />
                  ))}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PainelFrequenciaMeses({ frequencia = [], hoje = new Date() }) {
  const atual = startOfMonth(hoje)
  const anterior = startOfMonth(addMonths(hoje, -1))
  const doMes = ini => {
    const chave = format(ini, 'yyyy-MM')
    return frequencia.filter(f => (f.data || '').startsWith(chave))
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
      <CartaoMes inicio={anterior} itens={doMes(anterior)} />
      <CartaoMes inicio={atual} itens={doMes(atual)} />
    </div>
  )
}
