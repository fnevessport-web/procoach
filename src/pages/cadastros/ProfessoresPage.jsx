import { useState } from 'react'
import { Plus, Edit2, Trash2, Phone, DollarSign } from 'lucide-react'
import { useProfessores, useSalvarProfessor, useExcluirProfessor } from '../../hooks/useProfessores'
import { useModalidades } from '../../hooks/useModalidades'
import useAppStore from '../../store/useAppStore'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { SearchBar } from '../../components/ui/SearchBar'
import { Loading, EmptyState } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

const bancos = [
  'Nubank', 'Itaú', 'Bradesco', 'Caixa', 'Banco do Brasil',
  'Santander', 'Inter', 'C6 Bank', 'Sicoob', 'Outro'
]

export function ProfessoresPage() {
  const { modalidadeSelecionada } = useAppStore()
  const { data: professores, isLoading } = useProfessores(modalidadeSelecionada?.id)
  const { data: modalidades } = useModalidades()
  const salvar = useSalvarProfessor()
  const excluir = useExcluirProfessor()

  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(formInicial())

  function formInicial() {
    return {
      nome: '', email: '', telefone: '', modalidade_id: '',
      valor_hora_aula: '', banco: '', agencia: '', conta: '',
      tipo_conta: 'corrente', pix: ''
    }
  }

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function abrirCriar() {
    setEditando(null)
    setForm(formInicial())
    salvar.reset()
    setModal(true)
  }

  function abrirEditar(prof) {
    setEditando(prof)
    setForm({
      nome: prof.nome || '',
      email: prof.email || '',
      telefone: prof.telefone || '',
      modalidade_id: prof.modalidade_id || '',
      valor_hora_aula: prof.valor_hora_aula || '',
      banco: prof.banco || '',
      agencia: prof.agencia || '',
      conta: prof.conta || '',
      tipo_conta: prof.tipo_conta || 'corrente',
      pix: prof.pix || ''
    })
    salvar.reset()
    setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    try {
      await salvar.mutateAsync({
        id: editando?.id,
        ...form,
        modalidade_id: form.modalidade_id || null,
        valor_hora_aula: form.valor_hora_aula !== '' ? Number(form.valor_hora_aula) : null,
      })
      toast.success(editando ? 'Professor atualizado!' : 'Professor cadastrado!')
      setModal(false)
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message)
    }
  }

  async function handleExcluir(id) {
    if (!confirm('Remover este professor?')) return
    try {
      await excluir.mutateAsync(id)
      toast.success('Professor removido')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const filtrados = professores?.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.email?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="fade-in">
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar professor..." />
        </div>
        <Button onClick={abrirCriar} size="sm">
          <Plus size={16} /> Novo
        </Button>
      </div>

      {isLoading ? <Loading /> : !filtrados?.length ? (
        <EmptyState icon="👨‍🏫" title="Nenhum professor" action={<Button onClick={abrirCriar}><Plus size={16} /> Adicionar</Button>} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtrados.map(prof => (
            <Card key={prof.id}>
              <CardBody>
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
                    style={{
                      backgroundColor: `${prof.modalidades?.cor_hex || '#00D4AA'}20`,
                      color: prof.modalidades?.cor_hex || '#00D4AA'
                    }}
                  >
                    {prof.nome[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-[#F0F2F5] truncate">{prof.nome}</div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        <button onClick={() => abrirEditar(prof)} className="p-1.5 rounded-lg text-[#8B8FA8] hover:text-[#F0F2F5] hover:bg-[#2A2D3E]">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleExcluir(prof.id)} className="p-1.5 rounded-lg text-[#8B8FA8] hover:text-[#EF4444] hover:bg-[#EF4444]/10">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      {prof.modalidades && (
                        <span className="text-xs" style={{ color: prof.modalidades.cor_hex }}>
                          {prof.modalidades.icone_emoji} {prof.modalidades.nome}
                        </span>
                      )}
                      {prof.valor_hora_aula && (
                        <span className="text-xs text-[#8B8FA8] flex items-center gap-1">
                          <DollarSign size={11} /> R$ {Number(prof.valor_hora_aula).toFixed(2)}/h
                        </span>
                      )}
                      {prof.telefone && (
                        <span className="text-xs text-[#8B8FA8] flex items-center gap-1">
                          <Phone size={11} /> {prof.telefone}
                        </span>
                      )}
                    </div>
                    {prof.pix && (
                      <div className="text-xs text-[#8B8FA8] mt-1">PIX: {prof.pix}</div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => { salvar.reset(); setModal(false) }} title={editando ? 'Editar Professor' : 'Novo Professor'} size="lg">
        <div className="flex flex-col gap-4">
          <Input
            label="Nome completo *"
            placeholder="Nome do professor"
            value={form.nome}
            onChange={e => update('nome', e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="E-mail" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => update('email', e.target.value)} />
            <Input label="Telefone" placeholder="(11) 99999-9999" value={form.telefone} onChange={e => update('telefone', e.target.value)} />
            <Select label="Modalidade" value={form.modalidade_id} onChange={e => update('modalidade_id', e.target.value)}>
              <option value="">Selecione...</option>
              {modalidades?.map(m => <option key={m.id} value={m.id}>{m.icone_emoji} {m.nome}</option>)}
            </Select>
            <Input label="Valor Hora/Aula (R$)" type="number" placeholder="0.00" value={form.valor_hora_aula} onChange={e => update('valor_hora_aula', e.target.value)} />
          </div>
          <div className="border-t border-[#2A2D3E] pt-4">
            <h3 className="text-sm font-semibold text-[#F0F2F5] mb-3">Dados Bancários</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Banco" value={form.banco} onChange={e => update('banco', e.target.value)}>
                <option value="">Selecione...</option>
                {bancos.map(b => <option key={b} value={b}>{b}</option>)}
              </Select>
              <Input label="Agência" placeholder="0000" value={form.agencia} onChange={e => update('agencia', e.target.value)} />
              <Input label="Conta" placeholder="00000-0" value={form.conta} onChange={e => update('conta', e.target.value)} />
              <Select label="Tipo de Conta" value={form.tipo_conta} onChange={e => update('tipo_conta', e.target.value)}>
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
              </Select>
              <div className="sm:col-span-2">
                <Input label="Chave PIX" placeholder="CPF, e-mail, telefone ou chave aleatória" value={form.pix} onChange={e => update('pix', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => { salvar.reset(); setModal(false) }} className="flex-1">Cancelar</Button>
            <Button onClick={handleSalvar} loading={salvar.isPending} className="flex-1">
              {editando ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}