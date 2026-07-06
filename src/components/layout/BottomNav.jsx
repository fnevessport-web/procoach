import { ChevronUp } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAppStore from '../../store/useAppStore'
import { getNavItems } from '../../constants/navItems'

export function BottomNav() {
  const { perfil, navRecolhida, setNavRecolhida } = useAppStore()
  const location = useLocation()
  const navigate = useNavigate()

  const role = perfil?.role || 'professor'
  const items = getNavItems(role)

  if (navRecolhida) {
    return (
      <button
        onClick={() => setNavRecolhida(false)}
        aria-label="Mostrar menu"
        style={{
          flexShrink: 0, zIndex: 40, width: '100%', border: 'none',
          backgroundColor: '#110f0f', borderTop: '1px solid #1e1e1e',
          padding: '6px 0 calc(6px + env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        <ChevronUp size={16} color="#333" />
      </button>
    )
  }

  return (
    <nav className="bottom-nav" style={{
      flexShrink: 0, zIndex: 40,
      backgroundColor: '#110f0f',
      borderTop: '1px solid #1e1e1e',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '8px 8px 12px', maxWidth: '1024px', margin: '0 auto'
      }}>
        {items.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                padding: '8px 12px', borderRadius: '12px', border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer', minWidth: '52px',
                color: active ? '#fcc825' : '#333',
                transition: 'all 0.2s'
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span style={{ fontSize: '10px', fontWeight: '500', lineHeight: 1 }}>{label}</span>
              {active && (
                <div style={{
                  width: '20px', height: '2px', borderRadius: '1px',
                  background: 'linear-gradient(90deg, #fcc825, #cf1b9b)'
                }} />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}