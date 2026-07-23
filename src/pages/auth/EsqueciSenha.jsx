import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { apenasDigitosCPF, mascararCPF } from '../../lib/cpf'
import { Input } from '../../components/ui/Input'

export function EsqueciSenha() {
  const navigate = useNavigate()
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)

  // Login é por CPF (sem e-mail real de verdade), então não tem como mandar link de
  // recuperação — em vez disso, avisa os gestores (sino) pra redefinirem manual.
  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    const cpfDigitos = apenasDigitosCPF(cpf)
    if (cpfDigitos.length !== 11) {
      setErro('Digite o CPF completo')
      return
    }
    setLoading(true)
    try {
      const resp = await fetch('/api/esqueci-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfDigitos }),
      })
      const resultado = await resp.json()
      if (!resp.ok) throw new Error(resultado.error || 'Erro ao registrar aviso')
      setEnviado(true)
    } catch (err) {
      setErro(err.message || 'Erro ao enviar aviso')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100vh', width: '100%', backgroundColor: 'var(--color-surface-light-base)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 16px', boxSizing: 'border-box',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
    }}>
      <div style={{ width: '100%', maxWidth: '400px', margin: 'auto 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/images/logo-pc-green.png" alt="ProCoach" style={{ height: '52px', objectFit: 'contain', margin: '0 auto 14px', display: 'block' }} />
        </div>

        <div style={{ backgroundColor: 'var(--color-surface-light-raised)', borderRadius: '20px', border: '1px solid var(--color-border-light)', padding: '24px' }}>
          <button onClick={() => navigate('/')} style={{
            display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
            color: 'var(--color-text-light-secondary)', fontSize: '12px', cursor: 'pointer', padding: 0, marginBottom: '16px',
          }}>
            <ChevronLeft size={14} /> Voltar ao login
          </button>

          {enviado ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p style={{ fontSize: '14px', color: 'var(--color-text-light-primary)', fontWeight: '600', margin: '0 0 8px' }}>Aviso enviado!</p>
              <p style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)', margin: 0, lineHeight: '1.5' }}>
                Se esse CPF tiver cadastro no sistema, um gestor foi avisado e vai te ajudar a redefinir a senha em breve.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--color-text-light-secondary)', margin: 0 }}>
                Digite seu CPF — vamos avisar um gestor pra redefinir sua senha.
              </p>
              <Input label="CPF" type="text" placeholder="Seu CPF" value={mascararCPF(cpf)} onChange={e => setCpf(e.target.value)} required />

              {erro && (
                <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(180,71,47,0.1)', border: '1px solid rgba(180,71,47,0.3)', fontSize: '13px', color: 'var(--color-state-danger)' }}>
                  {erro}
                </div>
              )}

              <button onClick={handleSubmit} disabled={loading} style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: 'var(--color-action-primary)',
                color: 'white', fontSize: '15px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Enviando...' : 'Avisar gestor'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
