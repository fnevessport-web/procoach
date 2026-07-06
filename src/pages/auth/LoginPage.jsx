import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Input } from '../../components/ui/Input'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [form, setForm] = useState({ email: '', senha: '' })

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      await signIn(form.email, form.senha)
    } catch (err) {
      setErro(err.message || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100vh', width: '100%',
      backgroundColor: '#110f0f',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '24px 16px', boxSizing: 'border-box',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
    }}>
      <div style={{ width: '100%', maxWidth: '400px', margin: 'auto 0' }}>

        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <img src="/images/logoprocoach.png" alt="ProCoach" style={{ height: '60px', objectFit: 'contain', margin: '0 auto 14px', display: 'block' }} />
          <p style={{ color: '#444', fontSize: '13px', margin: 0, letterSpacing: '1px' }}>
            Gestão esportiva inteligente
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="on"
          style={{ backgroundColor: '#1a1a1a', borderRadius: '20px', border: '1px solid #222', padding: '24px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              label="CPF" type="text" inputMode="numeric" placeholder="Seu CPF"
              name="username" autoComplete="username"
              value={form.email} onChange={e => update('email', e.target.value)} required
            />
            <div style={{ position: 'relative' }}>
              <Input
                label="Senha" type={mostrarSenha ? 'text' : 'password'} placeholder="••••••••"
                name="password" autoComplete="current-password"
                value={form.senha} onChange={e => update('senha', e.target.value)} required
              />
              <button type="button" onClick={() => setMostrarSenha(v => !v)} style={{
                position: 'absolute', right: '10px', bottom: '10px', background: 'none', border: 'none',
                color: '#555', cursor: 'pointer', padding: '4px', display: 'flex',
              }}>
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {erro && (
              <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '13px', color: '#EF4444' }}>
                {erro}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #fcc825, #d28c3c, #cf1b9b)',
              color: 'white', fontSize: '15px', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, marginTop: '8px'
            }}>
              {loading ? 'Aguarde...' : 'Entrar'}
            </button>

            <button type="button" onClick={() => navigate('/esqueci-senha')} style={{
              background: 'none', border: 'none', color: '#666', fontSize: '12px',
              cursor: 'pointer', textAlign: 'center', padding: '4px',
            }}>
              Esqueci minha senha
            </button>
          </div>
        </form>

        <p style={{ textAlign: 'center', fontSize: '10px', color: '#222', marginTop: '24px', letterSpacing: '2px' }}>
          POWERED BY FNEVESSPORT
        </p>
      </div>
    </div>
  )
}