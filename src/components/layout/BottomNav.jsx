import { Home, CalendarDays, Users, DollarSign, BarChart3, BookOpen } from 'lucide-react'
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0F1117]/95 backdrop-blur border-t border-[#2A2D3E] safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-1 max-w-5xl mx-auto">
        {items.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`
                flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all
                min-w-[52px]
                ${active
                  ? 'text-[#00D4AA]'
                  : 'text-[#4A4D65] hover:text-[#8B8FA8]'
                }
              `}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium leading-tight">{label}</span>
              {active && <div className="w-1 h-1 rounded-full bg-[#00D4AA]" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
