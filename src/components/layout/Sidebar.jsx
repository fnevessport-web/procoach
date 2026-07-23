import { useLocation, useNavigate } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
import { getNavItems } from '../../constants/navItems'
import { useModalidades } from '../../hooks/useModalidades'
import { ICONES_MODALIDADES } from '../../constants/modalidades'

export function Sidebar() {
  const { role } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()
  const { data: modalidades } = useModalidades()

  const items = getNavItems(role)

  return (
    <nav className="sidebar-desktop">
      <div className="sidebar-logo">
        <img src="/images/logo-pc-cream.png" alt="ProCoach" />
      </div>

      <div className="sidebar-items">
        {items.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`sidebar-item${active ? ' sidebar-item-active' : ''}`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} className="sidebar-item-icon" />
              <span className="sidebar-item-label">{label}</span>
            </button>
          )
        })}

        {/* Acesso leitura do clube: não tem tela de Cadastros pra navegar até uma
            modalidade, então os atalhos ficam direto na barra — mesmo ícone-só-expande-
            no-hover que o resto do menu já usa. */}
        {role === 'leitura' && modalidades?.map(mod => {
          const path = `/modalidade/${encodeURIComponent(mod.nome)}`
          const active = location.pathname === path
          const icone = ICONES_MODALIDADES[mod.nome]
          return (
            <button
              key={mod.id}
              onClick={() => navigate(path)}
              className={`sidebar-item${active ? ' sidebar-item-active' : ''}`}
            >
              {icone
                ? <img src={icone} alt="" className="sidebar-item-icon" style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0 }} />
                : <span className="sidebar-item-icon" style={{ width: '20px', textAlign: 'center', fontSize: '10px', flexShrink: 0 }}>{mod.nome[0]}</span>
              }
              <span className="sidebar-item-label">{mod.nome}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
