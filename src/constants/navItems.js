import { Home, CalendarDays, Users, DollarSign, BarChart3, MessageCircle, ClipboardCheck, LayoutDashboard, User } from 'lucide-react'
import { resolverRole, permissoesDoRole } from '../hooks/usePermissions'

// Itens de navegação derivados das flags de usePermissions — uma fonte só de verdade
// pra quem vê o quê (BottomNav mobile e Sidebar desktop consomem isso igual).
export function getNavItems(roleBruto) {
  const role = resolverRole(roleBruto)
  const permissoes = permissoesDoRole(roleBruto)

  if (role === 'auxiliar') {
    return [
      { path: '/aulas', icon: CalendarDays, label: 'Grade' },
    ]
  }

  if (role === 'professor') {
    return [
      { path: '/dashboard-professor', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/aulas', icon: CalendarDays, label: 'Minhas Aulas' },
      { path: '/mensagens', icon: MessageCircle, label: 'Mensagens' },
      { path: '/meu-perfil', icon: User, label: 'Meu Perfil' },
    ]
  }

  const items = [
    { path: '/', icon: Home, label: 'Início' },
    { path: '/aulas', icon: CalendarDays, label: 'Aulas' },
  ]
  if (permissoes.podeValidarAulas) items.push({ path: '/match', icon: ClipboardCheck, label: 'Match' })
  if (permissoes.podeAcessarCadastros) items.push({ path: '/cadastros', icon: Users, label: 'Cadastros' })
  if (permissoes.podeAcessarFinanceiro) items.push({ path: '/financeiro', icon: DollarSign, label: 'Financeiro' })
  if (permissoes.podeAcessarKPIs) items.push({ path: '/kpis', icon: BarChart3, label: 'KPIs' })
  items.push({ path: '/mensagens', icon: MessageCircle, label: 'Mensagens' })
  return items
}
