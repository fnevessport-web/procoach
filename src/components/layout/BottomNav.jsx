import { Home, CalendarDays, Users, DollarSign, BarChart3 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAppStore from '../../store/useAppStore'

const navItemsAdmin = [
  { path: '/', icon: Home, label: 'Início' },
  { path: '/aulas', icon: CalendarDays, label: 'Aulas' },
  { path: '/cadastros', icon: Users, label: 'Cadastros' },
  { path: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { path: '/kpis', icon: BarChart3, label: 'KPIs' },
]

const navItemsCoordenador = [
  { path: '/', icon: Home, label: 'Início' },
  { path: '/aulas', icon: CalendarDays, label: 'Aulas' },
  { path: '/kpis', icon: BarChart3, label: 'KPIs' },
]

const navItemsProfessor = [
  { path: '/', icon: Home, label: 'Início' },
  { path: '/aulas', icon: CalendarDays, label: 'Minhas Aulas' },
]

export function BottomNav() {
  const { perfil } = useAppStore()
  const location = useLocation()
  const navigate = useNavigate()

  const role = perfil?.role || 'professor'
  const items = role === 'admin' ? navItemsAdmin : role === 'coordenador' ? navItemsCoordenador : navItemsProfessor

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
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