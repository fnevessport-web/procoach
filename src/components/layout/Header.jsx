import { Bell, LogOut, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useAulasPendentes } from '../../hooks/useAulas'
import useAppStore from '../../store/useAppStore'

export function Header() {
  const { perfil, signOut } = useAuth()
  const { data: pendentes = 0 } = useAulasPendentes()
  const [menuOpen, setMenuOpen] = useState(false)
  const { modalidadeSelecionada, setModalidadeSelecionada } = useAppStore()

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      backgroundColor: '#110f0f',
      borderBottom: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', maxWidth: '480px', margin: '0 auto' }}>

        <img
          src="/images/logoprocoach.png"
          alt="ProCoach"
          style={{ height: '28px', objectFit: 'contain' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {pendentes > 0 && (
            <div style={{ position: 'relative' }}>
              <Bell size={20} color="#555" />
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px',
                width: '16px', height: '16px', backgroundColor: '#EF4444',
                borderRadius: '50%', fontSize: '10px', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
              }}>
                {pendentes > 9 ? '9+' : pendentes}
              </span>
            </div>
          )}

          {modalidadeSelecionada && (
            <button
              onClick={() => setModalidadeSelecionada(null)}
              style={{
                padding: '4px 10px', borderRadius: '8px',
                backgroundColor: 'rgba(252,200,37,0.1)',
                border: '1px solid rgba(252,200,37,0.3)',
                color: '#fcc825', fontSize: '12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              {modalidadeSelecionada.nome} ×
            </button>
          )}

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 10px', borderRadius: '10px',
                backgroundColor: '#1a1a1a', border: '1px solid #1e1e1e',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #fcc825, #cf1b9b)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'white' }}>
                  {(perfil?.nome || 'U')[0].toUpperCase()}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#555' }}>
                {perfil?.nome?.split(' ')[0] || 'Usuário'}
              </span>
              <ChevronDown size={12} color="#333" />
            </button>

            {menuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: '8px',
                  width: '180px', backgroundColor: '#1a1a1a',
                  border: '1px solid #1e1e1e', borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 50, overflow: 'hidden'
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e1e' }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#F0F2F5' }}>{perfil?.nome || 'Usuário'}</div>
                    <div style={{ fontSize: '11px', color: '#555', textTransform: 'capitalize' }}>{perfil?.role}</div>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); signOut() }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 16px', fontSize: '13px', color: '#EF4444',
                      backgroundColor: 'transparent', border: 'none', cursor: 'pointer'
                    }}
                  >
                    <LogOut size={15} />
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}