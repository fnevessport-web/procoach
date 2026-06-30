import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Loading } from '../../components/ui/Loading'

const DIAS_SEMANA = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']
const DIAS_LABEL  = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM']
const HORARIOS    = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

const PALETA = [
  '#f59e0b', '#10b981', '#3b82f6', '#f472b6', '#a78bfa',
  '#22d3ee', '#fb923c', '#84cc16', '#f87171', '#e879f9',
  '#34d399', '#60a5fa', '#fbbf24', '#c084fc', '#4ade80', '#818cf8',
]

function primeiroNome(nome) {
  return nome?.split(' ')[0] || nome
}

export function GradeDisponibilidade() {
  const { data: professores = [], isLoading: loadingProfs } = useQuery({
    queryKey: ['profs_grade_disp'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return data || []
    },
    staleTime: 300000,
  })

  const { data: disponibilidades = [], isLoading: loadingDisp } = useQuery({
    queryKey: ['disp_todos_profs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disponibilidades')
        .select('professor_id, dia_semana, horario, status')
        .in('status', ['disponivel', 'talvez'])
      if (error) throw error
      return data || []
    },
    staleTime: 60000,
  })

  if (loadingProfs || loadingDisp) return <Loading />

  // Cor fixa por professor (índice na lista ordenada por nome)
  const profMap = {}
  professores.forEach((p, i) => {
    profMap[p.id] = { ...p, cor: PALETA[i % PALETA.length] }
  })

  // Mapa: 'dia-horario' → lista de entradas { nome, cor, status }
  const dispMap = {}
  disponibilidades.forEach(d => {
    const prof = profMap[d.professor_id]
    if (!prof) return
    const key = `${d.dia_semana}-${d.horario}`
    if (!dispMap[key]) dispMap[key] = []
    dispMap[key].push({ id: prof.id, nome: primeiroNome(prof.nome), cor: prof.cor, status: d.status })
  })

  // Ordena: disponivel primeiro, talvez depois
  Object.values(dispMap).forEach(arr =>
    arr.sort((a, b) => (a.status === 'disponivel' ? -1 : 1))
  )

  const CELL_W = 112

  return (
    <div>
      {/* Legenda de professores */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '8px 14px',
        marginBottom: '16px', padding: '12px 14px',
        backgroundColor: '#111', borderRadius: '10px', border: '1px solid #1e1e1e',
      }}>
        {professores.map((p, i) => {
          const cor = PALETA[i % PALETA.length]
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: cor, flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: '#aaa' }}>{p.nome.split(' ').slice(0, 2).join(' ')}</span>
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: `${42 + CELL_W * 7 + 2 * 6}px` }}>
          {/* Header dias */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: '4px', paddingLeft: '42px' }}>
            {DIAS_LABEL.map(d => (
              <div key={d} style={{
                width: `${CELL_W}px`, flexShrink: 0, textAlign: 'center',
                fontSize: '10px', color: '#555', fontWeight: '700', letterSpacing: '1px', padding: '6px 0',
              }}>{d}</div>
            ))}
          </div>

          {/* Linhas de horário */}
          {HORARIOS.map(horario => {
            const hasAny = DIAS_SEMANA.some(d => (dispMap[`${d}-${horario}`] || []).length > 0)
            return (
              <div key={horario} style={{
                display: 'flex', gap: '2px', marginBottom: '2px', alignItems: 'flex-start',
                opacity: hasAny ? 1 : 0.3,
              }}>
                {/* Label horário */}
                <div style={{
                  width: '38px', flexShrink: 0, fontSize: '9px', color: '#555',
                  textAlign: 'right', paddingRight: '6px', paddingTop: '9px', fontWeight: '500',
                }}>{horario}</div>

                {/* Células */}
                {DIAS_SEMANA.map(dia => {
                  const entries = dispMap[`${dia}-${horario}`] || []
                  return (
                    <div key={dia} style={{
                      width: `${CELL_W}px`, flexShrink: 0,
                      minHeight: '34px',
                      backgroundColor: entries.length ? '#131313' : '#0d0d0d',
                      borderRadius: '6px',
                      border: '1px solid #161616',
                      padding: entries.length ? '4px' : '0',
                      display: 'flex', flexDirection: 'column', gap: '2px',
                    }}>
                      {entries.map(e => (
                        <div key={e.id} style={{
                          padding: '3px 7px', borderRadius: '4px',
                          backgroundColor: e.cor + '20',
                          border: `1px solid ${e.cor}38`,
                          opacity: e.status === 'talvez' ? 0.45 : 1,
                        }}>
                          <span style={{
                            fontSize: '10px', fontWeight: '600', color: e.cor,
                            whiteSpace: 'nowrap', overflow: 'hidden', display: 'block', textOverflow: 'ellipsis',
                          }}>{e.nome}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legenda status */}
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '20px', height: '9px', borderRadius: '3px', backgroundColor: '#aaa20', border: '1px solid #aaa38' }} />
          <span style={{ fontSize: '10px', color: '#555' }}>Disponível</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '20px', height: '9px', borderRadius: '3px', backgroundColor: '#aaa20', border: '1px solid #aaa38', opacity: 0.45 }} />
          <span style={{ fontSize: '10px', color: '#555' }}>Talvez</span>
        </div>
      </div>
    </div>
  )
}
