import { useState } from 'react'
import { Edit2, Trash2, Search, Dumbbell } from 'lucide-react'
import { useModalidades, useModalidadesActions } from '../../hooks/useModalidades'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import toast from 'react-hot-toast'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
  color: 'var(--color-text-light-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

const FORM_VAZIO = { nome: '', icone_emoji: '', cor_hex: '#A54C2E' }

export function ModalidadesPage() {
  const { data: modalidades, isLoading } = useModalidades()
  const { salvar, excluir } = useModalidadesActions()

  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function abrirCriar() {
    setEditando(null); setForm(FORM_VAZIO)
    setSalvando(false); setModal(true)
  }

  function abrirEditar(modalidade) {
    setEditando(modalidade)
    setForm({ nome: modalidade.nome || '', icone_emoji: modalidade.icone_emoji || '', cor_hex: modalidade.cor_hex || '#A54C2E' })
    setSalvando(false); setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório')
    if (salvando) return
    setSalvando(true)
    try {
      await salvar({ id: editando?.id, ...form })
      toast.success(editando ? 'Modalidade atualizada!' : 'Modalidade cadastrada!')
      setModal(false)
    } catch (err) { toast.error('Erro: ' + err.message) }
    finally { setSalvando(false) }
  }

  async function handleExcluir(id) {
    if (!confirm('Remover esta modalidade?')) return
    try { await excluir(id); toast.success('Modalidade removida') }
    catch (err) { toast.error(err.message) }
  }

  const filtrados = modalidades?.filter(m => m.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            style={{ ...inputStyle, paddingLeft: '36px' }}
            placeholder="Buscar modalidade..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <Search size={14} color="var(--color-text-light-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        </div>
        <button onClick={abrirCriar} style={{
          padding: '10px 16px', borderRadius: '10px', border: 'none',
          background: 'var(--color-action-primary)',
          color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>+ Nova</button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--color-text-light-secondary)', fontSize: '14px' }}>Carregando...</p>
      ) : !filtrados?.length ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Dumbbell size={40} color="var(--color-text-light-secondary)" style={{ marginBottom: '8px' }} />
          <p style={{ color: 'var(--color-text-light-secondary)', fontSize: '14px', marginBottom: '16px' }}>Nenhuma modalidade cadastrada</p>
          <button onClick={abrirCriar} style={{
            padding: '10px 20px', borderRadius: '10px', border: 'none',
            background: 'var(--color-action-primary)',
            color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>+ Adicionar</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.map(modalidade => (
            <div key={modalidade.id} style={{
              backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '12px',
              border: '1px solid rgba(30,43,36,0.06)', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>{modalidade.icone_emoji}</span>
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--color-text-light-primary)', fontSize: '14px' }}>{modalidade.nome}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => abrirEditar(modalidade)} style={{
                  padding: '6px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'rgba(30,43,36,0.05)', color: 'var(--color-text-light-secondary)', cursor: 'pointer',
                }}><Edit2 size={14} /></button>
                <button onClick={() => handleExcluir(modalidade.id)} style={{
                  padding: '6px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'rgba(180,71,47,0.1)', color: 'var(--color-state-danger)', cursor: 'pointer',
                }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Modalidade' : 'Nova Modalidade'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input label="Nome *" placeholder="Ex: Tênis, Padel" value={form.nome} onChange={e => update('nome', e.target.value)} />
          <Input label="Ícone (emoji)" placeholder="🎾" value={form.icone_emoji} onChange={e => update('icone_emoji', e.target.value)} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-text-light-secondary)', marginBottom: '6px' }}>Cor</div>
            <input type="color" value={form.cor_hex} onChange={e => update('cor_hex', e.target.value)} style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid var(--color-border-light)', cursor: 'pointer' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={() => setModal(false)} style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              border: '1px solid var(--color-border-light)', backgroundColor: 'transparent',
              color: 'var(--color-text-light-secondary)', fontSize: '13px', cursor: 'pointer',
            }}>Cancelar</button>
            <button onClick={handleSalvar} disabled={salvando} style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: 'var(--color-action-primary)',
              color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}>{salvando ? 'Salvando...' : editando ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
