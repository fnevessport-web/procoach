import { useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { useQuadras } from '../../hooks/useQuadras'
import { useModalidades } from '../../hooks/useModalidades'
import useAppStore from '../../store/useAppStore'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { SearchBar } from '../../components/ui/SearchBar'
import { Loading, EmptyState } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

export function QuadrasPage() {
  const qc = useQueryClient()
  const { modalidadeSelecionada } = useAppStore()
  const { data: quadras, isLoading } = useQuadras(modalidadeSelecionada?.id)
  const { data: modalidades } = useModalidades()

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

  function abrirEditar(quadra) {
    setEditando(quadra)
    setForm({ nome: quadra.nome || '', modalidade_id: quadra.modalidade_id || '' })
    setSalvando(false)
    setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório')
    if (salvando) return
    setSalvando(true)
    try {
      const payload = {
        nome: form.nome,
        modalidade_id: form.modalidade_id || null,
      }
      if (editando) {
        const { error } = await supabase.from('quadras').update(payload).eq('id', editando.id)
        if (error) throw error
        toast.success('Quadra atualizada!')
      } else {
        const { error } = await supabase.from('quadras').insert(payload)
        if (error) throw error
        toast.success('Quadra cadastrada!')
      }
      await qc.invalidateQueries({ queryKey: ['quadras'] })
      setModal(false)
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(id) {
    if (!confirm('Remover esta quadra?')) return
    try {
      const { error } = await supabase.from('quadras').update({ ativo: false }).eq('id', id)
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['quadras'] })
      toast.success('Quadra removida')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const filtradas = quadras?.filter(q =>
    q.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="fade-in">
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar quadra..." />
        </div>
        <Button onClick={abrirCriar} size="sm">
          <Plus size={16} /> Nova
        </Button>
      </div>

      {isLoading ? <Loading /> : !filtradas?.length ? (
        <EmptyState icon="🟩" title="Nenhuma quadra" action={<Button onClick={abrirCriar}><Plus size={16} /> Adicionar</Button>} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtradas.map(quadra => (
            <Card key={quadra.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#F0F2F5]">{quadra.nome}</div>
                    {quadra.modalidades && (
                      <span className="text-xs mt-0.5 block" style={{ color: quadra.modalidades.cor_hex }}>
                        {quadra.modalidades.icone_emoji} {quadra.modalidades.nome}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => abrirEditar(quadra)} className="p-1.5 rounded-lg text-[#8B8FA8] hover:text-[#F0F2F5] hover:bg-[#2A2D3E]">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleExcluir(quadra.id)} className="p-1.5 rounded-lg text-[#8B8FA8] hover:text-[#EF4444] hover:bg-[#EF4444]/10">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Quadra' : 'Nova Quadra'}>
        <div className="flex flex-col gap-4">
          <Input
            label="Nome *"
            placeholder="Ex: Quadra 1, Quadra Central, Court A"
            value={form.nome}
            onChange={e => update('nome', e.target.value)}
          />
          <Select label="Modalidade" value={form.modalidade_id} onChange={e => update('modalidade_id', e.target.value)}>
            <option value="">Selecione...</option>
            {modalidades?.map(m => <option key={m.id} value={m.id}>{m.icone_emoji} {m.nome}</option>)}
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