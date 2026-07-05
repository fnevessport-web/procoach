import { Home, CalendarDays, Users, DollarSign, BarChart3 } from 'lucide-react'

export const navItemsAdmin = [
  { path: '/', icon: Home, label: 'Início' },
  { path: '/aulas', icon: CalendarDays, label: 'Aulas' },
  { path: '/cadastros', icon: Users, label: 'Cadastros' },
  { path: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { path: '/kpis', icon: BarChart3, label: 'KPIs' },
]

export const navItemsCoordenador = [
  { path: '/', icon: Home, label: 'Início' },
  { path: '/aulas', icon: CalendarDays, label: 'Aulas' },
  { path: '/kpis', icon: BarChart3, label: 'KPIs' },
]

export const navItemsProfessor = [
  { path: '/', icon: Home, label: 'Início' },
  { path: '/aulas', icon: CalendarDays, label: 'Minhas Aulas' },
]

export function getNavItems(role) {
  return role === 'admin' ? navItemsAdmin : role === 'coordenador' ? navItemsCoordenador : navItemsProfessor
}
