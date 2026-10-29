import { useEffect, useMemo, useState } from 'react'
import { Check, Clock, Sparkles, User } from 'lucide-react'
import { corNivel, diaCurto, partesNivel, plural } from './regras'

function FotoProfessor({ url, size = 22 }) {
  if (url) return <img src={url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--color-brand-verde-court)', color: 'var(--color-text-dark-secondary)',
    }}><User size={size * 0.6} /></span>
  )
}

// Um horário disponível: faixa lateral na cor do nível, nível em destaque, professor e régua de vagas.
function CardAula({ aula, selecionado, bloqueado, onClick }) {
  const cor = corNivel(aula.nivel)
  const { titulo, sub } = partesNivel(aula.nivel)
  return (
    <button type="button" onClick={() => onClick(aula)} style={{
      position: 'relative', textAlign: 'left', cursor: bloqueado ? 'not-allowed' : 'pointer', width: '100%', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', gap: '8px', borderRadius: '14px', overflow: 'hidden', transition: 'all 0.12s',
      padding: '13px 14px 13px 18px', opacity: bloqueado ? 0.45 : 1,
      backgroundColor: selecionado ? 'color-mix(in srgb, var(--color-action-primary) 9%, var(--color-surface-light-overlay))' : 'var(--color-surface-light-overlay)',
      border: selecionado ? '2px solid var(--color-action-primary)' : '1px solid var(--color-border-light)',
      boxShadow: selecionado ? '0 6px 18px color-mix(in srgb, var(--color-action-primary) 18%, transparent)' : 'none',
    }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', backgroundColor: cor }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '17px', fontWeight: 800, color: 'var(--color-text-light-primary)' }}>
          <Clock size={15} style={{ color: 'var(--color-text-light-muted)' }} />{aula.horario}
        </span>
        {selecionado
          ? <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={15} strokeWidth={3} /></span>
          : <span style={{
              fontSize: '12px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px', whiteSpace: 'nowrap',
              color: aula.vagas === 1 ? 'var(--color-state-warning)' : 'var(--color-state-success)',
              backgroundColor: `color-mix(in srgb, ${aula.vagas === 1 ? 'var(--color-state-warning)' : 'var(--color-state-success)'} 13%, transparent)`,
            }}>{aula.formato === 'individual' ? 'Livre' : plural(aula.vagas, 'vaga', 'vagas')}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px 8px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-light-primary)' }}>{titulo}</span>
        {sub && <span style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)' }}>{sub}</span>}
        {aula.extra && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--color-brand-verde-court)', color: 'var(--color-brand-lima)',
          }}><Sparkles size={11} /> Aula extra</span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: 'var(--color-text-light-secondary)', minWidth: 0 }}>
          <FotoProfessor url={aula.professor_foto} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Prof. {aula.professor}</span>
        </span>
        {aula.formato !== 'individual' && (
          <span style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
            {Array.from({ length: aula.capacidade }, (_, i) => (
              <span key={i} style={{
                width: '14px', height: '5px', borderRadius: '3px',
                backgroundColor: i < aula.ocupadas ? 'var(--color-border-light)' : cor,
              }} />
            ))}
          </span>
        )}
      </div>
    </button>
  )
}

// Próximos 7 dias: faixa de dias no topo (com a quantidade de horários de cada um) e, embaixo,
// os horários do dia escolhido. `podeSelecionar(aula)` devolve '' ou o motivo do bloqueio.
export function GradeReposicao({ aulas, selecionadas, onAlternar, motivoBloqueio }) {
  const dias = useMemo(() => [...new Set(aulas.map(a => a.data_aula))].sort(), [aulas])
  const [dia, setDia] = useState(dias[0])
  useEffect(() => { if (!dias.includes(dia)) setDia(dias[0]) }, [dias, dia])

  const doDia = aulas.filter(a => a.data_aula === dia)
  const selIds = new Set(selecionadas.map(s => s.aula_id))
  const selPorDia = d => selecionadas.filter(s => s.data_aula === d).length

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '14px', WebkitOverflowScrolling: 'touch' }}>
        {dias.map(d => {
          const ativo = d === dia
          const [semana, dm] = diaCurto(d).split(' ')
          const n = aulas.filter(a => a.data_aula === d).length
          return (
            <button key={d} type="button" onClick={() => setDia(d)} style={{
              position: 'relative', flexShrink: 0, minWidth: '72px', padding: '10px 10px 9px', borderRadius: '14px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', transition: 'all 0.12s',
              backgroundColor: ativo ? 'var(--color-brand-verde-court)' : 'var(--color-surface-light-overlay)',
              border: `1px solid ${ativo ? 'var(--color-brand-verde-court)' : 'var(--color-border-light)'}`,
              color: ativo ? 'var(--color-text-dark-primary)' : 'var(--color-text-light-primary)',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ativo ? 'var(--color-brand-lima)' : 'var(--color-text-light-muted)' }}>{semana}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>{dm}</span>
              <span style={{ fontSize: '10.5px', color: ativo ? 'var(--color-text-dark-secondary)' : 'var(--color-text-light-muted)' }}>{plural(n, 'horário', 'horários')}</span>
              {selPorDia(d) > 0 && (
                <span style={{
                  position: 'absolute', top: '-6px', right: '-4px', minWidth: '20px', height: '20px', borderRadius: '999px', fontSize: '11px', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-action-primary)', color: 'var(--color-action-on-primary)',
                }}>{selPorDia(d)}</span>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
        {doDia.map(a => (
          <CardAula key={a.aula_id} aula={a} selecionado={selIds.has(a.aula_id)}
            bloqueado={!selIds.has(a.aula_id) && !!motivoBloqueio(a)} onClick={onAlternar} />
        ))}
      </div>
    </div>
  )
}
