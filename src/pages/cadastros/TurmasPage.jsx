import { useState } from 'react'
import { Plus, Edit2, Clock, Users } from 'lucide-react'
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
import { Input, Select } from '../../components/ui/Input'
import { SearchBar } from '../../components/ui/SearchBar'
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

const horarios = Array.from({ length: 16 }, (_, i) => {
  const h = String(6 + i).padStart(2, '0')
  return `${h}:00`
})

function calcularFim(inicio) {
  const [h, m] = inicio.split(':').map(Number)
  const total = h * 60 + m + 50
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function formInicial() {
  return {
    modalidade_id: '', horario_dia_semana: '',
    horario_inicio: '', nivel_id: '', quadra_id: '', professor_titular_id: ''
  }
}

export function TurmasPage({ onIrParaProfessores }) {
  const { modalidadeSelecionada } = useAppStore()
  const { data: turmas, isLoading } = useTurmas(modalidadeSelecionada?.id)
  const { data: modalidades } = useModalidades()
  const { data: alunos } = useAlunos()
  const salvar = useSalvarTurma()

  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(formInicial())
  const [alunosSelecionados, setAlunosSelecionados] = useState([])

  const modalidadeId = form.modalidade_id || null
  const { data: professores } = useProfessores(modalidadeId)
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
    setModal(true)
  }

  function abrirEditar(turma) {
    setEditando(turma)
    setForm({
      modalidade_id: turma.modalidade_id || '',
      horario_dia_semana: turma.horario_dia_semana || '',
      horario_inicio: turma.horario_inicio?.slice(0, 5) || '',
      nivel_id: turma.nivel_id || '',
      quadra_id: turma.quadra_id || '',
      professor_titular_id: turma.professor_titular_id || '',
    })
    const idsAtivos = turma.turmas_alunos?.filter(ta => ta.ativo).map(ta => ta.aluno_id) || []
    setAlunosSelecionados(idsAtivos)
    setModal(true)
  }

  function toggleAluno(id) {
    setAlunosSelecionados(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  async function handleSalvar() {
    const diaLabel = diasSemana.find(d => d.value === form.horario_dia_semana)?.label || ''
    const quadraNome = quadras?.find(q => q.id === form.quadra_id)?.nome || ''
    const nivelNome = niveis?.find(n => n.id === form.nivel_id)?.nome || ''
    const nome = [diaLabel, form.horario_inicio, quadraNome, nivelNome].filter(Boolean).join(' · ')
    const horario_fim = form.horario_inicio ? calcularFim(form.horario_inicio) : null
    try {
      await salvar.mutateAsync({
        id: editando?.id,
        ...form,
        nome,
        horario_fim,
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

  return (
    <div className="fade-in">
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar turma..." />
        </div>
        <Button onClick={abrirCriar} size="sm">
          <Plus size={16} /> Nova
        </Button>
      </div>

      {isLoading ? <Loading /> : !filtradas?.length ? (
        <EmptyState icon="🏫" title="Nenhuma turma" action={<Button onClick={abrirCriar}><Plus size={16} /> Criar</Button>} />
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
                        <span>{turma.modalidades?.icone_emoji}</span>
                        <span className="font-semibold text-[#F0F2F5]">{turma.nome}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#8B8FA8]">
                        {turma.professores?.nome && (
                          <span>👨‍🏫 {turma.professores.nome}</span>
                        )}
                        {turma.horario_dia_semana && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {diasSemana.find(d => d.value === turma.horario_dia_semana)?.label}
                            {turma.horario_inicio && ` ${turma.horario_inicio.slice(0, 5)}`}
                            {turma.horario_fim && `–${turma.horario_fim.slice(0, 5)}`}
                          </span>
                        )}
                        {turma.niveis?.nome && <span>🎯 {turma.niveis.nome}</span>}
                        {turma.quadras?.nome && <span>🏟️ {turma.quadras.nome}</span>}
                        <span className="flex items-center gap-1">
                          <Users size={11} /> {alunosAtivos.length} alunos
                        </span>
                      </div>
                    </div>
                    <button onClick={() => abrirEditar(turma)} className="p-1.5 rounded-lg text-[#8B8FA8] hover:text-[#F0F2F5] hover:bg-[#2A2D3E]">
                      <Edit2 size={14} />
                    </button>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Turma' : 'Nova Turma'} size="lg">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Modalidade" value={form.modalidade_id} onChange={e => updateModalidade(e.target.value)}>
              <option value="">Selecione...</option>
              {modalidades?.map(m => <option key={m.id} value={m.id}>{m.icone_emoji} {m.nome}</option>)}
            </Select>

            <Select label="Dia da Semana" value={form.horario_dia_semana} onChange={e => update('horario_dia_semana', e.target.value)}>
              <option value="">Selecione...</option>
              {diasSemana.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </Select>

            <Select label="Horário" value={form.horario_inicio} onChange={e => update('horario_inicio', e.target.value)}>
              <option value="">Selecione...</option>
              {horarios.map(h => <option key={h} value={h}>{h}</option>)}
            </Select>

            <Select label="Nível" value={form.nivel_id} onChange={e => update('nivel_id', e.target.value)}>
              <option value="">Selecione...</option>
              {niveis?.map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}
            </Select>

            <Select label="Quadra" value={form.quadra_id} onChange={e => update('quadra_id', e.target.value)}>
              <option value="">Selecione...</option>
              {quadras?.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
            </Select>

            <div className="flex flex-col gap-1.5">
              <Select label="Professor Titular" value={form.professor_titular_id} onChange={e => update('professor_titular_id', e.target.value)}>
                <option value="">Selecione...</option>
                {professores?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
              {!professores?.length && (
                <p className="text-xs text-[#8B8FA8]">
                  Nenhum professor cadastrado.{' '}
                  <button
                    type="button"
                    onClick={() => { setModal(false); onIrParaProfessores?.() }}
                    className="text-[#00D4AA] underline hover:text-[#00A884]"
                  >
                    Cadastrar professor
                  </button>
                </p>
              )}
            </div>
          </div>

          {alunosFiltradosMod?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#F0F2F5] mb-2">
                Alunos ({alunosSelecionados.length} selecionados)
              </h3>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
                {alunosFiltradosMod.map(aluno => (
                  <button
                    key={aluno.id}
                    onClick={() => toggleAluno(aluno.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left ${
                      alunosSelecionados.includes(aluno.id)
                        ? 'bg-[#00D4AA]/10 border-[#00D4AA]/40 text-[#00D4AA]'
                        : 'bg-[#0F1117] border-[#2A2D3E] text-[#8B8FA8]'
                    }`}
                  >
                    <span className="text-sm">{aluno.nome}</span>
                    <span>{alunosSelecionados.includes(aluno.id) ? '✓' : '+'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleSalvar} loading={salvar.isPending} className="flex-1">
              {editando ? 'Salvar' : 'Criar Turma'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
