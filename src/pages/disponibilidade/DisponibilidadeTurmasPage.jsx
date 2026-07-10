import { useState } from 'react'
import { useTurmas } from '../../hooks/useTurmas'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'

const DIAS_SEMANA = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']
const DIAS_LABEL = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM']
const HORARIOS = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

// vermelho = lotada · amarelo = 1 vaga · verde = 2-3 vagas · azul = vazia (sem ninguém)
function corPorOcupacao(ocupacao, capacidade) {
  if (ocupacao <= 0) return '#3b82f6'
  const vagas = capacidade - ocupacao
  if (vagas <= 0) return '#ef4444'
  if (vagas === 1) return '#f59e0b'
  return '#22c55e'
}

export function DisponibilidadeTurmasPage() {
  const { data: turmas = [], isLoading } = useTurmas()
  const [niveisFiltro, setNiveisFiltro] = useState([])
  const [turmaSel, setTurmaSel] = useState(null)

  const niveisDisponiveis = [...new Map(
    turmas.filter(t => t.niveis?.nome).map(t => [t.niveis.nome, t.niveis.nome])
  ).values()].sort()

  function toggleNivel(nome) {
    setNiveisFiltro(prev => prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome])
  }

  const turmasFiltradas = niveisFiltro.length === 0
    ? turmas
    : turmas.filter(t => niveisFiltro.includes(t.niveis?.nome))

  const porDiaHorario = {}
  turmasFiltradas.forEach(t => {
    if (!t.horario_dia_semana || !t.horario_inicio) return
    const chave = `${t.horario_dia_semana}-${t.horario_inicio.slice(0, 5)}`
    if (!porDiaHorario[chave]) porDiaHorario[chave] = []
    const capacidade = t.niveis?.nome === 'Individual' ? 1 : 4
    const ocupacao = t.turmas_alunos?.filter(ta => ta.ativo).length || 0
    porDiaHorario[chave].push({ ...t, capacidade, ocupacao })
  })

  if (isLoading) return <Loading />

  const CELL_W = 120

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: '0 0 4px' }}>
        Disponibilidade
      </h1>
      <p style={{ fontSize: '12px', color: '#555', margin: '0 0 16px' }}>
        Ocupação das turmas por dia e horário — clique numa turma pra ver quem já está matriculado.
      </p>

      {/* Filtro de nível */}
      {niveisDisponiveis.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Filtrar por nível
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {niveisDisponiveis.map(nome => {
              const ativo = niveisFiltro.includes(nome)
              return (
                <button key={nome} onClick={() => toggleNivel(nome)} style={{
                  padding: '6px 12px', borderRadius: '8px', border: 'none',
                  background: ativo ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#1a1a1a',
                  outline: ativo ? 'none' : '1px solid #2a2a2a',
                  color: ativo ? 'white' : '#888', fontSize: '12px', fontWeight: ativo ? '600' : '400',
                  cursor: 'pointer',
                }}>{nome}</button>
              )
            })}
            {niveisFiltro.length > 0 && (
              <button onClick={() => setNiveisFiltro([])} style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none',
                background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '12px', cursor: 'pointer',
              }}>Limpar</button>
            )}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '16px', fontSize: '10px', color: '#888' }}>
        <LegendaItem cor="#ef4444" label="Lotada" />
        <LegendaItem cor="#f59e0b" label="1 vaga" />
        <LegendaItem cor="#22c55e" label="2-3 vagas" />
        <LegendaItem cor="#3b82f6" label="Vazia" />
      </div>

      {/* Grade */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: `${42 + CELL_W * 7 + 2 * 6}px` }}>
          <div style={{ display: 'flex', gap: '2px', marginBottom: '4px', paddingLeft: '42px' }}>
            {DIAS_LABEL.map(d => (
              <div key={d} style={{
                width: `${CELL_W}px`, flexShrink: 0, textAlign: 'center',
                fontSize: '10px', color: '#555', fontWeight: '700', letterSpacing: '1px', padding: '6px 0',
              }}>{d}</div>
            ))}
          </div>

          {HORARIOS.map(horario => {
            const hasAny = DIAS_SEMANA.some(d => (porDiaHorario[`${d}-${horario}`] || []).length > 0)
            return (
              <div key={horario} style={{
                display: 'flex', gap: '2px', marginBottom: '2px', alignItems: 'flex-start',
                opacity: hasAny ? 1 : 0.3,
              }}>
                <div style={{
                  width: '38px', flexShrink: 0, fontSize: '9px', color: '#555',
                  textAlign: 'right', paddingRight: '6px', paddingTop: '9px', fontWeight: '500',
                }}>{horario}</div>

                {DIAS_SEMANA.map(dia => {
                  const entradas = porDiaHorario[`${dia}-${horario}`] || []
                  return (
                    <div key={dia} style={{
                      width: `${CELL_W}px`, flexShrink: 0, minHeight: '34px',
                      backgroundColor: entradas.length ? '#131313' : '#0d0d0d',
                      borderRadius: '6px', border: '1px solid #161616',
                      padding: entradas.length ? '4px' : '0',
                      display: 'flex', flexDirection: 'column', gap: '2px',
                    }}>
                      {entradas.map(t => {
                        const cor = corPorOcupacao(t.ocupacao, t.capacidade)
                        return (
                          <button key={t.id} onClick={() => setTurmaSel(t)} style={{
                            padding: '3px 7px', borderRadius: '4px', border: 'none', textAlign: 'left', cursor: 'pointer',
                            backgroundColor: cor + '22', outline: `1px solid ${cor}55`,
                          }}>
                            <div style={{
                              fontSize: '10px', fontWeight: '600', color: cor,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{t.niveis?.nome || t.nome}</div>
                            <div style={{ fontSize: '9px', color: '#888' }}>{t.ocupacao}/{t.capacidade}</div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {turmaSel && (
        <Modal open onClose={() => setTurmaSel(null)} title={turmaSel.nome} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '12px', color: '#888' }}>
              {turmaSel.horario_inicio?.slice(0, 5)} · {turmaSel.quadras?.nome} · {turmaSel.niveis?.nome}
              {' · '}{turmaSel.ocupacao}/{turmaSel.capacidade} vagas ocupadas
            </div>
            {turmaSel.turmas_alunos?.filter(ta => ta.ativo).length === 0 ? (
              <div style={{ fontSize: '12px', color: '#555', padding: '12px 0', textAlign: 'center' }}>
                Nenhum aluno matriculado ainda
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {turmaSel.turmas_alunos?.filter(ta => ta.ativo).map(ta => (
                  <div key={ta.aluno_id} style={{
                    padding: '9px 12px', borderRadius: '8px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                    fontSize: '13px', color: '#F0F2F5',
                  }}>
                    {ta.alunos?.nome}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function LegendaItem({ cor, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: cor }} />
      {label}
    </div>
  )
}
