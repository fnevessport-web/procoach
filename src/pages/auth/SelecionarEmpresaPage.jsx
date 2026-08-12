import { useAuth } from '../../hooks/useAuth'

const LABEL_ROLE = {
  admin: 'Gestor', gestor: 'Gestor', financeiro: 'Financeiro',
  coordenador: 'Coordenador', professor: 'Professor', auxiliar: 'Auxiliar',
  auxiliar_quadra: 'Auxiliar de Quadra',
}

export function SelecionarEmpresaPage({ empresas, onSelecionar }) {
  const { signOut } = useAuth()

  return (
    <div className="fade-in" style={{
      height: '100vh', width: '100%',
      backgroundColor: 'var(--color-surface-light-base)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/images/logo-pc-green.png" alt="ProCoach" style={{ height: '48px', objectFit: 'contain', margin: '0 auto 14px', display: 'block' }} />
          <h1 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-text-light-primary)', margin: '0 0 4px' }}>Qual empresa você quer acessar?</h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', margin: 0 }}>Você tem acesso a mais de uma empresa no ProCoach</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {empresas.map((empresa, i) => (
            <button
              key={empresa.id}
              onClick={() => onSelecionar(empresa)}
              className="empresa-card"
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '16px', borderRadius: '16px',
                backgroundColor: 'var(--color-surface-light-raised)', border: '1px solid var(--color-border-light)',
                cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box',
                animation: `fadeIn 0.3s ease-out ${i * 60}ms both`,
              }}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                backgroundColor: 'var(--color-surface-light-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {empresa.logoUrl
                  ? <img src={empresa.logoUrl} alt={empresa.nome} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-action-primary)' }}>{empresa.nome?.[0]?.toUpperCase()}</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-light-primary)' }}>{empresa.nome}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-light-secondary)', marginTop: '2px' }}>
                  {LABEL_ROLE[empresa.role] || empresa.role}
                </div>
              </div>
              <span style={{ color: 'var(--color-text-light-muted)', fontSize: '18px' }}>›</span>
            </button>
          ))}
        </div>

        <button onClick={signOut} style={{
          display: 'block', margin: '24px auto 0', background: 'none', border: 'none',
          color: 'var(--color-text-light-muted)', fontSize: '12px', cursor: 'pointer',
        }}>
          Sair
        </button>
      </div>

      <style>{`
        .empresa-card { transition: border-color 0.15s ease-out, transform 0.15s ease-out, background-color 0.15s ease-out; }
        .empresa-card:hover { border-color: rgba(165,76,46,0.5) !important; background-color: rgba(165,76,46,0.06) !important; transform: translateY(-1px); }
      `}</style>
    </div>
  )
}
