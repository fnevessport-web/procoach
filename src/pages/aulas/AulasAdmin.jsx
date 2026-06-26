import { useState } from 'react'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Calendar, UserPlus, X } from 'lucide-react'
import { useAulas, useGerarAulas } from '../../hooks/useAulas'
import { useTurmas } from '../../hooks/useTurmas'
import { useProfessores } from '../../hooks/useProfessores'
import { useAlunos, useSalvarAluno } from '../../hooks/useAlunos'
import { useQuadras } from '../../hooks/useQuadras'
import { useNiveis } from '../../hooks/useNiveis'
import { useModalidades } from '../../hooks/useModalidades'
import { StatusBadge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { Loading, EmptyState } from '../../components/ui/Loading'
import { AulasCoordenador } from './AulasCoordenador'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

const TIPOS_PARTICIPACAO = [
  { value: 'mensalista', label: 'Mensalista', color: '#22c55e' },
  { value: 'avulso', label: 'Avulso', color: '#fcc825' },
  { value: 'cortesia', label: 'Cortesia', color: '#cf1b9b' },
  { value: 'reposicao', label: 'Reposição', color: '#3b82f6' },
]

export function AulasAdmin() {
  const [tab, setTab] = useState('hoje')
  const [modalGerar, setModalGerar] = useState(false)
  const [modalAvulsa, setModalAvulsa] = useState(false)

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>
          Gestão de Aulas
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setModalAvulsa(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '10px', border: '1px solid #2a2a2a',
              backgroundColor: '#1a1a1a',
              color: '#F0F2F5', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Aula Avulsa
          </button>
          <button
            onClick={() => setModalGerar(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
              color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            <Calendar size={14} /> Gerar Aulas
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: '4px', marginBottom: '20px',
        padding: '4px', backgroundColor: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px',
      }}>
        {[
          { key: 'hoje', label: 'Por Dia' },
          { key: 'divergencias', label: '🔴 Divergências' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
            fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            background: tab === t.key ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : 'transparent',
            color: tab === t.key ? 'white' : '#555', transition: 'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'hoje' ? <AulasCoordenador /> : <AulasDivergencias />}
      <ModalGerarAulas open={modalGerar} onClose={() => setModalGerar(false)} />
      <ModalAulaAvulsa open={modalAvulsa} onClose={() => setModalAvulsa(false)} />
    </div>
  )
}

function AulasDivergencias() {
  const { data: aulas, isLoading } = useAulas({ status: 'divergencia' })
  if (isLoading) return <Loading />
  if (!aulas?.length) return (
    <EmptyState icon="✅" title="Nenhuma divergência" description="Todas as aulas estão com match!" />
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {aulas.map(aula => (
        <div key={aula.id} style={{
          backgroundColor: '#1a1a1a', borderRadius: '12px',
          border: '1px solid rgba(239,68,68,0.3)', padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span>{aula.turmas?.modalidades?.icone_emoji}</span>
                <span style={{ fontWeight: '600', color: '#F0F2F5', fontSize: '14px' }}>{aula.turmas?.nome}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#555' }}>
                {format(new Date(aula.data_aula + 'T12:00'), "dd/MM/yyyy", { locale: ptBR })} •
                Prof: {aula.professores?.nome}
              </div>
            </div>
            <StatusBadge status={aula.status} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ModalGerarAulas({ open, onClose }) {
  const { data: turmas } = useTurmas()
  const gerar = useGerarAulas()
  const [form, setForm] = useState({
    turma_id: '', professor_id: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  })
  const [resultado, setResultado] = useState(null)

  const turmaSelecionada = turmas?.find(t => t.id === form.turma_id)
  const { professores } = useProfessores(turmaSelecionada?.modalidade_id)

  function handleTurmaChange(turma_id) {
    const turma = turmas?.find(t => t.id === turma_id)
    setForm(f => ({ ...f, turma_id, professor_id: turma?.professor_titular_id || '' }))
  }

  async function handleGerar() {
    try {
      const n = await gerar.mutateAsync({
        turmaId: form.turma_id,
        dataInicio: form.data_inicio,
        dataFim: form.data_fim,
        professorOverrideId: form.professor_id || null,
      })
      setResultado(n)
    } catch (err) { toast.error(err.message) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Gerar Aulas" size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {resultado !== null ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
            <div style={{ fontWeight: '600', color: '#F0F2F5' }}>{resultado} aulas geradas!</div>
            <button onClick={() => { onClose(); setResultado(null) }} style={{
              marginTop: '16px', width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
              color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            }}>Fechar</button>
          </div>
        ) : (
          <>
            <Select label="Turma" value={form.turma_id} onChange={e => handleTurmaChange(e.target.value)}>
              <option value="">Selecione a turma</option>
              {turmas?.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Select>
            <Select label="Professor (opcional — substitui o titular)" value={form.professor_id}
              onChange={e => setForm(f => ({ ...f, professor_id: e.target.value }))}>
              <option value="">Professor titular da turma</option>
              {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
            <Input label="Data Início" type="date" value={form.data_inicio}
              onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            <Input label="Data Fim" type="date" value={form.data_fim}
              onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
            <button onClick={handleGerar} disabled={gerar.isPending || !form.turma_id} style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
              color: 'white', fontSize: '14px', fontWeight: '600',
              cursor: !form.turma_id ? 'not-allowed' : 'pointer',
              opacity: !form.turma_id ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <Calendar size={16} />
              {gerar.isPending ? 'Gerando...' : 'Gerar Aulas'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

function ModalAulaAvulsa({ open, onClose }) {
  const qc = useQueryClient()
  const { data: modalidades } = useModalidades()
  const { data: todosAlunos } = useAlunos()
  const salvarAluno = useSalvarAluno()

  const [modalidadeId, setModalidadeId] = useState('')
  const { professores } = useProfessores(modalidadeId || null)
  const { data: quadras } = useQuadras(modalidadeId || null)
  const { data: niveis } = useNiveis(modalidadeId || null)

  const [form, setForm] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    horario: '07:00',
    professor_id: '',
    quadra_id: '',
    nivel_id: '',
    tipo_aula: 'avulsa', // 'avulsa' ou 'mensal'
    data_fim: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  })

  const [alunos, setAlunos] = useState([]) // [{aluno_id, nome, tipo}]
  const [buscaAluno, setBuscaAluno] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [novoAluno, setNovoAluno] = useState({ show: false, nome: '', telefone: '' })

  const horarios = Array.from({ length: 18 }, (_, i) => {
    const h = String(6 + i).padStart(2, '0')
    return `${h}:00`
  })

  const alunosFiltrados = buscaAluno.length >= 1
    ? todosAlunos?.filter(a =>
        a.nome.toLowerCase().includes(buscaAluno.toLowerCase()) &&
        !alunos.find(al => al.aluno_id === a.id)
      )
    : []

  function adicionarAluno(aluno, tipo = 'avulso') {
    setAlunos(prev => [...prev, { aluno_id: aluno.id, nome: aluno.nome, tipo }])
    setBuscaAluno('')
  }

  function removerAluno(alunoId) {
    setAlunos(prev => prev.filter(a => a.aluno_id !== alunoId))
  }

  function updateTipoAluno(alunoId, tipo) {
    setAlunos(prev => prev.map(a => a.aluno_id === alunoId ? { ...a, tipo } : a))
  }

  async function handleCadastrarAluno() {
    if (!novoAluno.nome.trim()) return toast.error('Nome obrigatório')
    try {
      const result = await salvarAluno.mutateAsync({
        nome: novoAluno.nome,
        telefone: novoAluno.telefone,
        modalidade_id: modalidadeId || null,
      })
      adicionarAluno({ id: result.id, nome: result.nome }, 'avulso')
      setNovoAluno({ show: false, nome: '', telefone: '' })
      toast.success('Aluno cadastrado!')
    } catch (err) { toast.error(err.message) }
  }

  async function handleSalvar() {
    if (!form.professor_id) return toast.error('Selecione um professor')
    if (!form.quadra_id) return toast.error('Selecione uma quadra')
    if (!form.data) return toast.error('Selecione uma data')
    if (alunos.length === 0) return toast.error('Adicione pelo menos um aluno')

    setSalvando(true)
    try {
      const horarioFim = `${String(parseInt(form.horario) + 1).padStart(2, '0')}:00`

      // Buscar ou criar turma avulsa
      const nomeTurma = `Avulsa · ${form.data} · ${form.horario}`

      // Inserir aula diretamente
      const { data: aulaData, error: aulaError } = await supabase
        .from('aulas')
        .insert({
          professor_executou_id: form.professor_id,
          data_aula: form.data,
          status: 'confirmada_coord',
          status_aula: 'dada',
          paga_professor: true,
          eh_substituicao: false,
          observacoes: `Aula avulsa · Quadra: ${quadras?.find(q => q.id === form.quadra_id)?.nome} · ${form.horario}`,
        })
        .select()
        .single()

      if (aulaError) throw aulaError

      // Inserir presenças
      if (alunos.length > 0) {
        await supabase.from('presencas').insert(
          alunos.map(al => ({
            aula_id: aulaData.id,
            aluno_id: al.aluno_id,
            presente: true,
            status_presenca: 'presente',
            tipo_participacao: al.tipo,
          }))
        )
      }

      qc.invalidateQueries({ queryKey: ['aulas'] })
      toast.success('Aula avulsa criada!')
      onClose()
      // Reset
      setAlunos([])
      setForm({
        data: format(new Date(), 'yyyy-MM-dd'),
        horario: '07:00', professor_id: '', quadra_id: '', nivel_id: '',
        tipo_aula: 'avulsa', data_fim: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Incluir Aula Avulsa" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Tipo de aula */}
        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Tipo de Aula</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { value: 'avulsa', label: '⚡ Aula Avulsa' },
              { value: 'mensal', label: '📅 Mensal' },
            ].map(t => (
              <button key={t.value} onClick={() => setForm(f => ({ ...f, tipo_aula: t.value }))} style={{
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                background: form.tipo_aula === t.value ? 'linear-gradient(135deg, #fcc825, #cf1b9b)' : '#110f0f',
                outline: form.tipo_aula === t.value ? 'none' : '1px solid #2a2a2a',
                color: form.tipo_aula === t.value ? 'white' : '#888',
                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Modalidade */}
        <Select label="Modalidade" value={modalidadeId} onChange={e => setModalidadeId(e.target.value)}>
          <option value="">Selecione...</option>
          {modalidades?.map(m => <option key={m.id} value={m.id}>{m.icone_emoji} {m.nome}</option>)}
        </Select>

        {/* Data */}
        <Input label="Data da Aula" type="date" value={form.data}
          onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />

        {/* Data fim só se mensal */}
        {form.tipo_aula === 'mensal' && (
          <Input label="Data Fim" type="date" value={form.data_fim}
            onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
        )}

        {/* Horário */}
        <Select label="Horário" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}>
          {horarios.map(h => <option key={h} value={h}>{h}</option>)}
        </Select>

        {/* Quadra */}
        <Select label="Quadra" value={form.quadra_id} onChange={e => setForm(f => ({ ...f, quadra_id: e.target.value }))}>
          <option value="">Selecione...</option>
          {quadras?.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
        </Select>

        {/* Professor */}
        <Select label="Professor" value={form.professor_id} onChange={e => setForm(f => ({ ...f, professor_id: e.target.value }))}>
          <option value="">Selecione...</option>
          {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Select>

        {/* Alunos */}
        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
            Alunos ({alunos.length})
          </div>

          {/* Lista de alunos adicionados */}
          {alunos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {alunos.map(al => (
                <div key={al.aluno_id} style={{
                  backgroundColor: '#110f0f', borderRadius: '10px',
                  padding: '10px 12px', border: '1px solid #2a2a2a',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                }}>
                  <span style={{ fontSize: '13px', color: '#F0F2F5', flex: 1 }}>{al.nome}</span>
                  <select
                    value={al.tipo}
                    onChange={e => updateTipoAluno(al.aluno_id, e.target.value)}
                    style={{
                      fontSize: '11px', padding: '3px 6px', borderRadius: '6px',
                      backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                      color: TIPOS_PARTICIPACAO.find(t => t.value === al.tipo)?.color || '#888',
                      cursor: 'pointer', outline: 'none',
                    }}
                  >
                    {TIPOS_PARTICIPACAO.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <button onClick={() => removerAluno(al.aluno_id)} style={{
                    padding: '4px', borderRadius: '6px', border: 'none',
                    backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer',
                  }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Buscar aluno */}
          <div style={{ position: 'relative' }}>
            <input
              placeholder="Buscar aluno para adicionar..."
              value={buscaAluno}
              onChange={e => setBuscaAluno(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                backgroundColor: '#110f0f', border: '1px solid #2a2a2a',
                color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = '#fcc825'}
              onBlur={e => e.target.style.borderColor = '#2a2a2a'}
            />
            {alunosFiltrados.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                borderRadius: '10px', marginTop: '4px', maxHeight: '160px', overflowY: 'auto',
              }}>
                {alunosFiltrados.map(a => (
                  <button key={a.id} onClick={() => adicionarAluno(a)} style={{
                    width: '100%', padding: '10px 12px', border: 'none', background: 'none',
                    color: '#F0F2F5', fontSize: '13px', textAlign: 'left', cursor: 'pointer',
                    borderBottom: '1px solid #2a2a2a',
                  }}
                    onMouseEnter={e => e.target.style.backgroundColor = '#2a2a2a'}
                    onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
                  >
                    {a.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cadastrar novo aluno */}
          {!novoAluno.show ? (
            <button onClick={() => setNovoAluno(n => ({ ...n, show: true }))} style={{
              marginTop: '8px', width: '100%', padding: '8px', borderRadius: '8px',
              border: '1px dashed #2a2a2a', background: 'none',
              color: '#555', fontSize: '12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              <UserPlus size={13} /> Cadastrar novo aluno
            </button>
          ) : (
            <div style={{
              marginTop: '8px', padding: '12px', borderRadius: '10px',
              backgroundColor: '#110f0f', border: '1px solid #2a2a2a',
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <div style={{ fontSize: '12px', color: '#fcc825', marginBottom: '4px' }}>
                Novo Aluno
              </div>
              <input
                placeholder="Nome completo *"
                value={novoAluno.nome}
                onChange={e => setNovoAluno(n => ({ ...n, nome: e.target.value }))}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px',
                  backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                  color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <input
                placeholder="Telefone (WhatsApp)"
                value={novoAluno.telefone}
                onChange={e => setNovoAluno(n => ({ ...n, telefone: e.target.value }))}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px',
                  backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
                  color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setNovoAluno({ show: false, nome: '', telefone: '' })} style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #2a2a2a',
                  background: 'none', color: '#888', fontSize: '12px', cursor: 'pointer',
                }}>Cancelar</button>
                <button onClick={handleCadastrarAluno} style={{
                  flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                  background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                  color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                }}>Cadastrar e Adicionar</button>
              </div>
            </div>
          )}
        </div>

        {/* Botão salvar */}
        <button onClick={handleSalvar} disabled={salvando} style={{
          width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
          background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
          color: 'white', fontSize: '14px', fontWeight: '600',
          cursor: salvando ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          marginTop: '4px',
        }}>
          <Plus size={16} />
          {salvando ? 'Salvando...' : 'Criar Aula Avulsa'}
        </button>
      </div>
    </Modal>
  )
}