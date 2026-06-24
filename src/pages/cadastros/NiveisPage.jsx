import { useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { useNiveis, useNiveisActions } from '../../hooks/useNiveis'
import { useModalidades } from '../../hooks/useModalidades'
import useAppStore from '../../store/useAppStore'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { SearchBar } from '../../components/ui/SearchBar'
import { Loading, EmptyState } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

export function NiveisPage() {
  const { modalidadeSelecionada } = useAppStore()
  const { data: niveis, isLoading } = useNiveis(modalidadeSelecionada?.id)
  const { data: modalidades } = useModalidades()
  const { salvar, excluir } = useNiveisActions()

  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ nome: '', modalidade_id: '' })

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function abrirCriar() {
    setEditando(null)
    setForm({ nome: '', modalidade_id: '' })
    setSalvando(false)
    setModal(true)
  }

  function abrirEditar(nivel) {
    setEditando(nivel)
    setForm({ nome: nivel.nome || '', modalidade_id: nivel.modalidade_id || '' })
    setSalvando(false)
    setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório')
    if (salvando) return
    setSalvando(true)
    try {
      await salvar({ id: editando?.id, ...form })
      toast.success(editando ? 'Nível atualizado!' : 'Nível cadastrado!')
      setModal(false)
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(id) {
    if (!confirm('Remover este nível?')) return
    try {
      await excluir(id)
      toast.success('Nível removido')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const filtrados = niveis?.filter(n =>
    n.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="fade-in">
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar nível..." />
        </div>
        <Button onClick={abrirCriar} size="sm">
          <Plus size={16} /> Novo
        </Button>
      </div>

      {isLoading ? <Loading /> : !filtrados?.length ? (
        <EmptyState icon="🎯" title="Nenhum nível" action={<Button onClick={abrirCriar}><Plus size={16} /> Adicionar</Button>} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtrados.map(nivel => (
            <Card key={nivel.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#F0F2F5]">{nivel.nome}</div>
                    {nivel.modalidades && (
                      <span className="text-xs mt-0.5 block" style={{ color: nivel.modalidades.cor_hex }}>
                        {nivel.modalidades.icone_emoji} {nivel.modalidades.nome}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => abrirEditar(nivel)} className="p-1.5 rounded-lg text-[#8B8FA8] hover:text-[#F0F2F5] hover:bg-[#2A2D3E]">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleExcluir(nivel.id)} className="p-1.5 rounded-lg text-[#8B8FA8] hover:text-[#EF4444] hover:bg-[#EF4444]/10">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Nível' : 'Novo Nível'}>
        <div className="flex flex-col gap-4">
          <Input
            label="Nome *"
            placeholder="Ex: Iniciante, Intermediário, Avançado"
            value={form.nome}
            onChange={e => update('nome', e.target.value)}
          />
          <Select label="Modalidade" value={form.modalidade_id} onChange={e => update('modalidade_id', e.target.value)}>
            <option value="">Selecione...</option>
            {modalidades?.map(m => (
              <option key={m.id} value={m.id}>{m.icone_emoji} {m.nome}</option>
            ))}
          </Select>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleSalvar} loading={salvando} className="flex-1">
              {editando ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}