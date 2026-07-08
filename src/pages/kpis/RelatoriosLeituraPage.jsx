import { useState } from 'react'
import { Delete, Lock } from 'lucide-react'
import { KPIsPage } from './KPIsPage'

// PIN fixo, combinado com o clube: fica só com o gerente, pra diferenciar do acesso genérico
// de leitura (zeladores etc.) que também usa esse login. Não é uma trava de segurança de
// verdade (é código do lado do cliente, dá pra achar no bundle) — só evita que quem pega o
// tablet por acaso entre direto no relatório sem saber o código.
const PIN_CORRETO = '0726'

export function RelatoriosLeituraPage() {
  const [desbloqueado, setDesbloqueado] = useState(false)
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState(false)

  function digitar(d) {
    if (pin.length >= 4) return
    setErro(false)
    const novoPin = pin + d
    setPin(novoPin)
    if (novoPin.length === 4) {
      if (novoPin === PIN_CORRETO) {
        setDesbloqueado(true)
      } else {
        setErro(true)
        setTimeout(() => { setPin(''); setErro(false) }, 500)
      }
    }
  }

  function apagar() {
    setErro(false)
    setPin(p => p.slice(0, -1))
  }

  if (desbloqueado) return <KPIsPage />

  return (
    <div className="fade-in" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - 160px)', gap: '24px', padding: '24px',
    }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#1a1a1a',
        border: '1px solid rgba(252,200,37,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Lock size={22} color="#fcc825" />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#F0F2F5', marginBottom: '4px' }}>Relatórios</div>
        <div style={{ fontSize: '12px', color: '#555' }}>Digite o PIN de acesso</div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: '16px', height: '16px', borderRadius: '50%',
            border: `1.5px solid ${erro ? '#EF4444' : 'rgba(252,200,37,0.4)'}`,
            backgroundColor: i < pin.length ? (erro ? '#EF4444' : '#fcc825') : 'transparent',
            transition: 'background-color 0.15s',
          }} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: '12px' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
          <button key={n} onClick={() => digitar(n)} style={{
            width: '64px', height: '64px', borderRadius: '50%', border: '1px solid #2a2a2a',
            backgroundColor: '#1a1a1a', color: '#F0F2F5', fontSize: '20px', fontWeight: '600', cursor: 'pointer',
          }}>{n}</button>
        ))}
        <div />
        <button onClick={() => digitar('0')} style={{
          width: '64px', height: '64px', borderRadius: '50%', border: '1px solid #2a2a2a',
          backgroundColor: '#1a1a1a', color: '#F0F2F5', fontSize: '20px', fontWeight: '600', cursor: 'pointer',
        }}>0</button>
        <button onClick={apagar} style={{
          width: '64px', height: '64px', borderRadius: '50%', border: '1px solid #2a2a2a',
          backgroundColor: '#1a1a1a', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Delete size={18} />
        </button>
      </div>
    </div>
  )
}
