import { useState } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, UserPlus, Pencil, Check, X } from 'lucide-react'
import { useAulas, useAtualizarStatusAula, useSalvarPresencas } from '../../hooks/useAulas'
import { useAlunos } from '../../hooks/useAlunos'
import { useProfessores } from '../../hooks/useProfessores'
import { useQuadras } from '../../hooks/useQuadras'
import { useNiveis } from '../../hooks/useNiveis'
import useAppStore from '../../store/useAppStore'
import { Loading, EmptyState } from '../../components/ui/Loading'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
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

function parseObservacoes(obs) {
  if (!obs) return { quadra: '', horario: '', nivel: '' }
  const partes = obs.split('·').map(s => s.trim())
  return { quadra: partes[1] || '', horario: partes[2] || '', nivel: partes[3] || '' }
}

function getQuadraNome(aula) {
  if (!aula.turma_id) return parseObservacoes(aula.observacoes).quadra
  return aula.turmas?.quadras?.nome || ''
}

function getHorario(aula) {
  if (!aula.turma_id) return parseObservacoes(aula.observacoes).horario
  return aula.turmas?.horario_inicio?.slice(0, 5) || ''
}

function getNivel(aula) {
  if (!aula.turma_id) return parseObservacoes(aula.observacoes).nivel
  return aula.turmas?.niveis?.nome || ''
}

export function AulasCoordenador() {
  const { modalidadeSelecionada } = useAppStore()
  const qc = useQueryClient()
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [aulaModal, setAulaModal] = useState(null)
  const [presencasLocal, setPresencasLocal] = useState({})
  const [adicionandoAluno, setAdicionandoAluno] = useState(null)
  const [buscaAdicionando, setBuscaAdicionando] = useState('')
  const [editandoAula, setEditandoAula] = useState(null)
  const [editForm, setEditForm] = useState({})

  const { data: aulas, isLoading } = useAulas({ data, modalidadeId: modalidadeSelecionada?.id })
  const { data: todosAlunos } = useAlunos()
  const { professores: todoProfessores } = useProfessores(null)
  const { data: todasQuadras } = useQuadras(null)
  const { data: todosNiveis } = useNiveis(null)
  const atualizarStatus = useAtualizarStatusAula()
  const salvarPresencas = useSalvarPresencas()

  const dataObj = new Date(data + 'T12:00:00')
  const label = format(dataObj, "EEEE, d 'de' MMMM", { locale: ptBR })
  const isHoje = data === format(new Date(), 'yyyy-MM-dd')
  const horarios = Array.from({ length: 18 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

  function navData(dir) {
    const d = dir > 0 ? addDays(dataObj, 1) : subDays(dataObj, 1)
    setData(format(d, 'yyyy-MM-dd'))
  }

  function abrirAula(aula) {
    setAulaModal(aula)
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

  function fecharModal() {
    setAulaModal(null)
    setEditandoAula(null)
    setAdicionandoAluno(null)
    setBuscaAdicionando('')
  }

  function updatePresenca(aulaId, alunoId, campo, valor) {
    setPresencasLocal(prev => ({
      ...prev,
      [aulaId]: { ...prev[aulaId], [alunoId]: { ...prev[aulaId]?.[alunoId], [campo]: valor } }
    }))
  }

  function adicionarAluno(aulaId, aluno) {
    setPresencasLocal(prev => ({
      ...prev,
      [aulaId]: {
        ...prev[aulaId],
        [aluno.id]: { aluno_id: aluno.id, nome: aluno.nome, status_presenca: 'presente', tipo_participacao: 'avulso' }
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

  function iniciarEdicao(aula) {
    const parsed = parseObservacoes(aula.observacoes)
    setEditandoAula(aula.id)
    setEditForm({
      professor_id: aula.professor_executou_id || '',
      quadra_nome: parsed.quadra,
      horario: parsed.horario,
      nivel: parsed.nivel,
      data_aula: aula.data_aula,
    })
  }

  async function handleSalvarEdicao(aula) {
    try {
      const novaObs = `⚡ Avulsa · ${editForm.quadra_nome} · ${editForm.horario}${editForm.nivel ? ' · ' + editForm.nivel : ''}`
      const { error } = await supabase.from('aulas').update({
        professor_executou_id: editForm.professor_id || null,
        data_aula: editForm.data_aula,
        observacoes: novaObs,
      }).eq('id', aula.id)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success('Aula atualizada!')
      setEditandoAula(null)
    } catch (err) { toast.error(err.message) }
  }

  const aulasFiltradas = aulas?.filter(a => {
    if (!modalidadeSelecionada) return true
    if (!a.turma_id) return true
    return a.turmas?.modalidades?.nome === modalidadeSelecionada.nome
  }) || []

  // Monta lista de quadras únicas ordenando Quadra 4, Quadra 3 primeiro
  const quadrasUnicas = [...new Set(aulasFiltradas.map(a => getQuadraNome(a)).filter(Boolean))]
    .sort((a, b) => {
      const ordem = ['Quadra 4', 'Quadra 3', 'Quadra 2', 'Quadra 1']
      const ia = ordem.indexOf(a)
      const ib = ordem.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })

  // Horários que têm aula
  const horariosComAula = [...new Set(aulasFiltradas.map(a => getHorario(a)).filter(Boolean))].sort()

  // Totais
  const totalAulas = aulasFiltradas.length
  const aulasDadas = aulasFiltradas.filter(a => (a.status_aula || 'dada') === 'dada').length
  const aulasNaoDadas = aulasFiltradas.filter(a => a.status_aula === 'nao_dada').length
  const aulasCanceladas = aulasFiltradas.filter(a => a.status_aula === 'cancelada').length
  let totalPresentes = 0, totalFaltas = 0
  aulasFiltradas.forEach(aula => {
    aula.presencas?.forEach(p => {
      if (p.status_presenca === 'presente' || p.presente) totalPresentes++
      else if (p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada') totalFaltas++
    })
  })

  // Aula do modal
  const aula = aulaModal
  const presencas = aula ? (presencasLocal[aula.id] || {}) : {}
  const alunosNaAula = Object.values(presencas)
  const idsNaAula = Object.keys(presencas)
  const statusAtual = aula ? (aula.status_aula || 'dada') : 'dada'
  const isAvulsa = aula ? !aula.turma_id : false
  const estaEditando = aula ? editandoAula === aula.id : false
  const alunosBusca = buscaAdicionando.length >= 1
    ? todosAlunos?.filter(a => a.nome.toLowerCase().includes(buscaAdicionando.toLowerCase()) && !idsNaAula.includes(a.id))
    : []

  return (
    <div className="fade-in">

      {/* Navegador de data */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px', padding: '12px 16px', marginBottom: '12px',
        boxSizing: 'border-box', width: '100%',
      }}>
        <button onClick={() => navData(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px' }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#F0F2F5', textTransform: 'capitalize' }}>{label}</div>
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

      {/* Resumo do dia */}
      {totalAulas > 0 && (
        <div style={{
          backgroundColor: '#151515', border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '10px', padding: '8px 14px', marginBottom: '14px',
          display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#555' }}>Aulas</span>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: '600' }}>{totalAulas}</span>
            <span style={{ fontSize: '11px', color: '#333' }}>·</span>
            <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: '600' }}>{aulasDadas}</span>
            <span style={{ fontSize: '11px', color: '#555' }}>/</span>
            <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: '600' }}>{aulasNaoDadas + aulasCanceladas}</span>
          </div>
          <span style={{ fontSize: '11px', color: '#2a2a2a' }}>·</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#555' }}>Alunos</span>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: '600' }}>{totalPresentes + totalFaltas}</span>
            <span style={{ fontSize: '11px', color: '#333' }}>·</span>
            <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: '600' }}>{totalPresentes}</span>
            <span style={{ fontSize: '11px', color: '#555' }}>/</span>
            <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: '600' }}>{totalFaltas}</span>
          </div>
        </div>
      )}

      {isLoading ? <Loading /> : !aulasFiltradas.length ? (
        <EmptyState iconImg="/images/totaldeaulas.png" title="Nenhuma aula neste dia" />
      ) : (
        /* Grade de horários */
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ minWidth: `${50 + quadrasUnicas.length * 140}px` }}>

            {/* Cabeçalho das quadras */}
            <div style={{ display: 'flex', marginBottom: '4px' }}>
              <div style={{ width: '50px', flexShrink: 0 }} />
              {quadrasUnicas.map(q => (
                <div key={q} style={{
                  width: '140px', flexShrink: 0, textAlign: 'center',
                  fontSize: '11px', fontWeight: '700', color: '#fcc825',
                  letterSpacing: '0.5px', textTransform: 'uppercase',
                  padding: '6px 4px', backgroundColor: '#151515',
                  borderRadius: '8px', marginRight: '4px',
                }}>{q}</div>
              ))}
            </div>

            {/* Linhas por horário */}
            {horariosComAula.map(horario => (
              <div key={horario} style={{ display: 'flex', marginBottom: '4px', alignItems: 'stretch' }}>

                {/* Coluna horário — travada visualmente */}
                <div style={{
                  width: '50px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '600', color: '#555',
                  backgroundColor: '#151515', borderRadius: '8px', marginRight: '4px',
                }}>{horario}</div>

                {/* Células por quadra */}
                {quadrasUnicas.map(quadra => {
                  const aulaCelula = aulasFiltradas.find(a =>
                    getHorario(a) === horario && getQuadraNome(a) === quadra
                  )

                  if (!aulaCelula) {
                    return (
                      <div key={quadra} style={{
                        width: '140px', flexShrink: 0, marginRight: '4px',
                        backgroundColor: '#111', borderRadius: '10px',
                        border: '1px solid #1e1e1e', minHeight: '72px',
                      }} />
                    )
                  }

                  const st = aulaCelula.status_aula || 'dada'
                  const nivel = getNivel(aulaCelula)
                  const qtdTotal = aulaCelula.presencas?.length || 0
                  const qtdP = aulaCelula.presencas?.filter(p => p.status_presenca === 'presente' || p.presente).length || 0
                  const qtdF = aulaCelula.presencas?.filter(p => p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada').length || 0
                  const isAv = !aulaCelula.turma_id

                  const borderColor = st === 'dada' ? 'rgba(34,197,94,0.3)'
                    : st === 'nao_dada' ? 'rgba(239,68,68,0.3)'
                    : 'rgba(59,130,246,0.3)'
                  const dotColor = st === 'dada' ? '#22c55e' : st === 'nao_dada' ? '#EF4444' : '#3b82f6'

                  return (
                    <button key={quadra}
                      onClick={() => abrirAula(aulaCelula)}
                      style={{
                        width: '140px', flexShrink: 0, marginRight: '4px',
                        backgroundColor: '#1a1a1a', borderRadius: '10px',
                        border: `1px solid ${borderColor}`,
                        padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
                        minHeight: '72px', boxSizing: 'border-box',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      }}
                    >
                      {/* Linha topo: badge avulsa + status dot */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        {isAv
                          ? <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(252,200,37,0.15)', color: '#fcc825' }}>avulsa</span>
                          : <span />
                        }
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
                      </div>

                      {/* Nível */}
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#F0F2F5', lineHeight: '1.3', marginBottom: '4px' }}>
                        {nivel || (isAv ? 'Avulsa' : aulaCelula.turmas?.nome || '—')}
                      </div>

                      {/* Professor */}
                      <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {aulaCelula.professores?.nome?.split(' ')[0]}
                      </div>

                      {/* Contadores */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', color: '#888' }}>{qtdTotal}🧑</span>
                        {qtdP > 0 && <span style={{ fontSize: '10px', color: '#22c55e' }}>✓{qtdP}</span>}
                        {qtdF > 0 && <span style={{ fontSize: '10px', color: '#EF4444' }}>✗{qtdF}</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de detalhes da aula */}
      {aulaModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-end',
        }} onClick={fecharModal}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxHeight: '90vh', overflowY: 'auto',
              backgroundColor: '#1a1a1a', borderRadius: '20px 20px 0 0',
              padding: '20px 16px', boxSizing: 'border-box',
            }}
          >
            {/* Handle */}
            <div style={{ width: '40px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '0 auto 16px' }} />

            {/* Título */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5' }}>
                  {getNivel(aula) || (isAvulsa ? 'Aula Avulsa' : aula.turmas?.nome)}
                </div>
                <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
                  {getQuadraNome(aula)} · {getHorario(aula)} · Prof: {aula.professores?.nome}
                </div>
              </div>
              <button onClick={fecharModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Botão editar (só avulsas) */}
            {isAvulsa && (
              <div style={{ marginBottom: '12px' }}>
                {estaEditando ? (
                  <div style={{
                    backgroundColor: '#111', borderRadius: '12px',
                    border: '1px solid rgba(252,200,37,0.2)', padding: '12px',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                  }}>
                    <div style={{ fontSize: '12px', color: '#fcc825', fontWeight: '600' }}>✏️ Editar Aula</div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Data</div>
                      <input type="date" value={editForm.data_aula}
                        onChange={e => setEditForm(f => ({ ...f, data_aula: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#F0F2F5', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Horário</div>
                      <select value={editForm.horario} onChange={e => setEditForm(f => ({ ...f, horario: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#F0F2F5', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                        {horarios.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Quadra</div>
                      <select value={editForm.quadra_nome} onChange={e => setEditForm(f => ({ ...f, quadra_nome: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#F0F2F5', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                        <option value="">Selecione...</option>
                        {todasQuadras?.map(q => <option key={q.id} value={q.nome}>{q.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Nível</div>
                      <select value={editForm.nivel} onChange={e => setEditForm(f => ({ ...f, nivel: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#F0F2F5', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                        <option value="">Sem nível</option>
                        {todosNiveis?.map(n => <option key={n.id} value={n.nome}>{n.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Professor</div>
                      <select value={editForm.professor_id} onChange={e => setEditForm(f => ({ ...f, professor_id: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#F0F2F5', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}>
                        <option value="">Selecione...</option>
                        {todoProfessores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setEditandoAula(null)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={() => handleSalvarEdicao(aula)} style={{ flex: 2, padding: '8px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fcc825, #cf1b9b)', color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Check size={13} /> Salvar edição
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => iniciarEdicao(aula)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #2a2a2a', background: 'none', color: '#888', fontSize: '12px', cursor: 'pointer' }}>
                    <Pencil size={12} /> Editar aula
                  </button>
                )}
              </div>
            )}

            {/* Status da aula */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status da Aula</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {STATUS_AULA.map(s => (
                  <button key={s.value} onClick={() => handleStatusAula(aula.id, s.value)} style={{
                    flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none',
                    fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                    background: statusAtual === s.value ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#111',
                    color: statusAtual === s.value ? 'white' : '#555', boxSizing: 'border-box',
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
                <div key={aluno.aluno_id} style={{ backgroundColor: '#111', borderRadius: '10px', padding: '10px 12px', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#F0F2F5' }}>{aluno.nome}</span>
                    <select value={aluno.tipo_participacao} onChange={e => updatePresenca(aula.id, aluno.aluno_id, 'tipo_participacao', e.target.value)}
                      style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer', outline: 'none' }}>
                      {TIPO_PARTICIPACAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {STATUS_PRESENCA.map(sp => (
                      <button key={sp.value} onClick={() => updatePresenca(aula.id, aluno.aluno_id, 'status_presenca', sp.value)} style={{
                        flex: 1, padding: '6px 4px', borderRadius: '6px', border: 'none',
                        fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                        backgroundColor: aluno.status_presenca === sp.value ? sp.color + '30' : '#1a1a1a',
                        color: aluno.status_presenca === sp.value ? sp.color : '#444',
                        boxSizing: 'border-box',
                        outline: aluno.status_presenca === sp.value ? `1px solid ${sp.color}` : 'none',
                      }}>{sp.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Adicionar aluno */}
            {adicionandoAluno === aula.id ? (
              <div style={{ marginTop: '10px', position: 'relative' }}>
                <input placeholder="Buscar aluno..." value={buscaAdicionando}
                  onChange={e => setBuscaAdicionando(e.target.value)} autoFocus
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: '#111', border: '1px solid #fcc825', color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                {alunosBusca.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '10px', marginTop: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                    {alunosBusca.map(a => (
                      <button key={a.id} onClick={() => adicionarAluno(aula.id, a)} style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'none', color: '#F0F2F5', fontSize: '13px', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #2a2a2a' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >{a.nome}</button>
                    ))}
                  </div>
                )}
                <button onClick={() => { setAdicionandoAluno(null); setBuscaAdicionando('') }} style={{ marginTop: '6px', fontSize: '12px', color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setAdicionandoAluno(aula.id)} style={{
                marginTop: '10px', width: '100%', padding: '8px', borderRadius: '8px',
                border: '1px dashed #2a2a2a', background: 'none', color: '#555', fontSize: '12px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box',
              }}>
                <UserPlus size={13} /> Adicionar aluno
              </button>
            )}

            {/* Salvar */}
            <button onClick={() => handleSalvarPresencas(aula.id)} disabled={salvarPresencas.isPending} style={{
              marginTop: '12px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
              color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box',
            }}>
              {salvarPresencas.isPending ? 'Salvando...' : '💾 Salvar Presenças'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}