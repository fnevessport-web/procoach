import { useState } from 'react'
import { Trash2, MessageCircle } from 'lucide-react'
import { useAlunos, useSalvarAluno, useExcluirAluno } from '../../hooks/useAlunos'
import { useModalidades } from '../../hooks/useModalidades'
import useAppStore from '../../store/useAppStore'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Loading } from '../../components/ui/Loading'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: '#110f0f', border: '1px solid #2a2a2a',
  color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

export function AlunosPage() {
  const { modalidadeSelecionada } = useAppStore()
  const { data: alunos, isLoading, refetch } = useAlunos(modalidadeSelecionada?.id)
  const { data: modalidades } = useModalidades()
  const salvar = useSalvarAluno()
  const excluir = useExcluirAluno()

  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nome: '', telefone: '', multiclubes_id: '' })
  const [modalidadesSelecionadas, setModalidadesSelecionadas] = useState([])
  const [salvandoMods, setSalvandoMods] = useState(false)

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function toggleModalidade(id) {
    setModalidadesSelecionadas(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  function abrirCriar() {
    setEditando(null)
    setForm({ nome: '', telefone: '', multiclubes_id: '' })
    setModalidadesSelecionadas([])
    setModal(true)
  }

  async function abrirEditar(aluno) {
    setEditando(aluno)
    setForm({
      nome: aluno.nome || '',
      telefone: aluno.telefone || '',
      multiclubes_id: aluno.multiclubes_id || ''
    })
    // Buscar modalidades do aluno
    const { data } = await supabase
      .from('alunos_modalidades')
      .select('modalidade_id')
      .eq('aluno_id', aluno.id)
    setModalidadesSelecionadas(data?.map(m => m.modalidade_id) || [])
    setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório')
    setSalvandoMods(true)
    try {
      // Salva aluno principal (mantém modalidade_id com a primeira selecionada para compatibilidade)
      const result = await salvar.mutateAsync({
        id: editando?.id,
        nome: form.nome,
        telefone: form.telefone,
        multiclubes_id: form.multiclubes_id,
        modalidade_id: modalidadesSelecionadas[0] || null,
      })

      const alunoId = result?.id || editando?.id

      // Salva múltiplas modalidades
      if (alunoId && modalidadesSelecionadas.length > 0) {
        // Remove as antigas
        await supabase.from('alunos_modalidades').delete().eq('aluno_id', alunoId)
        // Insere as novas
        await supabase.from('alunos_modalidades').insert(
          modalidadesSelecionadas.map(mid => ({ aluno_id: alunoId, modalidade_id: mid }))
        )
      }

      toast.success(editando ? 'Aluno atualizado!' : 'Aluno cadastrado!')
      setModal(false)
      refetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSalvandoMods(false)
    }
  }

  async function handleExcluir(id) {
    if (!confirm('Remover este aluno?')) return
    try {
      await excluir.mutateAsync(id)
      toast.success('Aluno removido')
    } catch (err) { toast.error(err.message) }
  }

  function abrirWhatsApp(telefone) {
    window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}`, '_blank')
  }

  const filtrados = alunos?.filter(a =>
    a.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>
      {/* Busca + botão novo */}
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

      {/* Lista */}
      {isLoading ? <Loading /> : !filtrados?.length ? (
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
                  {aluno.telefone && (
                    <span style={{ marginLeft: '8px' }}>📱 {aluno.telefone}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {aluno.telefone && (
                  <button
                    onClick={() => abrirWhatsApp(aluno.telefone)}
                    style={{
                      padding: '6px', borderRadius: '8px', border: 'none',
                      backgroundColor: 'rgba(37,211,102,0.15)', color: '#25D166', cursor: 'pointer',
                    }}
                  >
                    <MessageCircle size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleExcluir(aluno.id)}
                  style={{
                    padding: '6px', borderRadius: '8px', border: 'none',
                    backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Aluno' : 'Novo Aluno'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input
            label="Nome completo *"
            placeholder="Nome do aluno"
            value={form.nome}
            onChange={e => update('nome', e.target.value)}
          />
          <Input
            label="Telefone (WhatsApp)"
            placeholder="(11) 99999-9999"
            value={form.telefone}
            onChange={e => update('telefone', e.target.value)}
          />
          <Input
            label="ID MultiClubes (opcional)"
            placeholder="ID da plataforma"
            value={form.multiclubes_id}
            onChange={e => update('multiclubes_id', e.target.value)}
          />

          {/* Modalidades múltiplas */}
          <div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
              Modalidades ({modalidadesSelecionadas.length} selecionadas)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {modalidades?.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleModalidade(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: '10px', border: 'none',
                    background: modalidadesSelecionadas.includes(m.id)
                      ? 'rgba(252,200,37,0.1)' : '#110f0f',
                    outline: modalidadesSelecionadas.includes(m.id)
                      ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a',
                    color: modalidadesSelecionadas.includes(m.id) ? '#fcc825' : '#888',
                    cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>{m.icone_emoji} {m.nome}</span>
                  <span style={{ fontSize: '16px' }}>
                    {modalidadesSelecionadas.includes(m.id) ? '✓' : '+'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={() => setModal(false)}
              style={{
                flex: 1, padding: '12px', borderRadius: '10px',
                border: '1px solid #2a2a2a', backgroundColor: 'transparent',
                color: '#888', fontSize: '13px', cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={salvar.isPending || salvandoMods}
              style={{
                flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              }}
            >
              {salvar.isPending || salvandoMods ? 'Salvando...' : editando ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}