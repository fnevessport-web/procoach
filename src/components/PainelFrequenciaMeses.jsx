import { useState } from 'react'
import { addMonths, endOfMonth, format, getDay, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X } from 'lucide-react'

// Frequência do aluno no mês anterior + mês atual (em novembro mostra outubro e novembro).
// Usado no link público de reposição e na ficha do aluno — por isso usa os aliases genéricos
// de tema só onde precisa e, no resto, tokens -light-* (as duas telas são do contexto Claro).
//
// `frequencia`: [{ data: 'yyyy-MM-dd', status: 'presente'|'falta'|'falta_justificada'|'chuva'|'cancelada'|'agendada',
//                  horario?, nivel?, professor?, motivo?, tipo? }]
// A legenda junta tudo em 3 grupos (pedido do cliente): falta avisada conta como falta e qualquer
// cancelamento como "cancelada". O detalhe (chuva, falta avisada, professor) fica no pop-up do dia.
export const STATUS_FREQ = {
  presente: { rotulo: 'Presenças', cor: 'var(--color-state-success)' },
  falta: { rotulo: 'Faltas', cor: 'var(--color-state-danger)' },
  cancelada: { rotulo: 'Canceladas', cor: 'var(--color-state-info)' },
  agendada: { rotulo: 'Próximas', cor: 'var(--color-border-light)' },
}
const GRUPO = { presente: 'presente', falta: 'falta', falta_justificada: 'falta', chuva: 'cancelada', cancelada: 'cancelada', agendada: 'agendada' }
const grupoDe = s => GRUPO[s] || 'agendada'
const ORDEM = ['presente', 'falta', 'cancelada', 'agendada']
const LEGENDA = ['presente', 'falta', 'cancelada']
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function descricao(i) {
  if (i.status === 'chuva') return { texto: 'Aula cancelada por chuva', cor: STATUS_FREQ.cancelada.cor }
  if (i.status === 'cancelada') return { texto: `Aula cancelada${i.motivo ? ` (${i.motivo.toLowerCase()})` : ''}`, cor: STATUS_FREQ.cancelada.cor }
  if (i.status === 'agendada') return { texto: 'Aula agendada', cor: 'var(--color-text-light-muted)' }
  if (i.status === 'presente') return { texto: 'Aula realizada · aluno presente', cor: STATUS_FREQ.presente.cor }
  return { texto: `Aula realizada · aluno faltou${i.status === 'falta_justificada' ? ' (avisou)' : ''}`, cor: STATUS_FREQ.falta.cor }
}

function PopupDia({ data, itens, onFechar }) {
  const titulo = format(new Date(data + 'T12:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })
  return (
    <div onClick={onFechar} style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      backgroundColor: 'color-mix(in srgb, var(--color-brand-verde-court) 45%, transparent)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: '340px', borderRadius: '18px', padding: '18px', boxSizing: 'border-box',
        backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
        boxShadow: '0 18px 40px color-mix(in srgb, var(--color-brand-verde-court) 25%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-light-primary)', textTransform: 'capitalize' }}>{titulo}</span>
          <button type="button" onClick={onFechar} aria-label="Fechar" style={{
            border: 'none', background: 'none', padding: '4px', cursor: 'pointer', display: 'flex', color: 'var(--color-text-light-muted)',
          }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {itens.map((i, k) => {
            const d = descricao(i)
            return (
              <div key={k} style={{ borderLeft: `3px solid ${d.cor}`, paddingLeft: '10px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-light-primary)' }}>
                  {[i.horario, i.nivel].filter(Boolean).join(' · ') || 'Aula'}
                  {i.tipo === 'reposicao' && <span style={{ fontWeight: 500, color: 'var(--color-text-light-muted)' }}> · reposição</span>}
                </div>
                {i.professor && <div style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>Prof. {i.professor}</div>}
                <div style={{ fontSize: '13px', fontWeight: 600, color: d.cor, marginTop: '2px' }}>{d.texto}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CartaoMes({ inicio, itens, onDia }) {
  const titulo = format(inicio, "MMMM 'de' yyyy", { locale: ptBR })
  const cont = Object.fromEntries(ORDEM.map(k => [k, itens.filter(i => grupoDe(i.status) === k).length]))
  const total = itens.length
  const realizadas = cont.presente + cont.falta
  const pct = realizadas ? Math.round((cont.presente / realizadas) * 100) : null

  const porDia = {}
  itens.forEach(i => { (porDia[i.data] ??= []).push(i) })
  const fim = endOfMonth(inicio)
  const vazios = getDay(inicio)
  const dias = Array.from({ length: fim.getDate() }, (_, i) => format(new Date(inicio.getFullYear(), inicio.getMonth(), i + 1), 'yyyy-MM-dd'))

  return (
    <div style={{
      flex: '1 1 260px', minWidth: 0, borderRadius: '16px', padding: '16px', boxSizing: 'border-box',
      backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 700, color: 'var(--color-text-light-primary)' }}>
          {titulo.charAt(0).toUpperCase() + titulo.slice(1)}
        </span>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
        {LEGENDA.map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: STATUS_FREQ[k].cor, flexShrink: 0 }} />
            <span>{STATUS_FREQ[k].rotulo}</span>
            <strong style={{ color: 'var(--color-text-light-primary)', fontSize: '13px' }}>{cont[k]}</strong>
          </div>
        ))}
      </div>

      {/* Calendário do mês: cada aula vira uma bolinha na cor da situação; dia com aula abre o detalhe */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
        {SEMANA.map((d, i) => <span key={i} style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-light-muted)' }}>{d}</span>)}
        {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} />)}
        {dias.map(d => {
          const st = porDia[d] || []
          const temAula = st.length > 0
          return (
            <div key={d} role={temAula ? 'button' : undefined} onClick={temAula ? () => onDia(d, st) : undefined} style={{
              aspectRatio: '1', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
              backgroundColor: temAula ? 'var(--color-surface-light-raised)' : 'transparent',
              border: temAula ? '1px solid var(--color-border-light)' : '1px solid transparent',
              cursor: temAula ? 'pointer' : 'default',
            }}>
              <span style={{ fontSize: '10.5px', fontWeight: temAula ? 700 : 500, color: temAula ? 'var(--color-text-light-primary)' : 'var(--color-text-light-muted)' }}>
                {Number(d.slice(8))}
              </span>
              {temAula && (
                <span style={{ display: 'flex', gap: '2px' }}>
                  {st.slice(0, 3).map((i, k) => {
                    const g = grupoDe(i.status)
                    return (
                      <span key={k} style={{
                        width: '5px', height: '5px', borderRadius: '50%', backgroundColor: STATUS_FREQ[g].cor,
                        outline: g === 'agendada' ? '1px solid var(--color-text-light-muted)' : 'none',
                      }} />
                    )
                  })}
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
  const [dia, setDia] = useState(null)
  const atual = startOfMonth(hoje)
  const anterior = startOfMonth(addMonths(hoje, -1))
  const doMes = ini => {
    const chave = format(ini, 'yyyy-MM')
    return frequencia.filter(f => (f.data || '').startsWith(chave))
  }
  const abrir = (data, itens) => setDia({ data, itens: [...itens].sort((a, b) => (a.horario || '').localeCompare(b.horario || '')) })
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
      <CartaoMes inicio={anterior} itens={doMes(anterior)} onDia={abrir} />
      <CartaoMes inicio={atual} itens={doMes(atual)} onDia={abrir} />
      {dia && <PopupDia data={dia.data} itens={dia.itens} onFechar={() => setDia(null)} />}
    </div>
  )
}
