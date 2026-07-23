import { LogOut, ChevronDown, Undo2, Building2 } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useMinhasEmpresas } from '../../hooks/useEmpresas'
import { usePermissions } from '../../hooks/usePermissions'
import { SinoAlertas } from '../SinoAlertas'
import useAppStore from '../../store/useAppStore'

function getIniciais(nome) {
  if (!nome) return 'U'
  const partes = nome.trim().split(' ').filter(Boolean)
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// Header é "chrome" fixo do app (como a Sidebar) — sempre no tom escuro da marca,
// independente do contexto claro/escuro da página carregada no <main>. Por isso usa os
// tokens --color-*-dark-* diretos, não os aliases --surface/--text-primary (esses são só
// pra componentes que aparecem DENTRO do conteúdo roteado, ex: Modal, Input).
export function Header() {
  const { user, perfil, signOut } = useAuth()
  const { podeVerSino } = usePermissions()
  const { data: empresas = [] } = useMinhasEmpresas(user?.id)
  const [menuOpen, setMenuOpen] = useState(false)
  const { modalidadeSelecionada, setModalidadeSelecionada, origemAulas, setOrigemAulas, empresaSelecionada, setEmpresaSelecionada } = useAppStore()
  const location = useLocation()
  const navigate = useNavigate()

  const fromRoute = location.state?.from
  const backState = location.state?.financeiroState
  const mostrarVoltarAulas = location.pathname === '/' && !!origemAulas

  function voltarParaAulas() {
    navigate('/aulas', { state: { data: origemAulas.data, highlightAulaId: origemAulas.aulaId, fromHome: true } })
    setOrigemAulas(null)
  }

  const iniciais = getIniciais(perfil?.nome)

  return (
    <header style={{
      flexShrink: 0, zIndex: 40,
      backgroundColor: 'rgba(30,43,36,0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '0.5px solid var(--color-border-dark-subtle)',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div className="header-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', gap: '8px', minWidth: 0 }}>

        <img
          src="/images/logo-pc-cream.png"
          alt="ProCoach"
          style={{ height: '42px', objectFit: 'contain' }}
        />

        {fromRoute && (
          <button
            onClick={() => navigate(fromRoute, { state: backState ? { financeiroState: backState } : null })}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: 'none',
              cursor: 'pointer', padding: '4px',
              color: 'var(--color-text-dark-secondary)', fontSize: '12px',
            }}
          >
            <Undo2 size={15} color="var(--color-text-dark-secondary)" />
          </button>
        )}

        {!fromRoute && mostrarVoltarAulas && (
          <button
            onClick={voltarParaAulas}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: 'none',
              cursor: 'pointer', padding: '4px',
              color: 'var(--color-text-dark-secondary)', fontSize: '12px',
            }}
          >
            <Undo2 size={15} color="var(--color-text-dark-secondary)" />
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 1 }}>
          {podeVerSino && <SinoAlertas />}

          {empresas.length > 1 && (
            <button
              onClick={() => setEmpresaSelecionada(null)}
              title="Trocar empresa"
              style={{
                padding: '6px', borderRadius: '8px', border: '1px solid var(--color-border-dark-subtle)',
                backgroundColor: 'var(--color-surface-dark-raised)', color: 'var(--color-text-dark-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              <Building2 size={15} />
            </button>
          )}

          {modalidadeSelecionada && (
            <button
              onClick={() => setModalidadeSelecionada(null)}
              style={{
                padding: '4px 10px', borderRadius: '8px',
                backgroundColor: 'rgba(165,76,46,0.12)',
                border: '1px solid rgba(165,76,46,0.35)',
                color: 'var(--color-action-primary)', fontSize: '12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              {modalidadeSelecionada.nome} ×
            </button>
          )}

          <div style={{ position: 'relative', minWidth: 0, flexShrink: 1 }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 8px', borderRadius: '10px',
                backgroundColor: 'var(--color-surface-dark-raised)', border: '1px solid var(--color-border-dark-subtle)',
                cursor: 'pointer', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box',
              }}
            >
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%',
                backgroundColor: 'var(--color-action-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--color-action-on-primary)' }}>
                  {iniciais}
                </span>
              </div>
              <span style={{
                fontSize: '11px', color: 'var(--color-text-dark-secondary)', fontWeight: '400',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '64px', minWidth: 0,
              }}>
                {perfil?.nome?.split(' ')[0] || 'Usuário'}
              </span>
              <ChevronDown size={12} color="var(--color-text-dark-muted)" style={{ flexShrink: 0 }} />
            </button>

            {menuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: '8px',
                  width: '180px', backgroundColor: 'var(--color-surface-dark-raised)',
                  border: '1px solid var(--color-border-dark-subtle)', borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 50, overflow: 'hidden'
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-dark-subtle)' }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-text-dark-primary)' }}>{perfil?.nome || 'Usuário'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-dark-secondary)', textTransform: 'capitalize' }}>
                      {empresaSelecionada?.role || perfil?.role}
                      {empresaSelecionada && ` · ${empresaSelecionada.nome}`}
                    </div>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); signOut() }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 16px', fontSize: '13px', color: 'var(--color-state-danger)',
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
