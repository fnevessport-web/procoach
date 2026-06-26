import { useState } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, UserPlus } from 'lucide-react'
import { useAulas, useAtualizarStatusAula, useSalvarPresencas } from '../../hooks/useAulas'
import { useAlunos } from '../../hooks/useAlunos'
import useAppStore from '../../store/useAppStore'
import { Loading, EmptyState } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

const STATUS_AULA = [
  { value: 'dada', label: '✅ Aula Dada', paga: true },
  { value: 'nao_dada', label: '❌ Não Dada', paga: true },
  { value: 'cancelada', label: '🌧️ Cancelada', paga: false },
]

const STATUS_PRESENCA = [
  { value: 'presente', label: 'Presente', color: '#22c55e' },
  { value: 'falta', label: 'Falta', color: '#EF4444' },
  { value: 'falta_justificada', label: 'Falta Just.', color: '#f97316' },
]

const TIPO_PARTICIPACAO = [
  { value: 'mensalista', label: 'Mensalista' },
  { value: 'avulso', label: 'Avulso' },
  { value: 'cortesia', label: 'Cortesia' },
  { value: 'reposicao', label: 'Reposição' },
]

export function AulasCoordenador() {
  const { modalidadeSelecionada } = useAppStore()
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [aulaAberta, setAulaAberta] = useState(null)
  const [presencasLocal, setPresencasLocal] = useState({})
  const [adicionandoAluno, setAdicionandoAluno] = useState(null)
  const [buscaAdicionando, setBuscaAdicionando] = useState('')

  const { data: aulas, isLoading } = useAulas({ data, modalidadeId: modalidadeSelecionada?.id })
  const { data: todosAlunos } = useAlunos()
  const atualizarStatus = useAtualizarStatusAula()
  const salvarPresencas = useSalvarPresencas()

  const dataObj = new Date(data + 'T12:00:00')
  const label = format(dataObj, "EEEE, d 'de' MMMM", { locale: ptBR })
  const isHoje = data === format(new Date(), 'yyyy-MM-dd')

  function navData(dir) {
    const d = dir > 0 ? addDays(dataObj, 1) : subDays(dataObj, 1)
    setData(format(d, 'yyyy-MM-dd'))
  }

  function abrirAula(aula) {
    if (aulaAberta === aula.id) { setAulaAberta(null); return }
    setAulaAberta(aula.id)
    const inicial = {}
    aula.presencas?.forEach(p => {
      inicial[p.aluno_id] = {
        aluno_id: p.aluno_id,
        nome: p.alunos?.nome,
        status_presenca: p.status_presenca || (p.presente ? 'presente' : 'falta'),
        tipo_participacao: p.tipo_participacao || 'mensalista',
      }
    })
    setPresencasLocal(prev => ({ ...prev, [aula.id]: inicial }))
  }

  function updatePresenca(aulaId, alunoId, campo, valor) {
    setPresencasLocal(prev => ({
      ...prev,
      [aulaId]: {
        ...prev[aulaId],
        [alunoId]: { ...prev[aulaId]?.[alunoId], [campo]: valor }
      }
    }))
  }

  function adicionarAluno(aulaId, aluno) {
    setPresencasLocal(prev => ({
      ...prev,
      [aulaId]: {
        ...prev[aulaId],
        [aluno.id]: {
          aluno_id: aluno.id,
          nome: aluno.nome,
          status_presenca: 'presente',
          tipo_participacao: 'avulso',
        }
      }
    }))
    setAdicionandoAluno(null)
    setBuscaAdicionando('')
  }

  async function handleSalvarPresencas(aulaId) {
    const lista = Object.values(presencasLocal[aulaId] || {})
    if (!lista.length) return toast.error('Nenhum aluno na lista')
    try {
      await salvarPresencas.mutateAsync({ aulaId, presencas: lista })
      toast.success('Presenças salvas!')
    } catch (err) { toast.error(err.message) }
  }

  async function handleStatusAula(aulaId, statusAula) {
    const pagaProfessor = STATUS_AULA.find(s => s.value === statusAula)?.paga ?? true
    try {
      await atualizarStatus.mutateAsync({ aulaId, statusAula, pagaProfessor })
      toast.success('Status atualizado!')
    } catch (err) { toast.error(err.message) }
  }

  // Filtra aulas: inclui aulas sem turma (avulsas) + filtra por modalidade se selecionada
  const aulasFiltradas = aulas?.filter(a => {
    if (!modalidadeSelecionada) return true
    if (!a.turma_id) return true // aulas avulsas sempre aparecem
    return a.turmas?.modalidades?.nome === modalidadeSelecionada.nome
  })

  return (
    <div className="fade-in">
      {/* Navegador de data */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
        boxSizing: 'border-box', width: '100%',
      }}>
        <button onClick={() => navData(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px' }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', textTransform: 'capitalize' }}>
            {label}
          </div>
          <button onClick={() => setData(format(new Date(), 'yyyy-MM-dd'))} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '12px', color: isHoje ? '#fcc825' : '#555', marginTop: '2px',
          }}>
            {isHoje ? 'Hoje' : 'Ir para hoje'}
          </button>
        </div>
        <button onClick={() => navData(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px' }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {isLoading ? <Loading /> : !aulasFiltradas?.length ? (
        <EmptyState iconImg="/images/totaldeaulas.png" title="Nenhuma aula neste dia" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {aulasFiltradas.map(aula => {
            const aberta = aulaAberta === aula.id
            const presencas = presencasLocal[aula.id] || {}
            const qtdAlunos = aula.presencas?.length || 0
            const statusAtual = aula.status_aula || 'dada'
            const alunosNaAula = Object.values(presencas)
            const idsNaAula = Object.keys(presencas)

            // Nome da aula — turma ou avulsa
            const nomeAula = aula.turmas?.nome || aula.observacoes || 'Aula Avulsa'
            const isAvulsa = !aula.turma_id

            // Busca aluno para adicionar
            const alunosBusca = buscaAdicionando.length >= 1
              ? todosAlunos?.filter(a =>
                  a.nome.toLowerCase().includes(buscaAdicionando.toLowerCase()) &&
                  !idsNaAula.includes(a.id)
                )
              : []

            return (
              <div key={aula.id} style={{
                backgroundColor: '#1a1a1a', borderRadius: '14px',
                border: isAvulsa
                  ? '1px solid rgba(252,200,37,0.2)'
                  : '1px solid rgba(255,255,255,0.06)',
                overflow: 'hidden', boxSizing: 'border-box', width: '100%',
              }}>
                {/* Cabeçalho */}
                <button
                  onClick={() => abrirAula(aula)}
                  style={{
                    width: '100%', padding: '14px 16px', background: 'none', border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      {isAvulsa && (
                        <span style={{
                          fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                          backgroundColor: 'rgba(252,200,37,0.15)', color: '#fcc825',
                        }}>avulsa</span>
                      )}
                      <span>{aula.turmas?.modalidades?.icone_emoji}</span>
                      <span style={{ fontWeight: '600', color: '#F0F2F5', fontSize: '14px' }}>
                        {nomeAula}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#555' }}>
                      {aula.turmas?.horario_inicio
                        ? `${aula.turmas.horario_inicio.slice(0, 5)}–${aula.turmas.horario_fim?.slice(0, 5)} • `
                        : ''}
                      Prof: {aula.professores?.nome} •
                      <span style={{ color: '#fcc825' }}> {qtdAlunos} aluno{qtdAlunos !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '11px', padding: '3px 8px', borderRadius: '6px',
                      backgroundColor: statusAtual === 'dada' ? 'rgba(34,197,94,0.15)'
                        : statusAtual === 'cancelada' ? 'rgba(59,130,246,0.15)'
                        : 'rgba(239,68,68,0.15)',
                      color: statusAtual === 'dada' ? '#22c55e'
                        : statusAtual === 'cancelada' ? '#3b82f6'
                        : '#EF4444',
                    }}>
                      {STATUS_AULA.find(s => s.value === statusAtual)?.label}
                    </span>
                    {aberta ? <ChevronUp size={16} color="#555" /> : <ChevronDown size={16} color="#555" />}
                  </div>
                </button>

                {/* Painel expandido */}
                {aberta && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>

                    {/* Status da aula */}
                    <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Status da Aula
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {STATUS_AULA.map(s => (
                          <button key={s.value} onClick={() => handleStatusAula(aula.id, s.value)} style={{
                            flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none',
                            fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                            background: statusAtual === s.value ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#111',
                            color: statusAtual === s.value ? 'white' : '#555',
                            boxSizing: 'border-box',
                          }}>{s.label}</button>
                        ))}
                      </div>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '6px' }}>
                        💰 Professor: <span style={{ color: aula.paga_professor ? '#22c55e' : '#EF4444' }}>
                          {aula.paga_professor ? 'Aula paga' : 'Aula não paga'}
                        </span>
                      </div>
                    </div>

                    {/* Presenças */}
                    <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Presenças ({alunosNaAula.length})
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {alunosNaAula.map(aluno => (
                        <div key={aluno.aluno_id} style={{
                          backgroundColor: '#111', borderRadius: '10px',
                          padding: '10px 12px', boxSizing: 'border-box',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '500', color: '#F0F2F5' }}>{aluno.nome}</span>
                            <select
                              value={aluno.tipo_participacao}
                              onChange={e => updatePresenca(aula.id, aluno.aluno_id, 'tipo_participacao', e.target.value)}
                              style={{
                                fontSize: '11px', padding: '2px 6px', borderRadius: '6px',
                                backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                                color: '#888', cursor: 'pointer', outline: 'none',
                              }}
                            >
                              {TIPO_PARTICIPACAO.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {STATUS_PRESENCA.map(sp => (
                              <button key={sp.value}
                                onClick={() => updatePresenca(aula.id, aluno.aluno_id, 'status_presenca', sp.value)}
                                style={{
                                  flex: 1, padding: '6px 4px', borderRadius: '6px', border: 'none',
                                  fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                                  backgroundColor: aluno.status_presenca === sp.value ? sp.color + '30' : '#1a1a1a',
                                  color: aluno.status_presenca === sp.value ? sp.color : '#444',
                                  boxSizing: 'border-box',
                                  outline: aluno.status_presenca === sp.value ? `1px solid ${sp.color}` : 'none',
                                }}
                              >{sp.label}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Adicionar aluno com busca */}
                    {adicionandoAluno === aula.id ? (
                      <div style={{ marginTop: '10px', position: 'relative' }}>
                        <input
                          placeholder="Buscar aluno..."
                          value={buscaAdicionando}
                          onChange={e => setBuscaAdicionando(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: '10px',
                            backgroundColor: '#111', border: '1px solid #fcc825',
                            color: '#F0F2F5', fontSize: '13px', outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                        {alunosBusca.length > 0 && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                            backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                            borderRadius: '10px', marginTop: '4px', maxHeight: '160px', overflowY: 'auto',
                          }}>
                            {alunosBusca.map(a => (
                              <button key={a.id} onClick={() => adicionarAluno(aula.id, a)} style={{
                                width: '100%', padding: '10px 12px', border: 'none', background: 'none',
                                color: '#F0F2F5', fontSize: '13px', textAlign: 'left', cursor: 'pointer',
                                borderBottom: '1px solid #2a2a2a',
                              }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                              >{a.nome}</button>
                            ))}
                          </div>
                        )}
                        <button onClick={() => { setAdicionandoAluno(null); setBuscaAdicionando('') }} style={{
                          marginTop: '6px', fontSize: '12px', color: '#555',
                          background: 'none', border: 'none', cursor: 'pointer',
                        }}>Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setAdicionandoAluno(aula.id)} style={{
                        marginTop: '10px', width: '100%', padding: '8px',
                        borderRadius: '8px', border: '1px dashed #2a2a2a',
                        background: 'none', color: '#555', fontSize: '12px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '6px', boxSizing: 'border-box',
                      }}>
                        <UserPlus size={13} /> Adicionar aluno
                      </button>
                    )}

                    {/* Salvar */}
                    <button
                      onClick={() => handleSalvarPresencas(aula.id)}
                      disabled={salvarPresencas.isPending}
                      style={{
                        marginTop: '12px', width: '100%', padding: '12px',
                        borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                        color: 'white', fontSize: '14px', fontWeight: '600',
                        cursor: 'pointer', boxSizing: 'border-box',
                      }}
                    >
                      {salvarPresencas.isPending ? 'Salvando...' : '💾 Salvar Presenças'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}