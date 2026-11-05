import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useAulasDoDiaParaRecado } from '../../hooks/useRecados'
import { QUADRAS_EMPRESA } from '../../hooks/useFinanceiro'
import { nomeProfessor } from '../../lib/nomes'
import { Loading } from '../ui/Loading'

// Grade de um dia em quadradinhos (horário x quadra), no mesmo jeito da agenda. Usada no
// recado "sobre turmas": quem envia clica nos quadrados; quem recebe vê a grade completa com
// os quadrados do recado em destaque. Sempre em tokens claros (é um "pedaço da agenda"),
// mesmo dentro de tela escura.
const ORDEM_QUADRAS = [...QUADRAS_EMPRESA.procopio, ...QUADRAS_EMPRESA.beach_arena]

export function GradeRecado({ data, selecionadas = [], onToggle, somenteSelecionadasNoFiltro = false }) {
  const { data: aulas = [], isLoading } = useAulasDoDiaParaRecado(data)
  const idsSel = useMemo(() => new Set(selecionadas), [selecionadas])
  const modalidades = useMemo(() => [...new Set(aulas.map(a => a.turmas?.modalidades?.nome).filter(Boolean))].sort(), [aulas])
  const modInicial = () => {
    if (somenteSelecionadasNoFiltro) {
      const m = [...new Set(aulas.filter(a => idsSel.has(a.id)).map(a => a.turmas?.modalidades?.nome))]
      if (m.length === 1) return m[0]
    }
    return modalidades.includes('Tênis') ? 'Tênis' : 'todas'
  }
  const [modalidade, setModalidade] = useState(null)
  const modAtual = modalidade ?? modInicial()

  const visiveis = aulas.filter(a => modAtual === 'todas' || a.turmas?.modalidades?.nome === modAtual)
  const quadras = [...new Set(visiveis.map(a => a.turmas?.quadras?.nome).filter(Boolean))]
    .sort((x, y) => (ORDEM_QUADRAS.indexOf(x) + 1 || 99) - (ORDEM_QUADRAS.indexOf(y) + 1 || 99))
  const horarios = [...new Set(visiveis.map(a => a.turmas?.horario_inicio?.slice(0, 5)).filter(Boolean))].sort()

  if (isLoading) return <Loading />
  if (!aulas.length) return <div style={{ padding: '14px', fontSize: '12px', color: 'var(--color-text-light-muted)', textAlign: 'center' }}>Sem aulas nesse dia.</div>

  const CW = 112
  return (
    <div style={{ backgroundColor: 'var(--color-surface-light-base)', borderRadius: '12px', padding: '10px', border: '1px solid var(--color-border-light)' }}>
      {modalidades.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {['todas', ...modalidades].map(m => (
            <button key={m} type="button" onClick={() => setModalidade(m)} style={{
              padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${modAtual === m ? 'var(--color-action-primary)' : 'var(--color-border-light)'}`,
              backgroundColor: modAtual === m ? 'var(--color-action-primary)' : 'var(--color-surface-light-overlay)',
              color: modAtual === m ? 'var(--color-action-on-primary)' : 'var(--color-text-light-secondary)',
            }}>{m === 'todas' ? 'Todas' : m}</button>
          ))}
        </div>
      )}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: `${44 + quadras.length * (CW + 4)}px` }}>
          <div style={{ display: 'flex', marginBottom: '4px' }}>
            <div style={{ width: '44px', flexShrink: 0 }} />
            {quadras.map(q => (
              <div key={q} style={{ width: `${CW}px`, marginRight: '4px', flexShrink: 0, textAlign: 'center', fontSize: '9px', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--color-action-primary)', padding: '4px', borderRadius: '6px', backgroundColor: 'var(--color-surface-light-overlay)' }}>{q}</div>
            ))}
          </div>
          {horarios.map(h => (
            <div key={h} style={{ display: 'flex', marginBottom: '4px' }}>
              <div style={{ width: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-light-secondary)', backgroundColor: 'var(--color-surface-light-overlay)', borderRadius: '6px', marginRight: '4px' }}>{h}</div>
              {quadras.map(q => {
                const a = visiveis.find(x => x.turmas?.horario_inicio?.slice(0, 5) === h && x.turmas?.quadras?.nome === q)
                if (!a) return <div key={q} style={{ width: `${CW}px`, marginRight: '4px', flexShrink: 0, minHeight: '54px', borderRadius: '8px', backgroundColor: 'var(--color-surface-light-overlay)', opacity: 0.5 }} />
                const sel = idsSel.has(a.id)
                const qtd = a.presencas?.length || 0
                const prof = a.professores ? nomeProfessor(a.professores) : 'sem professor'
                return (
                  <button key={q} type="button" disabled={!onToggle} onClick={() => onToggle?.(a)} style={{
                    width: `${CW}px`, marginRight: '4px', flexShrink: 0, minHeight: '54px', textAlign: 'left', padding: '6px 7px',
                    borderRadius: '8px', cursor: onToggle ? 'pointer' : 'default', position: 'relative', boxSizing: 'border-box',
                    border: sel ? '2px solid var(--color-action-primary)' : '1px solid var(--color-border-light)',
                    backgroundColor: sel ? 'color-mix(in srgb, var(--color-action-primary) 16%, var(--color-surface-light-overlay))' : 'var(--color-surface-light-overlay)',
                    opacity: qtd === 0 && !sel ? 0.55 : 1,
                  }}>
                    {sel && (
                      <span style={{ position: 'absolute', top: '4px', right: '4px', width: '15px', height: '15px', borderRadius: '50%', backgroundColor: 'var(--color-action-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={10} color="var(--color-action-on-primary)" strokeWidth={3} />
                      </span>
                    )}
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-light-primary)', lineHeight: 1.2, paddingRight: sel ? '14px' : 0 }}>{a.turmas?.niveis?.nome || a.turmas?.nome}</div>
                    <div style={{ fontSize: '9px', color: a.professores ? 'var(--color-text-light-secondary)' : 'var(--color-state-danger)', marginTop: '2px', fontWeight: a.professores ? 400 : 700 }}>{prof}</div>
                    <div style={{ fontSize: '9px', color: 'var(--color-text-light-muted)', marginTop: '1px' }}>{qtd} {qtd === 1 ? 'aluno' : 'alunos'}</div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
