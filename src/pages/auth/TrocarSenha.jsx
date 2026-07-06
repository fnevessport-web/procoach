import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, EyeOff, FileText, Upload } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAppStore from '../../store/useAppStore'
import { usePermissions } from '../../hooks/usePermissions'
import { Input } from '../../components/ui/Input'
import { apenasDigitosCPF, mascararCPF } from '../../lib/cpf'
import { mascararTelefoneBR, apenasDigitosTelefone } from '../../lib/telefone'
import { buscarCep } from '../../lib/cep'
import { BANCOS, ESTADOS } from '../../constants/geografia'
import { Loading } from '../../components/ui/Loading'

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  backgroundColor: '#111', border: '1px solid #2a2a2a',
  color: '#F0F2F5', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: '10px', color: '#555', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: '4px',
}

const sectionLabelStyle = {
  fontSize: '10px', color: '#555', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginTop: '4px',
}

export function TrocarSenha() {
  const navigate = useNavigate()
  const { user, perfil, setPerfil, setSessaoRecuperacao } = useAppStore()
  const { homeRoute } = usePermissions()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(null)

  const professorId = perfil?.professor_id

  const { data: professor, isLoading: carregandoProfessor } = useQuery({
    queryKey: ['onboarding_professor', professorId],
    enabled: !!professorId,
    queryFn: async () => {
      const { data, error } = await supabase.from('professores').select('*').eq('id', professorId).maybeSingle()
      if (error) throw error
      return data
    },
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades'],
    enabled: !!professorId,
    queryFn: async () => {
      const { data, error } = await supabase.from('modalidades').select('*').order('nome')
      if (error) throw error
      return data || []
    },
  })

  // Só pede os dados completos na primeira vez de verdade — se o professor já preencheu
  // isso antes (ex: só esqueceu a senha e o gestor resetou), pula direto pra senha nova.
  const precisaOnboarding = !!professor && !(
    professor.email && professor.nascimento && professor.cep && (professor.modalidades_ids || []).length > 0
  )

  useEffect(() => {
    if (professor && !form) {
      setForm({
        email: professor.email || '',
        telefone: professor.telefone || '',
        nascimento: professor.nascimento || '',
        cep: professor.cep || '', endereco: professor.endereco || '', numero: professor.numero || '',
        complemento: professor.complemento || '', bairro: professor.bairro || '',
        cidade: professor.cidade || '', estado: professor.estado || '',
        modalidades_ids: professor.modalidades_ids || [],
        tem_cref: professor.tem_cref || false, numero_cref: professor.numero_cref || '', cref_url: professor.cref_url || '',
        tem_cnpj: !!professor.cnpj, cnpj: professor.cnpj || '', razao_social: professor.razao_social || '',
        banco: professor.banco || '', tipo_pagamento: professor.tipo_pagamento || 'pix',
        agencia: professor.agencia || '', conta: professor.conta || '', tipo_conta: professor.tipo_conta || 'corrente',
        chave_pix: professor.chave_pix || '',
      })
    }
  }, [professor, form])

  function set(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  async function handleUploadCref(e) {
    const file = e.target.files?.[0]
    if (!file || !professorId) return
    const path = `professores/${professorId}/cref.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
    if (error) { setErro('Erro ao enviar o arquivo: ' + error.message); return }
    const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
    await supabase.from('professores').update({ cref_url: publicUrl }).eq('id', professorId)
    set('cref_url', publicUrl)
  }

  const regrasSenha = {
    tamanho: senha.length >= 8,
    maiuscula: /[A-Z]/.test(senha),
    numero: /[0-9]/.test(senha),
  }
  const senhaValida = regrasSenha.tamanho && regrasSenha.maiuscula && regrasSenha.numero

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (!senhaValida) return setErro('A senha precisa ter pelo menos 8 caracteres, 1 letra maiúscula e 1 número')
    if (senha !== confirmacao) return setErro('As senhas não coincidem')

    if (precisaOnboarding) {
      if (!form.email.trim() || !form.telefone.trim() || !form.nascimento || !form.cep.trim() ||
          !form.endereco.trim() || (form.modalidades_ids || []).length === 0) {
        return setErro('Preencha todos os campos obrigatórios')
      }
    }

    setLoading(true)
    try {
      const { error: erroSenha } = await supabase.auth.updateUser({ password: senha })
      if (erroSenha) throw erroSenha

      if (precisaOnboarding && professorId) {
        const payload = {
          email: form.email.trim(),
          telefone: apenasDigitosTelefone(form.telefone),
          nascimento: form.nascimento,
          cep: form.cep, endereco: form.endereco, numero: form.numero, complemento: form.complemento,
          bairro: form.bairro, cidade: form.cidade, estado: form.estado,
          modalidades_ids: form.modalidades_ids, modalidade_id: form.modalidades_ids[0] || null,
          tem_cref: form.tem_cref, numero_cref: form.tem_cref ? form.numero_cref : null,
          cnpj: form.tem_cnpj ? form.cnpj : null, razao_social: form.tem_cnpj ? form.razao_social : null,
          banco: form.banco || null, tipo_pagamento: form.tipo_pagamento,
          agencia: form.agencia || null, conta: form.conta || null, tipo_conta: form.tipo_conta,
          chave_pix: form.chave_pix || null,
        }
        const { error: erroProf } = await supabase.from('professores').update(payload).eq('id', professorId)
        if (erroProf) throw erroProf
      }

      await supabase.from('perfis_usuario').update({ primeiro_acesso: false }).eq('user_id', user.id)
      setPerfil({ ...perfil, primeiro_acesso: false })
      setSessaoRecuperacao(false)
      navigate(homeRoute, { replace: true })
    } catch (err) {
      setErro(err.message || 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  const aguardandoDadosProfessor = !!professorId && (carregandoProfessor || !form)

  return (
    <div style={{
      height: '100vh', width: '100%', backgroundColor: '#110f0f',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 16px', boxSizing: 'border-box',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
    }}>
      <div style={{ width: '100%', maxWidth: precisaOnboarding ? '480px' : '400px', margin: 'auto 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/images/logoprocoach.png" alt="ProCoach" style={{ height: '52px', objectFit: 'contain', margin: '0 auto 14px', display: 'block' }} />
          <p style={{ color: '#F0F2F5', fontSize: '15px', fontWeight: '600', margin: '0 0 4px' }}>Primeiro acesso</p>
          <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>
            {precisaOnboarding ? 'Cria sua senha e completa seu cadastro pra continuar' : 'Crie uma nova senha pra continuar'}
          </p>
        </div>

        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '20px', border: '1px solid #222', padding: '24px' }}>
          {aguardandoDadosProfessor ? (
            <Loading text="Carregando seus dados..." />
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ position: 'relative' }}>
                <Input label="Nova senha" type={mostrarSenha ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={senha} onChange={e => setSenha(e.target.value)} required />
                <button type="button" onClick={() => setMostrarSenha(v => !v)} style={{
                  position: 'absolute', right: '10px', bottom: '10px', background: 'none', border: 'none',
                  color: '#555', cursor: 'pointer', padding: '4px', display: 'flex',
                }}>
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '-8px' }}>
                <span style={{ fontSize: '11px', color: regrasSenha.tamanho ? '#22c55e' : '#555' }}>8 caracteres</span>
                <span style={{ fontSize: '11px', color: regrasSenha.maiuscula ? '#22c55e' : '#555' }}>1 letra maiúscula</span>
                <span style={{ fontSize: '11px', color: regrasSenha.numero ? '#22c55e' : '#555' }}>1 número</span>
              </div>
              <Input label="Confirmar nova senha" type={mostrarSenha ? 'text' : 'password'} placeholder="Repita a senha" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} required />

              {precisaOnboarding && form && (
                <>
                  <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '4px 0' }} />
                  <div style={sectionLabelStyle}>Dados obrigatórios</div>

                  <div><div style={labelStyle}>E-mail</div>
                    <input type="email" style={inputStyle} placeholder="seu@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
                  </div>
                  <div><div style={labelStyle}>Telefone (WhatsApp)</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ ...inputStyle, width: 'auto', flexShrink: 0, color: '#888', textAlign: 'center' }}>+55</span>
                      <input style={{ ...inputStyle, flex: 1 }} inputMode="numeric" placeholder="(11) 99999-9999"
                        value={mascararTelefoneBR(form.telefone)} onChange={e => set('telefone', apenasDigitosTelefone(e.target.value))} />
                    </div>
                  </div>
                  <div><div style={labelStyle}>Data de nascimento</div>
                    <input type="date" style={inputStyle} value={form.nascimento} onChange={e => set('nascimento', e.target.value)} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><div style={labelStyle}>CEP</div>
                      <input style={inputStyle} placeholder="00000-000" value={form.cep} onChange={e => { set('cep', e.target.value); buscarCep(e.target.value, setForm) }} />
                    </div>
                    <div><div style={labelStyle}>Número</div>
                      <input style={inputStyle} placeholder="Nº" value={form.numero} onChange={e => set('numero', e.target.value)} />
                    </div>
                  </div>
                  <div><div style={labelStyle}>Endereço</div>
                    <input style={inputStyle} placeholder="Rua / Avenida" value={form.endereco} onChange={e => set('endereco', e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><div style={labelStyle}>Bairro</div>
                      <input style={inputStyle} placeholder="Bairro" value={form.bairro} onChange={e => set('bairro', e.target.value)} />
                    </div>
                    <div><div style={labelStyle}>Complemento</div>
                      <input style={inputStyle} placeholder="Apto..." value={form.complemento} onChange={e => set('complemento', e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><div style={labelStyle}>Cidade</div>
                      <input style={inputStyle} placeholder="Cidade" value={form.cidade} onChange={e => set('cidade', e.target.value)} />
                    </div>
                    <div><div style={labelStyle}>Estado</div>
                      <select style={inputStyle} value={form.estado} onChange={e => set('estado', e.target.value)}>
                        <option value="">UF</option>
                        {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div style={labelStyle}>Modalidades que você dá aula</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {modalidades.map(m => {
                        const selecionada = (form.modalidades_ids || []).includes(m.id)
                        return (
                          <button key={m.id} type="button" onClick={() => {
                            const atual = form.modalidades_ids || []
                            set('modalidades_ids', selecionada ? atual.filter(id => id !== m.id) : [...atual, m.id])
                          }} style={{
                            padding: '8px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            background: selecionada ? '#fcc825' : '#111',
                            outline: selecionada ? 'none' : '1px solid #2a2a2a',
                            color: selecionada ? '#110f0f' : '#555',
                            fontSize: '11px', fontWeight: selecionada ? '700' : '400',
                            textAlign: 'center', lineHeight: 1.3,
                          }}>
                            {m.nome}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ height: '1px', backgroundColor: '#2a2a2a', margin: '4px 0' }} />
                  <div style={sectionLabelStyle}>Informações adicionais (opcional)</div>

                  <button type="button" onClick={() => set('tem_cref', !form.tem_cref)} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                    borderRadius: '10px', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                    background: form.tem_cref ? 'rgba(252,200,37,0.1)' : '#111',
                    outline: form.tem_cref ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a',
                    color: form.tem_cref ? '#fcc825' : '#555', fontSize: '13px',
                  }}>
                    <span>{form.tem_cref ? '✓' : '○'}</span>
                    <span>Possui CREF ou Liminar?</span>
                  </button>
                  {form.tem_cref && (
                    <>
                      <input style={inputStyle} placeholder="Número do CREF (ex: 123456-G/SP)"
                        value={form.numero_cref} onChange={e => set('numero_cref', e.target.value)} />
                      {form.cref_url ? (
                        <a href={form.cref_url} target="_blank" rel="noreferrer" style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                          borderRadius: '10px', border: '1px solid rgba(252,200,37,0.3)',
                          backgroundColor: 'rgba(252,200,37,0.06)', textDecoration: 'none', color: '#fcc825', fontSize: '13px',
                        }}>
                          <FileText size={14} /> Ver arquivo enviado
                        </a>
                      ) : (
                        <label style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          padding: '10px', borderRadius: '10px', border: '1px dashed #2a2a2a',
                          background: 'none', color: '#555', fontSize: '13px', cursor: 'pointer', width: '100%',
                          boxSizing: 'border-box',
                        }}>
                          <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleUploadCref} />
                          <Upload size={14} /> Anexar foto do CREF
                        </label>
                      )}
                    </>
                  )}

                  <button type="button" onClick={() => set('tem_cnpj', !form.tem_cnpj)} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                    borderRadius: '10px', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                    background: form.tem_cnpj ? 'rgba(252,200,37,0.1)' : '#111',
                    outline: form.tem_cnpj ? '1px solid rgba(252,200,37,0.4)' : '1px solid #2a2a2a',
                    color: form.tem_cnpj ? '#fcc825' : '#555', fontSize: '13px',
                  }}>
                    <span>{form.tem_cnpj ? '✓' : '○'}</span>
                    <span>Possui CNPJ?</span>
                  </button>
                  {form.tem_cnpj && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input style={inputStyle} placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} />
                      <input style={inputStyle} placeholder="Razão social" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} />
                    </div>
                  )}

                  <div style={sectionLabelStyle}>Dados bancários</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <select style={inputStyle} value={form.banco} onChange={e => set('banco', e.target.value)}>
                      <option value="">Banco</option>
                      {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select style={inputStyle} value={form.tipo_pagamento} onChange={e => set('tipo_pagamento', e.target.value)}>
                      <option value="pix">PIX</option>
                      <option value="boleto">Boleto</option>
                    </select>
                  </div>
                  {form.tipo_pagamento === 'pix' ? (
                    <input style={inputStyle} placeholder="Chave PIX" value={form.chave_pix} onChange={e => set('chave_pix', e.target.value)} />
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <input style={inputStyle} placeholder="Agência" value={form.agencia} onChange={e => set('agencia', e.target.value)} />
                      <input style={inputStyle} placeholder="Conta" value={form.conta} onChange={e => set('conta', e.target.value)} />
                      <select style={inputStyle} value={form.tipo_conta} onChange={e => set('tipo_conta', e.target.value)}>
                        <option value="corrente">Corrente</option>
                        <option value="poupanca">Poupança</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              {erro && (
                <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '13px', color: '#EF4444' }}>
                  {erro}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #fcc825, #d28c3c, #cf1b9b)',
                color: 'white', fontSize: '15px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '8px',
              }}>
                {loading ? 'Salvando...' : 'Salvar e continuar'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
