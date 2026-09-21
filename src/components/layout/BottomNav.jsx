import { useEffect, useRef } from 'react'
import { ChevronUp } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAppStore from '../../store/useAppStore'
import { usePermissions } from '../../hooks/usePermissions'
import { getNavItems } from '../../constants/navItems'

// Chrome fixo do app (mesmo raciocínio do Header.jsx) — sempre escuro, tokens diretos.
export function BottomNav() {
  const { navRecolhida, setNavRecolhida } = useAppStore()
  const { role } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()

  const items = getNavItems(role)
  // Com muitos itens (gestor/coordenador têm 9) a barra não cabe em telas de celular: vira rolável
  // na horizontal em vez de cortar os últimos itens. Com poucos itens segue distribuída como sempre.
  const muitos = items.length > 6
  const barraRef = useRef(null)

  // Mantém o item da tela atual à vista quando a barra está rolável.
  useEffect(() => {
    if (!muitos) return
    barraRef.current?.querySelector('[data-ativo="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [location.pathname, muitos, navRecolhida])

  if (navRecolhida) {
    return (
      <button
        onClick={() => setNavRecolhida(false)}
        aria-label="Mostrar menu"
        style={{
          flexShrink: 0, zIndex: 40, width: '100%', border: 'none',
          backgroundColor: 'var(--color-surface-dark-base)', borderTop: '1px solid var(--color-border-dark-subtle)',
          padding: '6px 0 calc(6px + env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        <ChevronUp size={16} color="var(--color-text-dark-muted)" />
      </button>
    )
  }

  return (
    <nav className="bottom-nav" style={{
      flexShrink: 0, zIndex: 40,
      backgroundColor: 'var(--color-surface-dark-base)',
      borderTop: '1px solid var(--color-border-dark-subtle)',
    }}>
      <div ref={barraRef} style={{
        display: 'flex', alignItems: 'center', justifyContent: muitos ? 'flex-start' : 'space-around',
        padding: '8px 8px 12px', maxWidth: '1024px', margin: '0 auto',
        ...(muitos ? { overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } : null),
      }}>
        {items.map(({ path, icon: Icon, label, labelMobile }) => {
          const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
          return (
            <button
              key={path}
              data-ativo={active}
              onClick={() => navigate(path)}
              style={{
                flexShrink: muitos ? 0 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                padding: '8px 12px', borderRadius: '12px', border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer', minWidth: '52px',
                color: active ? 'var(--color-action-primary)' : 'var(--color-text-dark-muted)',
                transition: 'all 0.2s'
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span style={{ fontSize: '10px', fontWeight: '500', lineHeight: 1 }}>{labelMobile || label}</span>
              {active && (
                <div style={{
                  width: '20px', height: '2px', borderRadius: '1px',
                  backgroundColor: 'var(--color-action-primary)',
                }} />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
