import { useState } from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import { useNiveis, useNiveisActions } from '../../hooks/useNiveis'
import { useModalidades } from '../../hooks/useModalidades'
import useAppStore from '../../store/useAppStore'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: 'var(--color-surface-light-overlay)', border: '1px solid var(--color-border-light)',
  color: 'var(--color-text-light-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

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
    setEditando(null); setForm({ nome: '', modalidade_id: '' })
    setSalvando(false); setModal(true)
  }

  function abrirEditar(nivel) {
    setEditando(nivel)
    setForm({ nome: nivel.nome || '', modalidade_id: nivel.modalidade_id || '' })
    setSalvando(false); setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório')
    if (salvando) return
    setSalvando(true)
    try {
      await salvar({ id: editando?.id, ...form })
      toast.success(editando ? 'Nível atualizado!' : 'Nível cadastrado!')
      setModal(false)
    } catch (err) { toast.error('Erro: ' + err.message) }
    finally { setSalvando(false) }
  }

  async function handleExcluir(id) {
    if (!confirm('Remover este nível?')) return
    try { await excluir(id); toast.success('Nível removido') }
    catch (err) { toast.error(err.message) }
  }

  const filtrados = niveis?.filter(n => n.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            style={{ ...inputStyle, paddingLeft: '36px' }}
            placeholder="Buscar nível..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light-secondary)', fontSize: '14px' }}>🔍</span>
        </div>
        <button onClick={abrirCriar} style={{
          padding: '10px 16px', borderRadius: '10px', border: 'none',
          background: 'var(--color-action-primary)',
          color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>+ Novo</button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--color-text-light-secondary)', fontSize: '14px' }}>Carregando...</p>
      ) : !filtrados?.length ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎯</div>
          <p style={{ color: 'var(--color-text-light-secondary)', fontSize: '14px', marginBottom: '16px' }}>Nenhum nível cadastrado</p>
          <button onClick={abrirCriar} style={{
            padding: '10px 20px', borderRadius: '10px', border: 'none',
            background: 'var(--color-action-primary)',
            color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>+ Adicionar</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.map(nivel => (
            <div key={nivel.id} style={{
              backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '12px',
              border: '1px solid rgba(30,43,36,0.06)', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: '600', color: 'var(--color-text-light-primary)', fontSize: '14px' }}>{nivel.nome}</div>
                {nivel.modalidades && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>
                    {nivel.modalidades.nome}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => abrirEditar(nivel)} style={{
                  padding: '6px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'rgba(30,43,36,0.05)', color: 'var(--color-text-light-secondary)', cursor: 'pointer',
                }}><Edit2 size={14} /></button>
                <button onClick={() => handleExcluir(nivel.id)} style={{
                  padding: '6px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'rgba(180,71,47,0.1)', color: 'var(--color-state-danger)', cursor: 'pointer',
                }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Nível' : 'Novo Nível'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input label="Nome *" placeholder="Ex: Iniciante, Avançado" value={form.nome} onChange={e => update('nome', e.target.value)} />
          <Select label="Modalidade" value={form.modalidade_id} onChange={e => update('modalidade_id', e.target.value)}>
            <option value="">Selecione...</option>
            {modalidades?.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Select>
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