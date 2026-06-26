import { useState } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, UserPlus, Pencil, Check } from 'lucide-react'
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
  return {
    quadra: partes[1] || '',
    horario: partes[2] || '',
    nivel: partes[3] || '',
  }
}

export function AulasCoordenador() {
  const { modalidadeSelecionada } = useAppStore()
  const qc = useQueryClient()
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [aulaAberta, setAulaAberta] = useState(null)
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
      const { error } = await supabase
        .from('aulas')
        .update({
          professor_executou_id: editForm.professor_id || null,
          data_aula: editForm.data_aula,
          observacoes: novaObs,
        })
        .eq('id', aula.id)
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
  })

  const totalAulas = aulasFiltradas?.length || 0
  const aulasDadas = aulasFiltradas?.filter(a => (a.status_aula || 'dada') === 'dada').length || 0
  const aulasNaoDadas = aulasFiltradas?.filter(a => a.status_aula === 'nao_dada').length || 0
  const aulasCanceladas = aulasFiltradas?.filter(a => a.status_aula === 'cancelada').length || 0
  let totalPresentes = 0, totalFaltas = 0, totalReposicoes = 0
  aulasFiltradas?.forEach(aula => {
    aula.presencas?.forEach(p => {
      if (p.status_presenca === 'presente' || p.presente) totalPresentes++
      else if (p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada') totalFaltas++
      if (p.tipo_participacao === 'reposicao') totalReposicoes++
    })
  })

  const horarios = Array.from({ length: 18 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`)

  return (
    <div className="fade-in">
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

      {totalAulas > 0 && (
        <div style={{
          backgroundColor: '#151515', border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '10px', padding: '10px 14px', marginBottom: '14px',
          display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'center',
        }}>
          <span style={{ fontSize: '11px', color: '#555' }}>
            <span style={{ color: '#F0F2F5', fontWeight: '600' }}>{totalAulas}</span> aulas
          </span>
          <span style={{ color: '#2a2a2a' }}>·</span>
          <span style={{ fontSize: '11px', color: '#555' }}>
            <span style={{ color: '#22c55e', fontWeight: '600' }}>{aulasDadas}</span> dadas
          </span>
          {aulasNaoDadas > 0 && <>
            <span style={{ color: '#2a2a2a' }}>·</span>
            <span style={{ fontSize: '11px', color: '#555' }}>
              <span style={{ color: '#EF4444', fontWeight: '600' }}>{aulasNaoDadas}</span> não dadas
            </span>
          </>}
          {aulasCanceladas > 0 && <>
            <span style={{ color: '#2a2a2a' }}>·</span>
            <span style={{ fontSize: '11px', color: '#555' }}>
              <span style={{ color: '#3b82f6', fontWeight: '600' }}>{aulasCanceladas}</span> canceladas
            </span>
          </>}
          <span style={{ width: '100%', height: '1px', backgroundColor: '#1e1e1e', margin: '2px 0' }} />
          <span style={{ fontSize: '11px', color: '#555' }}>
            <span style={{ color: '#22c55e', fontWeight: '600' }}>{totalPresentes}</span> presentes
          </span>
          <span style={{ color: '#2a2a2a' }}>·</span>
          <span style={{ fontSize: '11px', color: '#555' }}>
            <span style={{ color: '#EF4444', fontWeight: '600' }}>{totalFaltas}</span> faltas
          </span>
          {totalReposicoes > 0 && <>
            <span style={{ color: '#2a2a2a' }}>·</span>
            <span style={{ fontSize: '11px', color: '#555' }}>
              <span style={{ color: '#3b82f6', fontWeight: '600' }}>{totalReposicoes}</span> reposições
            </span>
          </>}
        </div>
      )}

      {isLoading ? <Loading /> : !aulasFiltradas?.length ? (
        <EmptyState iconImg="/images/totaldeaulas.png" title="Nenhuma aula neste dia" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {aulasFiltradas.map(aula => {
            const aberta = aulaAberta === aula.id
            const presencas = presencasLocal[aula.id] || {}
            const statusAtual = aula.status_aula || 'dada'
            const alunosNaAula = Object.values(presencas)
            const idsNaAula = Object.keys(presencas)
            const isAvulsa = !aula.turma_id
            const estaEditando = editandoAula === aula.id
            const parsed = isAvulsa ? parseObservacoes(aula.observacoes) : {}
            const quadraNome = isAvulsa ? parsed.quadra : (aula.turmas?.quadras?.nome || '')
            const horarioNome = isAvulsa ? parsed.horario : (aula.turmas?.horario_inicio?.slice(0, 5) || '')
            const nivelNome = isAvulsa ? parsed.nivel : (aula.turmas?.niveis?.nome || '')
            const qtdTotal = aula.presencas?.length || 0
            const qtdPresentes = aula.presencas?.filter(p => p.status_presenca === 'presente' || p.presente).length || 0
            const qtdFaltas = aula.presencas?.filter(p => p.status_presenca === 'falta' || p.status_presenca === 'falta_justificada').length || 0

            const alunosBusca = buscaAdicionando.length >= 1
              ? todosAlunos?.filter(a =>
                  a.nome.toLowerCase().includes(buscaAdicionando.toLowerCase()) &&
                  !idsNaAula.includes(a.id)
                )
              : []

            return (
              <div key={aula.id} style={{
                backgroundColor: '#1a1a1a', borderRadius: '14px',
                border: isAvulsa ? '1px solid rgba(252,200,37,0.2)' : '1px solid rgba(255,255,255,0.06)',
                overflow: 'hidden', boxSizing: 'border-box', width: '100%',
              }}>
                <button onClick={() => abrirAula(aula)} style={{
                  width: '100%', padding: '12px 14px', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  boxSizing: 'border-box',
                }}>
                  <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      {isAvulsa && (
                        <span style={{
                          fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                          backgroundColor: 'rgba(252,200,37,0.15)', color: '#fcc825', flexShrink: 0,
                        }}>avulsa</span>
                      )}
                      <span style={{ fontSize: '12px', color: '#fcc825' }}>⚡</span>
                      <span style={{ fontWeight: '600', color: '#F0F2F5', fontSize: '13px' }}>
                        {nivelNome
                          ? nivelNome
                          : (isAvulsa ? 'Avulsa' : aula.turmas?.nome || 'Aula')}
                        {quadraNome ? ` · ${quadraNome}` : ''}
                        {horarioNome ? ` · ${horarioNome}` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#555' }}>Prof: {aula.professores?.nome}</span>
                      <span style={{ fontSize: '11px', color: '#555' }}>·</span>
                      <span style={{ fontSize: '11px', color: '#888' }}>{qtdTotal} aluno{qtdTotal !== 1 ? 's' : ''}</span>
                      {qtdPresentes > 0 && <>
                        <span style={{ fontSize: '11px', color: '#2a2a2a' }}>|</span>
                        <span style={{ fontSize: '11px', color: '#22c55e' }}>✓ {qtdPresentes}</span>
                      </>}
                      {qtdFaltas > 0 && <>
                        <span style={{ fontSize: '11px', color: '#2a2a2a' }}>|</span>
                        <span style={{ fontSize: '11px', color: '#EF4444' }}>✗ {qtdFaltas}</span>
                      </>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '11px', padding: '3px 8px', borderRadius: '6px',
                      backgroundColor: statusAtual === 'dada' ? 'rgba(34,197,94,0.15)' : statusAtual === 'cancelada' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
                      color: statusAtual === 'dada' ? '#22c55e' : statusAtual === 'cancelada' ? '#3b82f6' : '#EF4444',
                    }}>
                      {STATUS_AULA.find(s => s.value === statusAtual)?.label}
                    </span>
                    {aberta ? <ChevronUp size={16} color="#555" /> : <ChevronDown size={16} color="#555" />}
                  </div>
                </button>

                {aberta && (
                  <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>

                    {isAvulsa && (
                      <div style={{ marginTop: '12px', marginBottom: '4px' }}>
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
                              <button onClick={() => setEditandoAula(null)} style={{
                                flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #2a2a2a',
                                background: 'none', color: '#555', fontSize: '12px', cursor: 'pointer',
                              }}>Cancelar</button>
                              <button onClick={() => handleSalvarEdicao(aula)} style={{
                                flex: 2, padding: '8px', borderRadius: '8px', border: 'none',
                                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                                color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                              }}>
                                <Check size={13} /> Salvar edição
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => iniciarEdicao(aula)} style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '8px', border: '1px solid #2a2a2a',
                            background: 'none', color: '#888', fontSize: '12px', cursor: 'pointer',
                          }}>
                            <Pencil size={12} /> Editar aula
                          </button>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: '14px', marginBottom: '14px' }}>
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

                    <button onClick={() => handleSalvarPresencas(aula.id)} disabled={salvarPresencas.isPending} style={{
                      marginTop: '12px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                      background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                      color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box',
                    }}>
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