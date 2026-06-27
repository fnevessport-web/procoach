import { useState } from 'react'
import { format, addDays, subDays, isAfter, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, UserPlus, Pencil, Check, X, AlertTriangle } from 'lucide-react'
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

const toastStyle = {
  background: '#1a1a1a', color: '#F0F2F5',
  border: '1px solid rgba(252,200,37,0.3)',
  borderRadius: '10px', fontSize: '13px',
}

const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: '8px',
  backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
  color: '#F0F2F5', fontSize: '12px', outline: 'none', boxSizing: 'border-box',
}

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

// Verifica se a data da aula é futura (depois de hoje)
function isAulaFutura(dataAula) {
  const hoje = startOfDay(new Date())
  const diaAula = startOfDay(new Date(dataAula + 'T12:00:00'))
  return isAfter(diaAula, hoje)
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
  const [statusLocal, setStatusLocal] = useState({})
  // Alerta de nível: { [alunoId]: { open, nivel, obs } }
  const [alertaNivel, setAlertaNivel] = useState({})

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
  const horarios = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)
  const isFuturo = isAulaFutura(data)

  function navData(dir) {
    const d = dir > 0 ? addDays(dataObj, 1) : subDays(dataObj, 1)
    setData(format(d, 'yyyy-MM-dd'))
    setStatusLocal({})
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
        alerta_nivel: p.alunos?.alerta_nivel || false,
        nivel_avaliado_prof: p.alunos?.nivel_avaliado_prof || '',
        obs_nivel_prof: p.alunos?.obs_nivel_prof || '',
      }
    })
    setPresencasLocal(prev => ({ ...prev, [aula.id]: inicial }))
  }

  function fecharModal() {
    setAulaModal(null)
    setEditandoAula(null)
    setAdicionandoAluno(null)
    setBuscaAdicionando('')
    setAlertaNivel({})
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
        [aluno.id]: { aluno_id: aluno.id, nome: aluno.nome, status_presenca: 'presente', tipo_participacao: 'avulso', alerta_nivel: false, nivel_avaliado_prof: '', obs_nivel_prof: '' }
      }
    }))
    setAdicionandoAluno(null)
    setBuscaAdicionando('')
  }

  function toggleAlertaNivel(alunoId, alunoData) {
    setAlertaNivel(prev => ({
      ...prev,
      [alunoId]: prev[alunoId]
        ? null
        : { nivel: alunoData.nivel_avaliado_prof || '', obs: alunoData.obs_nivel_prof || '' }
    }))
  }

  async function handleSalvarAlertaNivel(aulaId, alunoId) {
    const alerta = alertaNivel[alunoId]
    if (!alerta) return
    try {
      const { error } = await supabase
        .from('alunos')
        .update({
          alerta_nivel: true,
          nivel_avaliado_prof: alerta.nivel,
          obs_nivel_prof: alerta.obs,
        })
        .eq('id', alunoId)
      if (error) throw error
      // Atualiza local
      updatePresenca(aulaId, alunoId, 'alerta_nivel', true)
      updatePresenca(aulaId, alunoId, 'nivel_avaliado_prof', alerta.nivel)
      updatePresenca(aulaId, alunoId, 'obs_nivel_prof', alerta.obs)
      setAlertaNivel(prev => ({ ...prev, [alunoId]: null }))
      toast.success('⚠️ Alerta de nível salvo!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleRemoverAlertaNivel(aulaId, alunoId) {
    try {
      const { error } = await supabase
        .from('alunos')
        .update({ alerta_nivel: false, nivel_avaliado_prof: null, obs_nivel_prof: null })
        .eq('id', alunoId)
      if (error) throw error
      updatePresenca(aulaId, alunoId, 'alerta_nivel', false)
      updatePresenca(aulaId, alunoId, 'nivel_avaliado_prof', '')
      updatePresenca(aulaId, alunoId, 'obs_nivel_prof', '')
      setAlertaNivel(prev => ({ ...prev, [alunoId]: null }))
      toast.success('Alerta removido!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleSalvarPresencas(aulaId) {
    const lista = Object.values(presencasLocal[aulaId] || {})
    if (!lista.length) return toast.error('Nenhum aluno na lista', { style: toastStyle })
    try {
      await salvarPresencas.mutateAsync({ aulaId, presencas: lista })
      toast.success('✅ Presenças salvas!', { style: toastStyle })
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  async function handleStatusAula(aulaId, statusAula) {
    if (isFuturo) return toast.error('Aula futura — aguarde o dia da aula', { style: toastStyle })
    const pagaProfessor = STATUS_AULA.find(s => s.value === statusAula)?.paga ?? true
    setStatusLocal(prev => ({ ...prev, [aulaId]: statusAula }))
    try {
      await atualizarStatus.mutateAsync({ aulaId, statusAula, pagaProfessor })
      toast.success('Status atualizado!', { style: toastStyle })
    } catch (err) {
      setStatusLocal(prev => ({ ...prev, [aulaId]: undefined }))
      toast.error(err.message, { style: toastStyle })
    }
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
      toast.success('Aula atualizada!', { style: toastStyle })
      setEditandoAula(null)
    } catch (err) { toast.error(err.message, { style: toastStyle }) }
  }

  const aulasFiltradas = aulas?.filter(a => {
    if (!modalidadeSelecionada) return true
    if (!a.turma_id) return true
    return a.turmas?.modalidades?.nome === modalidadeSelecionada.nome
  }) || []

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

  const horariosGrade = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

  const totalAulas = aulasFiltradas.length
  const aulasDadas = aulasFiltradas.filter(a => !isAulaFutura(a.data_aula) && (statusLocal[a.id] || a.status_aula || 'dada') === 'dada').length
  const aulasNaoDadas = aulasFiltradas.filter(a => (statusLocal[a.id] || a.status_aula) === 'nao_dada').length
  const aulasCanceladas = aulasFiltradas.filter(a => (statusLocal[a.id] || a.status_aula) === 'cancelada').length
  let totalPresentes = 0, totalFaltas = 0
  aulasFiltradas.forEach(aula => {
    aula.presencas?.forEach(p => {
      if (p.status_presenca === 'presente' || p.presente) totalPresentes++
      else if (p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada') totalFaltas++
    })
  })

  const aula = aulaModal
  const presencas = aula ? (presencasLocal[aula.id] || {}) : {}
  const alunosNaAula = Object.values(presencas)
  const idsNaAula = Object.keys(presencas)
  const aulaFutura = aula ? isAulaFutura(aula.data_aula) : false
  const statusAtual = aula
    ? (aulaFutura ? 'futura' : (statusLocal[aula.id] || aula.status_aula || 'dada'))
    : 'dada'
  const isAvulsa = aula ? !aula.turma_id : false
  const estaEditando = aula ? editandoAula === aula.id : false
  const alunosBusca = buscaAdicionando.length >= 1
    ? todosAlunos?.filter(a => a.nome.toLowerCase().includes(buscaAdicionando.toLowerCase()) && !idsNaAula.includes(a.id))
    : []

  // Verifica se há aluno com alerta na aula
  function temAlertaNivel(aulaCelula) {
    return aulaCelula.presencas?.some(p => p.alunos?.alerta_nivel)
  }

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

      {/* Aviso dia futuro */}
      {isFuturo && (
        <div style={{
          backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.2)',
          borderRadius: '10px', padding: '8px 14px', marginBottom: '12px',
          fontSize: '12px', color: '#fcc825', textAlign: 'center',
        }}>
          📅 Aulas futuras — status bloqueado até o dia da aula
        </div>
      )}

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
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ minWidth: `${50 + quadrasUnicas.length * 140}px` }}>

            {/* Cabeçalho quadras */}
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

            {/* Grade */}
            {horariosGrade.map(horario => (
              <div key={horario} style={{ display: 'flex', marginBottom: '4px', alignItems: 'stretch' }}>
                <div style={{
                  width: '50px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '600', color: '#555',
                  backgroundColor: '#151515', borderRadius: '8px', marginRight: '4px',
                }}>{horario}</div>

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

                  const aulaEhFutura = isAulaFutura(aulaCelula.data_aula)
                  const st = aulaEhFutura ? 'futura' : (statusLocal[aulaCelula.id] || aulaCelula.status_aula || 'dada')
                  const nivel = getNivel(aulaCelula)
                  const qtdTotal = aulaCelula.presencas?.length || 0
                  const qtdP = aulaCelula.presencas?.filter(p => p.status_presenca === 'presente' || p.presente).length || 0
                  const qtdF = aulaCelula.presencas?.filter(p => p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada').length || 0
                  const isAv = !aulaCelula.turma_id
                  const hasAlerta = temAlertaNivel(aulaCelula)

                  const borderColor = st === 'futura' ? 'rgba(255,255,255,0.06)'
                    : st === 'dada' ? 'rgba(34,197,94,0.3)'
                    : st === 'nao_dada' ? 'rgba(239,68,68,0.3)'
                    : 'rgba(59,130,246,0.3)'
                  const dotColor = st === 'futura' ? '#333'
                    : st === 'dada' ? '#22c55e'
                    : st === 'nao_dada' ? '#EF4444'
                    : '#3b82f6'

                  return (
                    <button key={quadra}
                      onClick={() => abrirAula(aulaCelula)}
                      style={{
                        width: '140px', flexShrink: 0, marginRight: '4px',
                        backgroundColor: aulaEhFutura ? '#131313' : '#1a1a1a',
                        borderRadius: '10px', border: `1px solid ${borderColor}`,
                        padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
                        minHeight: '72px', boxSizing: 'border-box',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      }}
                    >
                      {/* Topo: badge + dot + alerta */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        {isAv
                          ? <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(252,200,37,0.15)', color: '#fcc825' }}>avulsa</span>
                          : <span />
                        }
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
                          {hasAlerta && <span style={{ fontSize: '9px' }}>⚠️</span>}
                        </div>
                      </div>

                      <div style={{ fontSize: '11px', fontWeight: '600', color: aulaEhFutura ? '#444' : '#F0F2F5', lineHeight: '1.3', marginBottom: '4px' }}>
                        {nivel || (isAv ? 'Avulsa' : aulaCelula.turmas?.nome || '—')}
                      </div>
                      <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {aulaCelula.professores?.nome?.split(' ')[0]}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {aulaEhFutura
                          ? <span style={{ fontSize: '10px', color: '#333' }}>📅 agendada</span>
                          : <>
                            <span style={{ fontSize: '10px', color: '#888' }}><b>T</b>{qtdTotal}</span>
                            {qtdP > 0 && <span style={{ fontSize: '10px', color: '#22c55e' }}>✓{qtdP}</span>}
                            {qtdF > 0 && <span style={{ fontSize: '10px', color: '#EF4444' }}>✗{qtdF}</span>}
                          </>
                        }
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {aulaModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-end',
        }} onClick={fecharModal}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxHeight: '90vh', overflowY: 'auto',
            backgroundColor: '#1a1a1a', borderRadius: '20px 20px 0 0',
            padding: '20px 16px', boxSizing: 'border-box',
          }}>
            <div style={{ width: '40px', height: '4px', backgroundColor: '#333', borderRadius: '2px', margin: '0 auto 16px' }} />

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

            {/* Aviso aula futura no modal */}
            {aulaFutura && (
              <div style={{
                backgroundColor: 'rgba(252,200,37,0.08)', border: '1px solid rgba(252,200,37,0.2)',
                borderRadius: '10px', padding: '10px 14px', marginBottom: '14px',
                fontSize: '12px', color: '#fcc825',
              }}>
                📅 Aula agendada para o futuro — status e presenças disponíveis no dia da aula.
              </div>
            )}

            {isAvulsa && !aulaFutura && (
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
                      <input type="date" value={editForm.data_aula} onChange={e => setEditForm(f => ({ ...f, data_aula: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Horário</div>
                      <select value={editForm.horario} onChange={e => setEditForm(f => ({ ...f, horario: e.target.value }))} style={inputStyle}>
                        {horarios.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Quadra</div>
                      <select value={editForm.quadra_nome} onChange={e => setEditForm(f => ({ ...f, quadra_nome: e.target.value }))} style={inputStyle}>
                        <option value="">Selecione...</option>
                        {todasQuadras?.map(q => <option key={q.id} value={q.nome}>{q.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Nível</div>
                      <select value={editForm.nivel} onChange={e => setEditForm(f => ({ ...f, nivel: e.target.value }))} style={inputStyle}>
                        <option value="">Sem nível</option>
                        {todosNiveis?.map(n => <option key={n.id} value={n.nome}>{n.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Professor</div>
                      <select value={editForm.professor_id} onChange={e => setEditForm(f => ({ ...f, professor_id: e.target.value }))} style={inputStyle}>
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

            {/* Status — bloqueado se futuro */}
            {!aulaFutura && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status da Aula</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {STATUS_AULA.map(s => (
                    <button key={s.value} onClick={() => handleStatusAula(aula.id, s.value)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none',
                      fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                      background: statusAtual === s.value ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#111',
                      color: statusAtual === s.value ? 'white' : '#555',
                      boxSizing: 'border-box', transition: 'all 0.15s',
                    }}>{s.label}</button>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '6px' }}>
                  💰 Professor: <span style={{ color: aula.paga_professor ? '#22c55e' : '#EF4444' }}>
                    {aula.paga_professor ? 'Aula paga' : 'Aula não paga'}
                  </span>
                </div>
              </div>
            )}

            {/* Presenças */}
            <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Presenças ({alunosNaAula.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {alunosNaAula.map(aluno => {
                const temAlerta = aluno.alerta_nivel
                const alertaAberto = alertaNivel[aluno.aluno_id]
                return (
                  <div key={aluno.aluno_id} style={{
                    backgroundColor: '#111', borderRadius: '10px', padding: '10px 12px', boxSizing: 'border-box',
                    border: temAlerta ? '1px solid rgba(252,200,37,0.25)' : '1px solid transparent',
                  }}>
                    {/* Nome + tipo + botão alerta */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontSize: '13px', fontWeight: '500',
                          color: '#F0F2F5',
                          backgroundColor: temAlerta ? 'rgba(252,200,37,0.12)' : 'transparent',
                          borderRadius: '4px', padding: temAlerta ? '1px 6px' : '0',
                          textDecoration: temAlerta ? 'underline' : 'none',
                          textDecorationColor: '#fcc825',
                          textDecorationStyle: 'dotted',
                        }}>{aluno.nome}</span>
                        {temAlerta && <span style={{ fontSize: '11px' }}>⚠️</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => toggleAlertaNivel(aluno.aluno_id, aluno)}
                          title="Alerta de nível"
                          style={{
                            padding: '3px 6px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px',
                            backgroundColor: temAlerta ? 'rgba(252,200,37,0.15)' : '#1a1a1a',
                            color: temAlerta ? '#fcc825' : '#555',
                          }}>
                          <AlertTriangle size={12} />
                        </button>
                        <select value={aluno.tipo_participacao} onChange={e => updatePresenca(aula.id, aluno.aluno_id, 'tipo_participacao', e.target.value)}
                          style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer', outline: 'none' }}>
                          {TIPO_PARTICIPACAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Painel alerta de nível */}
                    {alertaAberto && (
                      <div style={{
                        backgroundColor: '#1a1a1a', borderRadius: '8px',
                        border: '1px solid rgba(252,200,37,0.2)', padding: '10px',
                        marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px',
                      }}>
                        <div style={{ fontSize: '11px', color: '#fcc825', fontWeight: '600' }}>⚠️ Avaliação de Nível pelo Professor</div>
                        <div>
                          <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px' }}>Nível real avaliado</div>
                          <select
                            value={alertaAberto.nivel}
                            onChange={e => setAlertaNivel(prev => ({ ...prev, [aluno.aluno_id]: { ...prev[aluno.aluno_id], nivel: e.target.value } }))}
                            style={{ ...inputStyle, fontSize: '12px' }}>
                            <option value="">Selecione o nível real...</option>
                            {todosNiveis?.map(n => <option key={n.id} value={n.nome}>{n.nome}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px' }}>Observação do professor</div>
                          <textarea
                            placeholder="Ex: Aluno está abaixo do nível da turma, recomendo turma Iniciante 1..."
                            value={alertaAberto.obs}
                            onChange={e => setAlertaNivel(prev => ({ ...prev, [aluno.aluno_id]: { ...prev[aluno.aluno_id], obs: e.target.value } }))}
                            rows={3}
                            style={{ ...inputStyle, resize: 'none', fontSize: '12px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {temAlerta && (
                            <button onClick={() => handleRemoverAlertaNivel(aula.id, aluno.aluno_id)} style={{
                              flex: 1, padding: '7px', borderRadius: '8px',
                              border: '1px solid rgba(239,68,68,0.3)', background: 'none',
                              color: '#EF4444', fontSize: '11px', cursor: 'pointer',
                            }}>Remover alerta</button>
                          )}
                          <button onClick={() => setAlertaNivel(prev => ({ ...prev, [aluno.aluno_id]: null }))} style={{
                            flex: 1, padding: '7px', borderRadius: '8px',
                            border: '1px solid #2a2a2a', background: 'none',
                            color: '#555', fontSize: '11px', cursor: 'pointer',
                          }}>Cancelar</button>
                          <button onClick={() => handleSalvarAlertaNivel(aula.id, aluno.aluno_id)} style={{
                            flex: 2, padding: '7px', borderRadius: '8px', border: 'none',
                            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                            color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                          }}>Salvar alerta</button>
                        </div>
                      </div>
                    )}

                    {/* Presença já salva — exibe obs se tiver */}
                    {temAlerta && !alertaAberto && aluno.obs_nivel_prof && (
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '6px', fontStyle: 'italic' }}>
                        📝 {aluno.nivel_avaliado_prof && <span style={{ color: '#fcc825' }}>{aluno.nivel_avaliado_prof} · </span>}
                        {aluno.obs_nivel_prof}
                      </div>
                    )}

                    {/* Botões presença — bloqueados se futuro */}
                    {!aulaFutura && (
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
                    )}
                  </div>
                )
              })}
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

            {/* Salvar — bloqueado se futuro */}
            {!aulaFutura && (
              <button onClick={() => handleSalvarPresencas(aula.id)} disabled={salvarPresencas.isPending} style={{
                marginTop: '12px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box',
              }}>
                {salvarPresencas.isPending ? 'Salvando...' : '💾 Salvar Presenças'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}