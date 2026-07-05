import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Input } from '../../components/ui/Input'

export function EsqueciSenha() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      })
      if (error) throw error
      setEnviado(true)
    } catch (err) {
      setErro(err.message || 'Erro ao enviar e-mail de recuperação')
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
        </div>

        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '20px', border: '1px solid #222', padding: '24px' }}>
          <button onClick={() => navigate('/')} style={{
            display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
            color: '#555', fontSize: '12px', cursor: 'pointer', padding: 0, marginBottom: '16px',
          }}>
            <ChevronLeft size={14} /> Voltar ao login
          </button>

          {enviado ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p style={{ fontSize: '14px', color: '#F0F2F5', fontWeight: '600', margin: '0 0 8px' }}>E-mail enviado!</p>
              <p style={{ fontSize: '13px', color: '#888', margin: 0, lineHeight: '1.5' }}>
                Confira sua caixa de entrada em <b>{email}</b> e siga o link pra criar uma nova senha.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
                Digite seu e-mail cadastrado — vamos te mandar um link pra criar uma nova senha.
              </p>
              <Input label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />

              {erro && (
                <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '13px', color: '#EF4444' }}>
                  {erro}
                </div>
              )}

              <button onClick={handleSubmit} disabled={loading} style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #fcc825, #d28c3c, #cf1b9b)',
                color: 'white', fontSize: '15px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
