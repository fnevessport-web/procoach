import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { MessageCircle } from 'lucide-react'

const BANCOS = [
  'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa Econômica',
  'Nubank', 'Inter', 'C6 Bank', 'BTG', 'Sicredi', 'Sicoob', 'Outro'
]

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: '#110f0f', border: '1px solid #2a2a2a',
  color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

const FORM_VAZIO = {
  id: null, nome: '', email: '', telefone: '',
  modalidade_id: '', valor_hora_aula: '', ativo: true,
  banco: '', agencia: '', conta: '', tipo_conta: 'corrente', pix: '',
}

async function inserirProfessor(payload) {
  const { data, error } = await supabase.from('professores').insert(payload).select().single()
  if (error) throw error
  return data
}

async function atualizarProfessor(id, payload) {
  const { data, error } = await supabase.from('professores').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

async function removerProfessor(id) {
  const { error } = await supabase.from('professores').delete().eq('id', id)
  if (error) throw error
}

export default function ProfessoresPage() {
  const queryClient = useQueryClient()

  const { data: professores = [], isLoading } = useQuery({
    queryKey: ['professores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professores').select('*, modalidades(nome)').order('nome')
      if (error) throw error
      return data || []
    },
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('modalidades').select('*').order('nome')
      if (error) throw error
      return data || []
    },
  })

  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)

  const fecharModal = useCallback(() => {
    setModalAberto(false)
    setTimeout(() => { setSalvando(false); setRemovendo(false) }, 300)
  }, [])

  function abrirCriar() {
    setSalvando(false); setRemovendo(false); setModoEdicao(false)
    setForm({ ...FORM_VAZIO }); setModalAberto(true)
  }

  function abrirEditar(prof) {
    setSalvando(false); setRemovendo(false); setModoEdicao(true)
    setForm({
      id: prof.id, nome: prof.nome || '', email: prof.email || '',
      telefone: prof.telefone || '', modalidade_id: prof.modalidade_id || '',
      valor_hora_aula: prof.valor_hora_aula || '', ativo: prof.ativo !== false,
      banco: prof.banco || '', agencia: prof.agencia || '',
      conta: prof.conta || '', tipo_conta: prof.tipo_conta || 'corrente', pix: prof.pix || '',
    })
    setModalAberto(true)
  }

  function set(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  async function handleSalvar() {
    if (salvando || removendo) return
    if (!form.nome.trim()) { alert('Nome é obrigatório.'); return }
    setSalvando(true)
    const payload = {
      nome: form.nome.trim(), email: form.email || null, telefone: form.telefone || null,
      modalidade_id: form.modalidade_id || null,
      valor_hora_aula: form.valor_hora_aula ? parseFloat(String(form.valor_hora_aula).replace(',', '.')) : null,
      ativo: form.ativo, banco: form.banco || null, agencia: form.agencia || null,
      conta: form.conta || null, tipo_conta: form.tipo_conta || 'corrente', pix: form.pix || null,
    }
    try {
      if (modoEdicao) { await atualizarProfessor(form.id, payload) } else { await inserirProfessor(payload) }
      queryClient.invalidateQueries({ queryKey: ['professores'] })
      fecharModal()
    } catch (err) {
      alert('Erro ao salvar: ' + (err.message || 'Tente novamente.'))
      setSalvando(false)
    }
  }

  async function handleRemover() {
    if (!form.id || salvando || removendo) return
    if (!confirm('Remover este professor?')) return
    setRemovendo(true)
    try {
      await removerProfessor(form.id)
      queryClient.invalidateQueries({ queryKey: ['professores'] })
      fecharModal()
    } catch (err) {
      alert('Erro ao remover: ' + (err.message || 'Tente novamente.'))
      setRemovendo(false)
    }
  }

  function abrirWhatsApp(telefone) {
    const numero = telefone.replace(/\D/g, '')
    window.open(`https://wa.me/55${numero}`, '_blank')
  }

  const ocupado = salvando || removendo

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#F0F2F5', margin: 0 }}>Professores</h2>
        <button onClick={abrirCriar} style={{
          padding: '8px 16px', borderRadius: '10px', border: 'none',
          background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
          color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
        }}>
          + Novo Professor
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: '#555', fontSize: '14px' }}>Carregando...</p>
      ) : professores.length === 0 ? (
        <p style={{ color: '#555', fontSize: '14px' }}>Nenhum professor cadastrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {professores.map(prof => (
            <div key={prof.id} style={{
              backgroundColor: '#1a1a1a', borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '14px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div onClick={() => abrirEditar(prof)} style={{ flex: 1, cursor: 'pointer' }}>
                <p style={{ color: '#F0F2F5', fontWeight: '600', fontSize: '14px', margin: 0 }}>{prof.nome}</p>
                <p style={{ color: '#555', fontSize: '12px', margin: '2px 0 0' }}>
                  {prof.modalidades?.nome || '—'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {prof.telefone && (
                  <button
                    onClick={() => abrirWhatsApp(prof.telefone)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      backgroundColor: 'rgba(37,211,102,0.15)',
                      border: '1px solid rgba(37,211,102,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    <MessageCircle size={14} color="#25D166" />
                  </button>
                )}
                <span style={{
                  fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: '500',
                  backgroundColor: prof.ativo ? 'rgba(124,58,237,0.15)' : 'rgba(239,68,68,0.15)',
color: prof.ativo ? '#a78bfa' : '#EF4444',
border: `1px solid ${prof.ativo ? 'rgba(124,58,237,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  {prof.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{
            backgroundColor: '#1a1a1a', width: '100%', maxWidth: '480px',
            borderRadius: '20px 20px 0 0', padding: '24px',
            maxHeight: '90vh', overflowY: 'auto',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#F0F2F5', marginBottom: '16px' }}>
              {modoEdicao ? 'Editar Professor' : 'Novo Professor'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input style={inputStyle} placeholder="Nome completo *"
                value={form.nome} onChange={e => set('nome', e.target.value)} disabled={ocupado} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input style={inputStyle} placeholder="E-mail"
                  value={form.email} onChange={e => set('email', e.target.value)} disabled={ocupado} />
                <input style={inputStyle} placeholder="Telefone (WhatsApp)"
                  value={form.telefone} onChange={e => set('telefone', e.target.value)} disabled={ocupado} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select style={inputStyle} value={form.modalidade_id}
                  onChange={e => set('modalidade_id', e.target.value)} disabled={ocupado}>
                  <option value="">Modalidade</option>
                  {modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                <input style={inputStyle} placeholder="Valor/Aula (R$)" type="number"
                  value={form.valor_hora_aula} onChange={e => set('valor_hora_aula', e.target.value)} disabled={ocupado} />
              </div>

              <p style={{ fontSize: '11px', color: '#555', fontWeight: '600', letterSpacing: '1px', margin: '4px 0 0' }}>
                DADOS BANCÁRIOS
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select style={inputStyle} value={form.banco}
                  onChange={e => set('banco', e.target.value)} disabled={ocupado}>
                  <option value="">Banco</option>
                  {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <input style={inputStyle} placeholder="Agência"
                  value={form.agencia} onChange={e => set('agencia', e.target.value)} disabled={ocupado} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input style={inputStyle} placeholder="Conta"
                  value={form.conta} onChange={e => set('conta', e.target.value)} disabled={ocupado} />
                <select style={inputStyle} value={form.tipo_conta}
                  onChange={e => set('tipo_conta', e.target.value)} disabled={ocupado}>
                  <option value="corrente">Corrente</option>
                  <option value="poupanca">Poupança</option>
                </select>
              </div>

              <input style={inputStyle} placeholder="Chave PIX"
                value={form.pix} onChange={e => set('pix', e.target.value)} disabled={ocupado} />

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#888' }}>
                <input type="checkbox" checked={form.ativo}
                  onChange={e => set('ativo', e.target.checked)} disabled={ocupado} />
                Professor ativo
              </label>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={fecharModal} disabled={ocupado} style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #2a2a2a',
                  backgroundColor: 'transparent', color: '#888', fontSize: '13px', cursor: 'pointer',
                }}>
                  Cancelar
                </button>
                {modoEdicao && (
                  <button onClick={handleRemover} disabled={ocupado} style={{
                    flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                    backgroundColor: 'rgba(239,68,68,0.15)', color: '#EF4444',
                    fontSize: '13px', cursor: 'pointer',
                  }}>
                    {removendo ? 'Removendo...' : 'Remover'}
                  </button>
                )}
                <button onClick={handleSalvar} disabled={ocupado || !form.nome.trim()} style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                  color: 'white', fontSize: '13px', fontWeight: '600',
                  cursor: ocupado ? 'not-allowed' : 'pointer', opacity: ocupado ? 0.7 : 1,
                }}>
                  {salvando ? 'Salvando...' : modoEdicao ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}