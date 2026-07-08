import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useAppStore from '../../store/useAppStore'
import { usePermissions } from '../../hooks/usePermissions'
import { Input } from '../../components/ui/Input'
import { mascararTelefoneBR, apenasDigitosTelefone } from '../../lib/telefone'
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

  // Todo colaborador (professor, financeiro, gestor, auxiliar...) fica com um professor_id
  // em perfis_usuario, porque a tabela `professores` guarda o cadastro de qualquer tipo de
  // colaborador — não só quem dá aula.
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

  // Essa tela só pede o mínimo pra liberar o acesso (senha + contato básico) — o resto do
  // cadastro (endereço, modalidades, CREF, dados bancários...) fica pra depois, na página de
  // Cadastros, onde é mais prático de preencher com calma.
  const precisaOnboarding = !!professor && !(professor.email && professor.telefone && professor.nascimento)

  useEffect(() => {
    if (professor && !form) {
      setForm({
        email: professor.email || '',
        telefone: professor.telefone || '',
        nascimento: professor.nascimento || '',
      })
    }
  }, [professor, form])

  function set(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  const regrasSenha = {
    tamanho: senha.length >= 6,
    maiuscula: /[A-Z]/.test(senha),
    numero: /[0-9]/.test(senha),
  }
  const senhaValida = regrasSenha.tamanho && regrasSenha.maiuscula && regrasSenha.numero

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (!senhaValida) return setErro('A senha precisa ter pelo menos 6 caracteres, 1 letra maiúscula e 1 número')
    if (senha !== confirmacao) return setErro('As senhas não coincidem')

    if (precisaOnboarding) {
      if (!form.email.trim() || !form.telefone.trim() || !form.nascimento) {
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
      <div style={{ width: '100%', maxWidth: '400px', margin: 'auto 0' }}>
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
                <Input label="Nova senha" type={mostrarSenha ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={senha} onChange={e => setSenha(e.target.value)} required />
                <button type="button" onClick={() => setMostrarSenha(v => !v)} style={{
                  position: 'absolute', right: '10px', bottom: '10px', background: 'none', border: 'none',
                  color: '#555', cursor: 'pointer', padding: '4px', display: 'flex',
                }}>
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '-8px' }}>
                <span style={{ fontSize: '11px', color: regrasSenha.tamanho ? '#22c55e' : '#555' }}>6 caracteres</span>
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
