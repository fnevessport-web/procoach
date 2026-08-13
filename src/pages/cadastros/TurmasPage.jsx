import { useState } from 'react'
import { Plus, Edit2, Clock, Users, School, Search, TriangleAlert, Target, LandPlot, User } from 'lucide-react'
import { useTurmas, useSalvarTurma } from '../../hooks/useTurmas'
import { useProfessores } from '../../hooks/useProfessores'
import { useNiveis } from '../../hooks/useNiveis'
import { useQuadras } from '../../hooks/useQuadras'
import { useAlunos } from '../../hooks/useAlunos'
import { useModalidades } from '../../hooks/useModalidades'
import useAppStore from '../../store/useAppStore'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Input'
import { Loading, EmptyState } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

const diasSemana = [
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terca', label: 'Terça-feira' },
  { value: 'quarta', label: 'Quarta-feira' },
  { value: 'quinta', label: 'Quinta-feira' },
  { value: 'sexta', label: 'Sexta-feira' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
]

function formInicial() {
  return {
    modalidade_id: '', nivel_id: '', quadra_id: '', professor_titular_id: ''
  }
}

export function TurmasPage({ onIrParaProfessores }) {
  const { modalidadeSelecionada } = useAppStore()
  const { data: turmas, isLoading } = useTurmas(modalidadeSelecionada?.id)
  const { data: modalidades } = useModalidades()
  const { data: alunos } = useAlunos()
  const salvar = useSalvarTurma()

  const [busca, setBusca] = useState('')
  const [buscaAluno, setBuscaAluno] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(formInicial())
  const [alunosSelecionados, setAlunosSelecionados] = useState([])

  const modalidadeId = form.modalidade_id || null
  const { professores } = useProfessores(modalidadeId)
  const { data: niveis } = useNiveis(modalidadeId)
  const { data: quadras } = useQuadras(modalidadeId)

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function updateModalidade(v) {
    setForm(f => ({ ...f, modalidade_id: v, nivel_id: '', quadra_id: '', professor_titular_id: '' }))
  }

  function abrirCriar() {
    setEditando(null)
    setForm(formInicial())
    setAlunosSelecionados([])
    setBuscaAluno('')
    setModal(true)
  }

  function abrirEditar(turma) {
    setEditando(turma)
    setForm({
      modalidade_id: turma.modalidade_id || '',
      nivel_id: turma.nivel_id || '',
      quadra_id: turma.quadra_id || '',
      professor_titular_id: turma.professor_titular_id || '',
    })
    const idsAtivos = turma.turmas_alunos?.filter(ta => ta.ativo).map(ta => ta.aluno_id) || []
    setAlunosSelecionados(idsAtivos)
    setBuscaAluno('')
    setModal(true)
  }

  function toggleAluno(id) {
    setAlunosSelecionados(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  async function handleSalvar() {
    // Dia/horário não são mais editados aqui — turma nasce "não posicionada" e ganha isso ao
    // ser posicionada na grade (ver AulasAdmin.jsx). Editando uma turma que já está posicionada,
    // o nome continua incluindo o dia/horário dela (lidos de `editando`, não do form) — só nível
    // e quadra podem mudar por aqui, sem apagar o posicionamento já feito.
    const diaLabel = diasSemana.find(d => d.value === editando?.horario_dia_semana)?.label || ''
    const horarioInicio = editando?.horario_inicio?.slice(0, 5) || ''
    const quadraNome = quadras?.find(q => q.id === form.quadra_id)?.nome || ''
    const nivelNome = niveis?.find(n => n.id === form.nivel_id)?.nome || ''
    const nome = [diaLabel, horarioInicio, quadraNome, nivelNome].filter(Boolean).join(' · ')
    try {
      await salvar.mutateAsync({
        id: editando?.id,
        ...form,
        nome,
        alunos_ids: alunosSelecionados
      })
      toast.success(editando ? 'Turma atualizada!' : 'Turma criada!')
      setModal(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const filtradas = turmas?.filter(t =>
    t.nome.toLowerCase().includes(busca.toLowerCase())
  )

  const alunosFiltradosMod = form.modalidade_id
    ? alunos?.filter(a => a.modalidade_id === form.modalidade_id)
    : alunos

  const alunosBusca = buscaAluno.length >= 1
    ? alunosFiltradosMod?.filter(a =>
        a.nome.toLowerCase().includes(buscaAluno.toLowerCase())
      )
    : alunosFiltradosMod

  return (
    <div className="fade-in">
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <div style={{ position: 'relative' }}>
            <input
              placeholder="Buscar turma..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px 10px 36px',
                borderRadius: '10px', backgroundColor: 'var(--color-surface-light-overlay)',
                border: '1px solid var(--color-border-light)', color: 'var(--color-text-light-primary)',
                fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <Search size={14} color="var(--color-text-light-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
        </div>
        <Button onClick={abrirCriar} size="sm">
          <Plus size={16} /> Nova
        </Button>
      </div>

      {isLoading ? <Loading /> : !filtradas?.length ? (
        <EmptyState icon={<School size={40} />} title="Nenhuma turma" action={<Button onClick={abrirCriar}><Plus size={16} /> Criar</Button>} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtradas.map(turma => {
            const alunosAtivos = turma.turmas_alunos?.filter(ta => ta.ativo) || []
            return (
              <Card key={turma.id}>
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[var(--color-text-light-primary)]">{turma.nome}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-light-secondary)]">
                        {turma.professores?.nome
                          ? <span className="flex items-center gap-1"><User size={11} /> {turma.professores.nome}</span>
                          : <span className="flex items-center gap-1" style={{ color: 'var(--color-state-warning)' }}><TriangleAlert size={11} /> sem professor</span>
                        }
                        {turma.horario_dia_semana && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {diasSemana.find(d => d.value === turma.horario_dia_semana)?.label}
                            {turma.horario_inicio && ` ${turma.horario_inicio.slice(0, 5)}`}
                            {turma.horario_fim && `–${turma.horario_fim.slice(0, 5)}`}
                          </span>
                        )}
                        {turma.niveis?.nome && <span className="flex items-center gap-1"><Target size={11} /> {turma.niveis.nome}</span>}
                        {turma.quadras?.nome && <span className="flex items-center gap-1"><LandPlot size={11} /> {turma.quadras.nome}</span>}
                        <span className="flex items-center gap-1">
                          <Users size={11} /> {alunosAtivos.length} alunos
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => abrirEditar(turma)}
                      className="p-1.5 rounded-lg text-[var(--color-text-light-secondary)] hover:text-[var(--color-text-light-primary)] hover:bg-[var(--color-surface-light-overlay)]"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editando ? 'Editar Turma' : 'Nova Turma'}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <Select label="Modalidade" value={form.modalidade_id} onChange={e => updateModalidade(e.target.value)}>
            <option value="">Selecione...</option>
            {modalidades?.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>

          {editando?.horario_dia_semana && (
            <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} />
              Posicionada em {diasSemana.find(d => d.value === editando.horario_dia_semana)?.label}
              {editando.horario_inicio && ` · ${editando.horario_inicio.slice(0, 5)}`}
              {' '}— pra mudar o dia/horário, reposicione na grade de Aulas.
            </div>
          )}

          <Select label="Nível" value={form.nivel_id} onChange={e => update('nivel_id', e.target.value)}>
            <option value="">Selecione...</option>
            {niveis?.map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}
          </Select>

          <Select label="Quadra" value={form.quadra_id} onChange={e => update('quadra_id', e.target.value)}>
            <option value="">Selecione...</option>
            {quadras?.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
          </Select>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Select label="Professor Titular (opcional)" value={form.professor_titular_id} onChange={e => update('professor_titular_id', e.target.value)}>
              <option value="">Sem professor definido ainda</option>
              {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
            {!professores?.length && form.modalidade_id && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', margin: 0 }}>
                Nenhum professor cadastrado.{' '}
                <button
                  type="button"
                  onClick={() => { setModal(false); onIrParaProfessores?.() }}
                  style={{ color: 'var(--color-action-primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                >
                  Cadastrar professor
                </button>
              </p>
            )}
          </div>

          {/* Alunos com busca */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-light-primary)', marginBottom: '8px' }}>
              Alunos ({alunosSelecionados.length} selecionados)
            </div>

            {/* Campo de busca */}
            <input
              placeholder="Digite o nome do aluno..."
              value={buscaAluno}
              onChange={e => setBuscaAluno(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
                color: 'var(--color-text-light-primary)', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box', marginBottom: '8px',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--color-action-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--color-border-light)'}
            />

            {/* Lista filtrada */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {alunosBusca?.map(aluno => (
                <button
                  key={aluno.id}
                  onClick={() => toggleAluno(aluno.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: '10px', border: 'none',
                    background: alunosSelecionados.includes(aluno.id) ? 'rgba(165,76,46,0.1)' : 'var(--color-surface-light-overlay)',
                    outline: alunosSelecionados.includes(aluno.id) ? '1px solid rgba(165,76,46,0.4)' : '1px solid var(--color-border-light)',
                    color: alunosSelecionados.includes(aluno.id) ? 'var(--color-action-primary)' : 'var(--color-text-light-secondary)',
                    cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>{aluno.nome}</span>
                  <span>{alunosSelecionados.includes(aluno.id) ? '✓' : '+'}</span>
                </button>
              ))}
              {buscaAluno && alunosBusca?.length === 0 && (
                <p style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', textAlign: 'center', padding: '8px 0', margin: 0 }}>
                  Nenhum aluno encontrado
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
            <Button variant="secondary" onClick={() => setModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSalvar} loading={salvar.isPending} className="flex-1">
              {editando ? 'Salvar' : 'Criar Turma'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}