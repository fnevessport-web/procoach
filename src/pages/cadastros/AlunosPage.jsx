import { useState } from 'react'
import { Plus, Edit2, Trash2, Phone, Mail } from 'lucide-react'
import { useAlunos, useSalvarAluno, useExcluirAluno } from '../../hooks/useAlunos'
import { useModalidades } from '../../hooks/useModalidades'
import useAppStore from '../../store/useAppStore'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { SearchBar } from '../../components/ui/SearchBar'
import { Loading, EmptyState } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

export function AlunosPage() {
  const { modalidadeSelecionada } = useAppStore()
  const { data: alunos, isLoading } = useAlunos(modalidadeSelecionada?.id)
  const { data: modalidades } = useModalidades()
  const salvar = useSalvarAluno()
  const excluir = useExcluirAluno()

  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(formInicial())

  function formInicial() {
    return { nome: '', email: '', telefone: '', modalidade_id: '', multiclubes_id: '' }
  }

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function abrirCriar() {
    setEditando(null)
    setForm(formInicial())
    setModal(true)
  }

  function abrirEditar(aluno) {
    setEditando(aluno)
    setForm({
      nome: aluno.nome || '',
      email: aluno.email || '',
      telefone: aluno.telefone || '',
      modalidade_id: aluno.modalidade_id || '',
      multiclubes_id: aluno.multiclubes_id || ''
    })
    setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório')
    try {
      await salvar.mutateAsync({ id: editando?.id, ...form })
      toast.success(editando ? 'Aluno atualizado!' : 'Aluno cadastrado!')
      setModal(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleExcluir(id) {
    if (!confirm('Remover este aluno?')) return
    try {
      await excluir.mutateAsync(id)
      toast.success('Aluno removido')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const filtrados = alunos?.filter(a =>
    a.nome.toLowerCase().includes(busca.toLowerCase()) ||
    a.email?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="fade-in">
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar aluno..." />
        </div>
        <Button onClick={abrirCriar} size="sm">
          <Plus size={16} /> Novo
        </Button>
      </div>

      {isLoading ? <Loading /> : !filtrados?.length ? (
        <EmptyState icon="👥" title="Nenhum aluno" action={<Button onClick={abrirCriar}><Plus size={16} /> Adicionar</Button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtrados.map(aluno => (
            <Card key={aluno.id}>
              <CardBody>
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
                    style={{
                      backgroundColor: `${aluno.modalidades?.cor_hex || '#00D4AA'}20`,
                      color: aluno.modalidades?.cor_hex || '#00D4AA'
                    }}
                  >
                    {aluno.nome[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[#F0F2F5] truncate text-sm">{aluno.nome}</div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                        <button onClick={() => abrirEditar(aluno)} className="p-1 rounded-lg text-[#8B8FA8] hover:text-[#F0F2F5] hover:bg-[#2A2D3E]">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleExcluir(aluno.id)} className="p-1 rounded-lg text-[#8B8FA8] hover:text-[#EF4444] hover:bg-[#EF4444]/10">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {aluno.modalidades && (
                      <span className="text-xs" style={{ color: aluno.modalidades.cor_hex }}>
                        {aluno.modalidades.icone_emoji} {aluno.modalidades.nome}
                      </span>
                    )}
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                      {aluno.telefone && (
                        <span className="text-xs text-[#8B8FA8] flex items-center gap-1">
                          <Phone size={10} /> {aluno.telefone}
                        </span>
                      )}
                      {aluno.multiclubes_id && (
                        <span className="text-xs text-[#8B8FA8]">MC: {aluno.multiclubes_id}</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Aluno' : 'Novo Aluno'} size="md">
        <div className="flex flex-col gap-4">
          <Input label="Nome completo *" placeholder="Nome do aluno" value={form.nome} onChange={e => update('nome', e.target.value)} />
          <Input label="E-mail" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => update('email', e.target.value)} />
          <Input label="Telefone" placeholder="(11) 99999-9999" value={form.telefone} onChange={e => update('telefone', e.target.value)} />
          <Select label="Modalidade" value={form.modalidade_id} onChange={e => update('modalidade_id', e.target.value)}>
            <option value="">Selecione...</option>
            {modalidades?.map(m => <option key={m.id} value={m.id}>{m.icone_emoji} {m.nome}</option>)}
          </Select>
          <Input
            label="ID MultiClubes — integração futura (opcional)"
            placeholder="ID da plataforma MultiClubes"
            value={form.multiclubes_id}
            onChange={e => update('multiclubes_id', e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleSalvar} loading={salvar.isPending} className="flex-1">
              {editando ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
