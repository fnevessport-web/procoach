import { useState } from 'react'
import { Edit2, Trash2, MessageCircle } from 'lucide-react'
import { useAlunos, useSalvarAluno, useExcluirAluno } from '../../hooks/useAlunos'
import { useModalidades } from '../../hooks/useModalidades'
import useAppStore from '../../store/useAppStore'
import { Modal } from '../../components/ui/Modal'
import { Input, Select } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Loading'
import toast from 'react-hot-toast'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: '#110f0f', border: '1px solid #2a2a2a',
  color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

export function AlunosPage() {
  const { modalidadeSelecionada } = useAppStore()
  const { data: alunos, isLoading } = useAlunos(modalidadeSelecionada?.id)
  const { data: modalidades } = useModalidades()
  const salvar = useSalvarAluno()
  const excluir = useExcluirAluno()

  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', modalidade_id: '', multiclubes_id: '' })

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function abrirCriar() {
    setEditando(null)
    setForm({ nome: '', email: '', telefone: '', modalidade_id: '', multiclubes_id: '' })
    setModal(true)
  }

  function abrirEditar(aluno) {
    setEditando(aluno)
    setForm({
      nome: aluno.nome || '', email: aluno.email || '', telefone: aluno.telefone || '',
      modalidade_id: aluno.modalidade_id || '', multiclubes_id: aluno.multiclubes_id || ''
    })
    setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório')
    try {
      await salvar.mutateAsync({ id: editando?.id, ...form })
      toast.success(editando ? 'Aluno atualizado!' : 'Aluno cadastrado!')
      setModal(false)
    } catch (err) { toast.error(err.message) }
  }

  async function handleExcluir(id) {
    if (!confirm('Remover este aluno?')) return
    try { await excluir.mutateAsync(id); toast.success('Aluno removido') }
    catch (err) { toast.error(err.message) }
  }

  function abrirWhatsApp(telefone) {
    window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}`, '_blank')
  }

  const filtrados = alunos?.filter(a =>
    a.nome.toLowerCase().includes(busca.toLowerCase()) ||
    a.email?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            style={{ ...inputStyle, paddingLeft: '36px' }}
            placeholder="Buscar aluno..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: '14px' }}>🔍</span>
        </div>
        <button onClick={abrirCriar} style={{
          padding: '10px 16px', borderRadius: '10px', border: 'none',
          background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
          color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>+ Novo</button>
      </div>

      {isLoading ? (
        <p style={{ color: '#555', fontSize: '14px' }}>Carregando...</p>
      ) : !filtrados?.length ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>👥</div>
          <p style={{ color: '#555', fontSize: '14px', marginBottom: '16px' }}>Nenhum aluno cadastrado</p>
          <button onClick={abrirCriar} style={{
            padding: '10px 20px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
            color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
          }}>+ Adicionar</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.map(aluno => (
            <div key={aluno.id} style={{
              backgroundColor: '#1a1a1a', borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div onClick={() => abrirEditar(aluno)} style={{ flex: 1, cursor: 'pointer' }}>
                <div style={{ fontWeight: '600', color: '#F0F2F5', fontSize: '14px' }}>{aluno.nome}</div>
                <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
                  {aluno.modalidades?.icone_emoji} {aluno.modalidades?.nome || '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {aluno.telefone && (
                  <button onClick={() => abrirWhatsApp(aluno.telefone)} style={{
                    padding: '6px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'rgba(37,211,102,0.15)', color: '#25D166', cursor: 'pointer',
                  }}><MessageCircle size={14} /></button>
                )}
                <button onClick={() => handleExcluir(aluno.id)} style={{
                  padding: '6px', borderRadius: '8px', border: 'none',
                  backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer',
                }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Aluno' : 'Novo Aluno'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input label="Nome completo *" placeholder="Nome do aluno" value={form.nome} onChange={e => update('nome', e.target.value)} />
          <Input label="E-mail" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => update('email', e.target.value)} />
          <Input label="Telefone (WhatsApp)" placeholder="(11) 99999-9999" value={form.telefone} onChange={e => update('telefone', e.target.value)} />
          <Select label="Modalidade" value={form.modalidade_id} onChange={e => update('modalidade_id', e.target.value)}>
            <option value="">Selecione...</option>
            {modalidades?.map(m => <option key={m.id} value={m.id}>{m.icone_emoji} {m.nome}</option>)}
          </Select>
          <Input label="ID MultiClubes (opcional)" placeholder="ID da plataforma" value={form.multiclubes_id} onChange={e => update('multiclubes_id', e.target.value)} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={() => setModal(false)} style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              border: '1px solid #2a2a2a', backgroundColor: 'transparent',
              color: '#888', fontSize: '13px', cursor: 'pointer',
            }}>Cancelar</button>
            <button onClick={handleSalvar} disabled={salvar.isPending} style={{
              flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
              color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}>{salvar.isPending ? 'Salvando...' : editando ? 'Salvar' : 'Cadastrar'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}