import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [modo, setModo] = useState('login')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ email: '', senha: '', nome: '' })

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      if (modo === 'login') {
        await signIn(form.email, form.senha)
      } else {
        await signUp(form.email, form.senha, form.nome)
      }
    } catch (err) {
      setErro(err.message || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#110f0f',
      background: 'radial-gradient(ellipse at center, #2d0a2e 0%, #1a051a 40%, #110f0f 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/images/logoprocoach.png"
            alt="ProCoach"
            style={{ height: '48px', objectFit: 'contain', margin: '0 auto 16px' }}
          />
          <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>Gestão esportiva inteligente</p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '20px',
          border: '1px solid #1e1e1e',
          padding: '24px'
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex', gap: '8px', marginBottom: '24px',
            padding: '4px', backgroundColor: '#110f0f', borderRadius: '12px'
          }}>
            {['login', 'cadastro'].map(m => (
              <button
                key={m}
                onClick={() => { setModo(m); setErro('') }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px',
                  fontSize: '13px', fontWeight: '500', cursor: 'pointer', border: 'none',
                  background: modo === m
                    ? 'linear-gradient(135deg, #fcc825, #cf1b9b)'
                    : 'transparent',
                  color: modo === m ? 'white' : '#555',
                  transition: 'all 0.2s'
                }}
              >
                {m === 'login' ? 'Entrar' : 'Criar Conta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {modo === 'cadastro' && (
              <Input
                label="Nome completo"
                placeholder="Seu nome"
                value={form.nome}
                onChange={e => update('nome', e.target.value)}
                required
              />
            )}
            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              required
            />
            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              value={form.senha}
              onChange={e => update('senha', e.target.value)}
              required
            />

            {erro && (
              <div style={{
                padding: '12px', borderRadius: '10px',
                backgroundColor: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                fontSize: '13px', color: '#EF4444'
              }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #fcc825, #d28c3c, #cf1b9b)',
                color: 'white', fontSize: '15px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                marginTop: '8px'
              }}
            >
              {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '11px', color: '#222', marginTop: '24px', letterSpacing: '1px' }}>
          POWERED BY FNEVESSPORT
        </p>
      </div>
    </div>
  )
}