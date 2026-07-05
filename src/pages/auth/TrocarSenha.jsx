import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import useAppStore from '../../store/useAppStore'
import { usePermissions } from '../../hooks/usePermissions'
import { Input } from '../../components/ui/Input'

export function TrocarSenha() {
  const navigate = useNavigate()
  const { user, perfil, setPerfil } = useAppStore()
  const { homeRoute } = usePermissions()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres')
    if (senha !== confirmacao) return setErro('As senhas não coincidem')

    setLoading(true)
    try {
      const { error: erroSenha } = await supabase.auth.updateUser({ password: senha })
      if (erroSenha) throw erroSenha

      await supabase.from('perfis_usuario').update({ primeiro_acesso: false }).eq('user_id', user.id)
      setPerfil({ ...perfil, primeiro_acesso: false })
      navigate(homeRoute, { replace: true })
    } catch (err) {
      setErro(err.message || 'Erro ao trocar senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', width: '100%', backgroundColor: '#110f0f',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 16px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/images/logoprocoach.png" alt="ProCoach" style={{ height: '52px', objectFit: 'contain', margin: '0 auto 14px', display: 'block' }} />
          <p style={{ color: '#F0F2F5', fontSize: '15px', fontWeight: '600', margin: '0 0 4px' }}>Primeiro acesso</p>
          <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>Crie uma nova senha pra continuar</p>
        </div>

        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '20px', border: '1px solid #222', padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input label="Nova senha" type="password" placeholder="Mínimo 8 caracteres" value={senha} onChange={e => setSenha(e.target.value)} required />
            <Input label="Confirmar nova senha" type="password" placeholder="Repita a senha" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} required />

            {erro && (
              <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '13px', color: '#EF4444' }}>
                {erro}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading} style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #fcc825, #d28c3c, #cf1b9b)',
              color: 'white', fontSize: '15px', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '8px',
            }}>
              {loading ? 'Salvando...' : 'Salvar e continuar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
