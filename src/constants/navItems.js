import { Home, CalendarDays, Users, DollarSign, FileBarChart, MessageCircle, LayoutDashboard, User, GraduationCap, ClipboardCheck, Trophy } from 'lucide-react'
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

  if (role === 'leitura') {
    return [
      { path: '/', icon: Home, label: 'Início' },
      { path: '/relatorios-leitura', icon: FileBarChart, label: 'Relatórios' },
      { path: '/disponibilidade-turmas', icon: ClipboardCheck, label: 'Disponibilidade' },
    ]
  }

  if (role === 'professor') {
    return [
      { path: '/dashboard-professor', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/aulas', icon: CalendarDays, label: 'Minhas Aulas' },
      { path: '/meus-alunos', icon: GraduationCap, label: 'Meus Alunos' },
      { path: '/ranking', icon: Trophy, label: 'Ranking' },
      { path: '/mensagens', icon: MessageCircle, label: 'Mensagens' },
      { path: '/meu-perfil', icon: User, label: 'Meu Perfil' },
    ]
  }

  const items = [
    { path: '/', icon: Home, label: 'Início' },
    { path: '/aulas', icon: CalendarDays, label: 'Aulas' },
  ]
  if (permissoes.podeAcessarCadastros) items.push({ path: '/cadastros', icon: Users, label: 'Cadastros' })
  items.push({ path: '/ranking', icon: Trophy, label: 'Ranking' })
  if (permissoes.podeAcessarFinanceiro) items.push({ path: '/financeiro', icon: DollarSign, label: 'Financeiro' })
  if (permissoes.podeAcessarKPIs) items.push({ path: '/kpis', icon: FileBarChart, label: 'Relatório' })
  if (permissoes.podeVerDisponibilidade) items.push({ path: '/disponibilidade-turmas', icon: ClipboardCheck, label: 'Disponibilidade' })
  items.push({ path: '/mensagens', icon: MessageCircle, label: 'Mensagens' })
  return items
}
