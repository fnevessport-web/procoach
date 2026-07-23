import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

// Campo de login "de linha" (só borda inferior) — bem diferente do <Input> padrão do resto do
// app (caixa cheia com fundo), pedido específico do redesign do login. Fica só aqui, não vira
// componente compartilhado.
function CampoLogin({ label, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && <label style={{ fontSize: '12px', color: 'var(--color-text-dark-secondary)', fontWeight: '500' }}>{label}</label>}
      <input
        {...props}
        className="login-input"
        style={{
          width: '100%', background: 'transparent', border: 'none',
          borderBottom: '1px solid rgba(240,234,216,0.3)',
          color: 'var(--color-text-dark-primary)', fontSize: '15px',
          padding: '8px 2px', outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => { e.target.style.borderBottomColor = 'var(--color-action-primary)' }}
        onBlur={e => { e.target.style.borderBottomColor = 'rgba(240,234,216,0.3)' }}
      />
    </div>
  )
}

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
      height: '100vh', width: '100%', position: 'relative',
      // backgroundColor fica como fallback: se a imagem faltar, mostra só o verde-court sólido,
      // sem ícone de imagem quebrada (diferente de <img>, background-image ausente só não desenha nada).
      backgroundColor: 'var(--color-surface-dark-base)',
      backgroundImage: "url('/images/login-bg.png')",
      backgroundSize: 'cover', backgroundPosition: 'center',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '24px 16px', boxSizing: 'border-box',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
    }}>
      {/* Overlay pra garantir contraste do texto sobre a foto — 45% de verde-court. Card por
          cima ainda soma o próprio fundo translúcido + blur, então o texto dentro dele tem
          contraste de sobra; o wordmark solto (fora do card) depende só desse overlay, então
          confirmar visualmente com a foto real e subir a opacidade se precisar. */}
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(30,43,36,0.45)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '400px', margin: 'auto 0', position: 'relative', zIndex: 1 }}>

        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          {/* O selo/marca já aparece na própria fotografia de fundo (rede na quadra de saibro)
              — não sobrepõe outro logo grande aqui, só o wordmark. */}
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '30px', fontWeight: '700', color: 'var(--color-text-dark-primary)', letterSpacing: '0.5px' }}>
            PROCOACH SPORT
          </div>
          <p style={{ color: 'var(--color-text-dark-secondary)', fontSize: '13px', margin: '8px 0 0', letterSpacing: '1px' }}>
            Gestão esportiva inteligente
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          autoComplete="on"
          style={{
            backgroundColor: 'rgba(30,43,36,0.55)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(240,234,216,0.15)',
            borderRadius: '16px', padding: '32px', boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <CampoLogin
              label="CPF ou e-mail" type="text" placeholder="Seu CPF (professor) ou e-mail (gestor)"
              name="username" autoComplete="username"
              value={form.email} onChange={e => update('email', e.target.value)} required
            />
            <div style={{ position: 'relative' }}>
              <CampoLogin
                label="Senha" type={mostrarSenha ? 'text' : 'password'} placeholder="••••••••"
                name="password" autoComplete="current-password"
                value={form.senha} onChange={e => update('senha', e.target.value)} required
              />
              <button type="button" onClick={() => setMostrarSenha(v => !v)} style={{
                position: 'absolute', right: '2px', bottom: '8px', background: 'none', border: 'none',
                color: 'var(--color-text-dark-secondary)', cursor: 'pointer', padding: '4px', display: 'flex',
              }}>
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {erro && (
              <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(180,71,47,0.15)', border: '1px solid rgba(180,71,47,0.4)', fontSize: '13px', color: '#E8A48F' }}>
                {erro}
              </div>
            )}

            {/* Botão principal sempre sólido, sem transparência — ele ancora a hierarquia da
                tela (pedido explícito do redesign, diferente do card/inputs translúcidos). */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              backgroundColor: 'var(--color-action-primary)',
              color: 'var(--color-action-on-primary)', fontSize: '15px', fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, marginTop: '8px',
            }}>
              {loading ? 'Aguarde...' : 'Entrar'}
            </button>

            <button type="button" onClick={() => navigate('/esqueci-senha')} className="login-link" style={{
              background: 'none', border: 'none', color: 'var(--color-text-dark-secondary)', fontSize: '12px',
              cursor: 'pointer', textAlign: 'center', padding: '4px',
            }}>
              Esqueceu sua senha?
            </button>
          </div>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px' }}>
          <button type="button" onClick={() => navigate('/politica-de-privacidade')} style={{
            background: 'none', border: 'none', color: 'var(--color-text-dark-secondary)', fontSize: '11px', cursor: 'pointer', padding: 0,
          }}>
            Política de Privacidade
          </button>
        </p>

        <p style={{ textAlign: 'center', fontSize: '10px', color: 'var(--color-text-dark-muted)', marginTop: '10px', letterSpacing: '2px' }}>
          POWERED BY FNEVESSPORT
        </p>
      </div>
    </div>
  )
}
